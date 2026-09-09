import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ACOES = ["conciliar", "divergencia", "nao_identificado", "ignorar", "vincular"] as const;
type Acao = typeof ACOES[number];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: atual, error: erroAtual } = await supabase.from("conciliacao_pagamentos").select("*").eq("id", params.id).single();
  if (erroAtual || !atual) return NextResponse.json({ erro: "Pagamento não encontrado." }, { status: 404 });

  const body = await req.json();
  const acao = String(body.acao ?? "") as Acao;
  if (!ACOES.includes(acao)) return NextResponse.json({ erro: "Ação de conciliação inválida." }, { status: 400 });

  const clienteId = body.clienteId ? String(body.clienteId) : atual.cliente_id;
  const boletoId = body.boletoId ? String(body.boletoId) : atual.boleto_id;
  const observacao = body.observacao !== undefined ? String(body.observacao).trim() || null : atual.observacao;
  const motivo = body.motivoDivergencia !== undefined ? String(body.motivoDivergencia).trim() || null : atual.motivo_divergencia;

  if ((acao === "conciliar" || acao === "vincular") && (!clienteId || !boletoId)) {
    return NextResponse.json({ erro: "Cliente e parcela são obrigatórios para vincular ou conciliar." }, { status: 400 });
  }
  if (acao === "divergencia" && !motivo) return NextResponse.json({ erro: "Informe o motivo da divergência." }, { status: 400 });
  if (acao === "ignorar" && !observacao && !motivo) return NextResponse.json({ erro: "Informe o motivo para ignorar o pagamento." }, { status: 400 });

  let status: string = atual.status;
  if (acao === "conciliar") status = "conciliado";
  if (acao === "divergencia") status = "divergencia";
  if (acao === "nao_identificado") status = "nao_identificado";
  if (acao === "ignorar") status = "ignorado";
  if (acao === "vincular") status = "pendente";

  const { data: atualizado, error } = await supabase.from("conciliacao_pagamentos").update({
    cliente_id: clienteId,
    boleto_id: boletoId,
    status,
    observacao,
    motivo_divergencia: motivo,
  }).eq("id", params.id).select(`
    id, banco, identificador_externo, cliente_id, boleto_id, data_pagamento,
    valor_recebido, metodo_pagamento, status, dados_origem, observacao,
    motivo_divergencia, created_at, updated_at,
    clientes ( id, nome_completo, cpf, telefone ),
    boletos ( id, numero_parcela, total_parcelas, valor, data_vencimento, status )
  `).single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  const { error: erroHistorico } = await supabase.from("conciliacao_pagamentos_historico").insert({
    conciliacao_pagamento_id: params.id,
    usuario: user.email ?? user.id,
    status_anterior: atual.status,
    status_novo: status,
    cliente_id: clienteId,
    boleto_id: boletoId,
    observacao,
    motivo_divergencia: motivo,
  });
  if (erroHistorico) return NextResponse.json({ erro: `Pagamento atualizado, mas não foi possível registrar o histórico: ${erroHistorico.message}` }, { status: 500 });

  return NextResponse.json({ pagamento: atualizado });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase.from("conciliacao_pagamentos").select(`
    id, banco, identificador_externo, cliente_id, boleto_id, data_pagamento,
    valor_recebido, metodo_pagamento, status, dados_origem, observacao,
    motivo_divergencia, created_at, updated_at,
    clientes ( id, nome_completo, cpf, telefone ),
    boletos ( id, numero_parcela, total_parcelas, valor, data_vencimento, status )
  `).eq("id", params.id).single();
  if (error || !data) return NextResponse.json({ erro: "Pagamento não encontrado." }, { status: 404 });

  const { data: historico, error: erroHistorico } = await supabase.from("conciliacao_pagamentos_historico").select("*").eq("conciliacao_pagamento_id", params.id).order("created_at", { ascending: false });
  if (erroHistorico) return NextResponse.json({ erro: erroHistorico.message }, { status: 500 });
  return NextResponse.json({ pagamento: data, historico: historico ?? [] });
}
