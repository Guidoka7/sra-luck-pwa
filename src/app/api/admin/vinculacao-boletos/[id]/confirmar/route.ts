import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function texto(v: unknown) { return String(v ?? "").trim(); }
function evento(usuario: string, detalhes: Record<string, unknown>) {
  return { em: new Date().toISOString(), usuario, acao: "Vinculação confirmada", detalhes };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clienteId = texto(body?.cliente_id);
  const carneId = texto(body?.carne_id);
  const boletoId = texto(body?.boleto_id);
  if (!clienteId || !carneId || !boletoId) {
    return NextResponse.json({ erro: "Cliente, carnê e boleto existente são obrigatórios." }, { status: 400 });
  }

  const { data: importacao, error: importacaoError } = await supabase
    .from("importacoes_boletos")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (importacaoError) return NextResponse.json({ erro: importacaoError.message }, { status: 500 });
  if (!importacao) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  if (importacao.status_vinculacao === "vinculado" || importacao.boleto_vinculado_id || importacao.boleto_id) {
    return NextResponse.json({ erro: "Esta importação já está vinculada." }, { status: 409 });
  }

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle();
  if (clienteError) return NextResponse.json({ erro: clienteError.message }, { status: 500 });
  if (!cliente) return NextResponse.json({ erro: "A cliente selecionada não existe." }, { status: 400 });

  const { data: carne, error: carneError } = await supabase
    .from("carnes")
    .select("id,cliente_id")
    .eq("id", carneId)
    .maybeSingle();
  if (carneError) return NextResponse.json({ erro: carneError.message }, { status: 500 });
  if (!carne || carne.cliente_id !== clienteId) {
    return NextResponse.json({ erro: "O carnê não pertence à cliente selecionada." }, { status: 400 });
  }

  const { data: boleto, error: boletoError } = await supabase
    .from("boletos")
    .select("id,cliente_id,carne_id")
    .eq("id", boletoId)
    .maybeSingle();
  if (boletoError) return NextResponse.json({ erro: boletoError.message }, { status: 500 });
  if (!boleto) return NextResponse.json({ erro: "O boleto selecionado não existe." }, { status: 400 });
  if (boleto.cliente_id !== clienteId) {
    return NextResponse.json({ erro: "O boleto não pertence à cliente selecionada." }, { status: 400 });
  }
  if (boleto.carne_id !== carneId) {
    return NextResponse.json({ erro: "O boleto selecionado não pertence ao carnê escolhido." }, { status: 400 });
  }

  const { data: conflito, error: conflitoError } = await supabase
    .from("importacoes_boletos")
    .select("id")
    .or(`boleto_vinculado_id.eq.${boletoId},boleto_id.eq.${boletoId}`)
    .neq("id", params.id)
    .limit(1)
    .maybeSingle();
  if (conflitoError) return NextResponse.json({ erro: conflitoError.message }, { status: 500 });
  if (conflito) {
    return NextResponse.json({ erro: "Este boleto existente já está vinculado a outra importação." }, { status: 409 });
  }

  const historicoAtual = Array.isArray(importacao.historico) ? importacao.historico : [];
  const historico = [
    ...historicoAtual,
    evento(user.id, {
      status_anterior: importacao.status_vinculacao,
      status_novo: "vinculado",
      cliente_anterior: importacao.cliente_vinculado_id,
      cliente_novo: clienteId,
      carne_anterior: importacao.carne_vinculado_id,
      carne_novo: carneId,
      boleto_anterior: importacao.boleto_vinculado_id ?? importacao.boleto_id,
      boleto_novo: boletoId,
      metodo: "manual",
      pontuacao: importacao.pontuacao_confianca ?? 0,
    }),
  ];

  const { data, error } = await supabase
    .from("importacoes_boletos")
    .update({
      cliente_id: clienteId,
      carne_id: carneId,
      boleto_id: boletoId,
      cliente_vinculado_id: clienteId,
      carne_vinculado_id: carneId,
      boleto_vinculado_id: boletoId,
      status_vinculacao: "vinculado",
      status: "vinculado",
      historico,
    })
    .eq("id", params.id)
    .is("boleto_vinculado_id", null)
    .is("boleto_id", null)
    .neq("status_vinculacao", "vinculado")
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ erro: "A importação foi vinculada por outra operação antes da confirmação. Atualize a análise e tente novamente." }, { status: 409 });
  }
  return NextResponse.json({ importacao: data });
}
