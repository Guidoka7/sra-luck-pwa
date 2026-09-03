import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function texto(v: unknown) { return String(v ?? "").trim(); }
function historicoItem(acao: string, detalhes: Record<string, unknown> = {}) { return { em: new Date().toISOString(), acao, detalhes }; }

async function autenticar() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await autenticar();
  if (!supabase) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.from("importacoes_boletos").select(`*,cliente:clientes!importacoes_boletos_cliente_id_fkey(id,nome_completo,cpf,telefone,email),carnes(id,cliente_id,instituicao_financeira,identificador_externo,data_geracao,quantidade_parcelas,valor_parcela,valor_total,status),boletos(id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto)`).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  return NextResponse.json({ importacao: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await autenticar();
  if (!supabase) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const clienteId = texto(body?.cliente_id); const carneId = texto(body?.carne_id); const boletoId = texto(body?.boleto_id); const confirmar = body?.confirmar === true;
  const { data: atual, error: atualError } = await supabase.from("importacoes_boletos").select("*").eq("id", params.id).maybeSingle();
  if (atualError) return NextResponse.json({ erro: atualError.message }, { status: 500 });
  if (!atual) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  if (!clienteId) return NextResponse.json({ erro: "Selecione uma cliente existente." }, { status: 400 });

  const { data: cliente, error: clienteError } = await supabase.from("clientes").select("id,nome_completo,cpf").eq("id", clienteId).maybeSingle();
  if (clienteError) return NextResponse.json({ erro: clienteError.message }, { status: 500 });
  if (!cliente) return NextResponse.json({ erro: "A cliente selecionada não existe." }, { status: 400 });

  if (carneId) {
    const { data: carne, error } = await supabase.from("carnes").select("id,cliente_id").eq("id", carneId).maybeSingle();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    if (!carne || carne.cliente_id !== clienteId) return NextResponse.json({ erro: "O carnê selecionado não pertence à cliente escolhida." }, { status: 400 });
  }

  let boletoSelecionado: any = null;
  if (boletoId) {
    const { data: boleto, error } = await supabase.from("boletos").select("id,cliente_id,carne_id,instituicao_financeira,identificador_externo").eq("id", boletoId).maybeSingle();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    if (!boleto || boleto.cliente_id !== clienteId || (carneId && boleto.carne_id !== carneId)) return NextResponse.json({ erro: "O boleto selecionado não pertence à cliente/carnê escolhidos." }, { status: 400 });
    boletoSelecionado = boleto;
  }

  if (confirmar && (!carneId || !boletoId)) return NextResponse.json({ erro: "A confirmação exige cliente, carnê e boleto existente selecionados." }, { status: 400 });
  const status = confirmar ? "vinculado" : "aguardando_vinculacao";
  const historicoAtual = Array.isArray(atual.historico) ? atual.historico : [];
  const historico = [...historicoAtual, historicoItem(confirmar ? "Vinculação confirmada" : "Vinculação manual atualizada", { cliente_id: clienteId, carne_id: carneId || null, boleto_id: boletoId || null })];
  const { data, error } = await supabase.from("importacoes_boletos").update({ cliente_id: clienteId, carne_id: carneId || null, boleto_id: boletoId || null, status, historico }).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  if (boletoSelecionado) {
    const preenchimento: Record<string, string> = {};
    if (atual.instituicao_financeira && !boletoSelecionado.instituicao_financeira) preenchimento.instituicao_financeira = atual.instituicao_financeira;
    if (atual.identificador_externo && !boletoSelecionado.identificador_externo) preenchimento.identificador_externo = atual.identificador_externo;
    if (Object.keys(preenchimento).length) {
      const { error: boletoError } = await supabase.from("boletos").update(preenchimento).eq("id", boletoId);
      if (boletoError) return NextResponse.json({ erro: boletoError.message }, { status: 500 });
    }
  }
  return NextResponse.json({ importacao: data });
}
