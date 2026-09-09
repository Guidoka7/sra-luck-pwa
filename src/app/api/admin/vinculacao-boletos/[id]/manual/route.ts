import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const texto = (v: unknown) => String(v ?? "").trim();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clienteId = texto(body?.cliente_id);
  const carneId = texto(body?.carne_id);
  const boletoId = texto(body?.boleto_id);
  if (!clienteId || !carneId || !boletoId) {
    return NextResponse.json({ erro: "Selecione cliente, carnê e boleto existente." }, { status: 400 });
  }

  const { data: importacao } = await supabase.from("importacoes_boletos").select("*").eq("id", params.id).maybeSingle();
  if (!importacao) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  if (importacao.status_vinculacao === "vinculado") return NextResponse.json({ erro: "Esta importação já está vinculada." }, { status: 409 });

  const { data: cliente, error: clienteError } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (clienteError) return NextResponse.json({ erro: clienteError.message }, { status: 500 });
  if (!cliente) return NextResponse.json({ erro: "A cliente selecionada não existe." }, { status: 400 });

  const { data: carne, error: carneError } = await supabase.from("carnes").select("id,cliente_id").eq("id", carneId).maybeSingle();
  if (carneError) return NextResponse.json({ erro: carneError.message }, { status: 500 });
  if (!carne || carne.cliente_id !== clienteId) return NextResponse.json({ erro: "O carnê não pertence à cliente selecionada." }, { status: 400 });

  const { data: boleto, error: boletoError } = await supabase.from("boletos").select("id,cliente_id,carne_id").eq("id", boletoId).maybeSingle();
  if (boletoError) return NextResponse.json({ erro: boletoError.message }, { status: 500 });
  if (!boleto || boleto.cliente_id !== clienteId) return NextResponse.json({ erro: "O boleto não pertence à cliente selecionada." }, { status: 400 });
  if (boleto.carne_id && boleto.carne_id !== carneId) return NextResponse.json({ erro: "O boleto pertence a outro carnê." }, { status: 400 });

  const { data: conflito } = await supabase.from("importacoes_boletos").select("id").eq("boleto_vinculado_id", boletoId).eq("status_vinculacao", "vinculado").neq("id", params.id).limit(1).maybeSingle();
  if (conflito) return NextResponse.json({ erro: "Este boleto já está vinculado a outra importação." }, { status: 409 });

  const historicoAtual = Array.isArray(importacao.historico) ? importacao.historico : [];
  const historico = [
    ...historicoAtual,
    {
      em: new Date().toISOString(),
      usuario: user.id,
      acao: "Vinculação manual confirmada",
      detalhes: {
        status_anterior: importacao.status_vinculacao,
        status_novo: "vinculado",
        cliente_novo: clienteId,
        carne_novo: carneId,
        boleto_novo: boletoId,
        metodo: "manual",
        boleto_legado_sem_carne: !boleto.carne_id,
      },
    },
  ];

  const { data, error } = await supabase.from("importacoes_boletos").update({
    cliente_id: clienteId,
    carne_id: carneId,
    boleto_id: boletoId,
    cliente_vinculado_id: clienteId,
    carne_vinculado_id: carneId,
    boleto_vinculado_id: boletoId,
    status_vinculacao: "vinculado",
    status: "vinculado",
    historico,
  }).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ importacao: data });
}
