import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BANCOS = ["BRB", "Sicredi", "Santander", "Banco do Brasil", "Efí / Gerencianet"];
const METODOS = ["boleto", "pix", "outro"];

async function autenticar() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const data = url.searchParams.get("data") ?? new Date().toISOString().slice(0, 10);
  const banco = url.searchParams.get("banco");
  const status = url.searchParams.get("status");

  let query = supabase.from("conciliacao_pagamentos").select(`
    id, banco, identificador_externo, cliente_id, boleto_id, data_pagamento,
    valor_recebido, metodo_pagamento, status, dados_origem, observacao,
    motivo_divergencia, created_at, updated_at,
    clientes ( id, nome_completo, cpf, telefone ),
    boletos ( id, numero_parcela, total_parcelas, valor, data_vencimento, status )
  `).eq("data_pagamento", data).order("created_at", { ascending: false });

  if (banco && banco !== "todos") query = query.eq("banco", banco);
  if (status && status !== "todos") query = query.eq("status", status);

  const { data: pagamentos, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const lista = (pagamentos ?? []).map((item: any) => ({
    ...item,
    valor_recebido: Number(item.valor_recebido),
    boletos: Array.isArray(item.boletos) ? item.boletos[0] ?? null : item.boletos ?? null,
    clientes: Array.isArray(item.clientes) ? item.clientes[0] ?? null : item.clientes ?? null,
  }));

  const resumo = {
    totalPagamentos: lista.length,
    totalConciliado: lista.filter((p) => p.status === "conciliado").length,
    pendentes: lista.filter((p) => p.status === "pendente").length,
    naoIdentificados: lista.filter((p) => p.status === "nao_identificado").length,
    divergencias: lista.filter((p) => p.status === "divergencia").length,
    valorRecebido: lista.reduce((sum, p) => sum + p.valor_recebido, 0),
    valorConciliado: lista.filter((p) => p.status === "conciliado").reduce((sum, p) => sum + p.valor_recebido, 0),
  };

  return NextResponse.json({ pagamentos: lista, resumo, dataReferencia: data, bancos: BANCOS });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const banco = String(body.banco ?? "").trim();
  const metodo = String(body.metodoPagamento ?? "").trim();
  const identificador = String(body.identificadorExterno ?? "").trim() || null;
  const dataPagamento = String(body.dataPagamento ?? "").trim();
  const valor = Number(body.valorRecebido);

  if (!BANCOS.includes(banco)) return NextResponse.json({ erro: "Banco inválido." }, { status: 400 });
  if (!METODOS.includes(metodo)) return NextResponse.json({ erro: "Método de pagamento inválido." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return NextResponse.json({ erro: "Data de pagamento inválida." }, { status: 400 });
  if (!Number.isFinite(valor) || valor < 0) return NextResponse.json({ erro: "Valor recebido inválido." }, { status: 400 });

  const { data, error } = await supabase.from("conciliacao_pagamentos").insert({
    banco,
    identificador_externo: identificador,
    data_pagamento: dataPagamento,
    valor_recebido: valor,
    metodo_pagamento: metodo,
    dados_origem: body.dadosOrigem && typeof body.dadosOrigem === "object" ? body.dadosOrigem : null,
    observacao: body.observacao ? String(body.observacao).trim() : null,
  }).select("*").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ erro: "Já existe um pagamento com este identificador para este banco." }, { status: 409 });
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }

  await supabase.from("conciliacao_pagamentos_historico").insert({
    conciliacao_pagamento_id: data.id,
    usuario: user.email ?? user.id,
    status_novo: "pendente",
    cliente_id: null,
    boleto_id: null,
    observacao: "Pagamento registrado manualmente para conferência.",
  });

  return NextResponse.json({ pagamento: data }, { status: 201 });
}
