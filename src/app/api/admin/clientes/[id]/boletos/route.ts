import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QUANTIDADE_PARCELAS_OPCOES, TAXA_ADMINISTRATIVA_PADRAO, type QuantidadeParcelas } from "@/types/database";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: boletos, error } = await supabase
    .from("boletos")
    .select("*")
    .eq("cliente_id", params.id)
    .order("numero_parcela", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const { data: porcentagem } = await supabase.rpc("porcentagem_pagamento", {
    p_cliente_id: params.id,
  });
  // pode_agendar = já atingiu o % financeiro necessário (etapa 1 — sem contar revisão do admin).
  const { data: podeAgendar } = await supabase.rpc("pode_agendar", {
    p_cliente_id: params.id,
  });
  // agenda_liberada = % atingido E revisão financeira aprovada pelo admin (gate real da agenda).
  const { data: agendaLiberada } = await supabase.rpc("agenda_liberada", {
    p_cliente_id: params.id,
  });
  const { data: cliente } = await supabase
    .from("clientes")
    .select("status_revisao_financeira, data_atingiu_percentual, observacao_revisao_financeira")
    .eq("id", params.id)
    .single();

  return NextResponse.json({
    boletos: (boletos ?? []).map((b) => ({ ...b, valor: Number(b.valor) })),
    porcentagemPagamento: Number(porcentagem ?? 0),
    podeAgendar: Boolean(podeAgendar),
    agendaLiberada: Boolean(agendaLiberada),
    statusRevisaoFinanceira: cliente?.status_revisao_financeira ?? null,
    dataAtingiuPercentual: cliente?.data_atingiu_percentual ?? null,
    observacaoRevisaoFinanceira: cliente?.observacao_revisao_financeira ?? null,
  });
}

// Gera as parcelas da cliente (idempotente: não duplica parcelas já criadas)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quantidadeParcelas = Number(body.quantidadeParcelas);
  const primeiroVencimento = body.primeiroVencimento || undefined;

  if (!QUANTIDADE_PARCELAS_OPCOES.includes(quantidadeParcelas as QuantidadeParcelas)) {
    return NextResponse.json(
      { erro: `Quantidade de parcelas inválida. Use uma de: ${QUANTIDADE_PARCELAS_OPCOES.join(", ")}.` },
      { status: 400 }
    );
  }

  // Taxa administrativa (%): se o admin não mandar nada, cai no padrão da
  // tabela comercial pra essa quantidade de parcelas. Sempre editável.
  const taxaPercentualInformada = body.taxaPercentual !== undefined && body.taxaPercentual !== null && body.taxaPercentual !== ""
    ? Number(body.taxaPercentual)
    : TAXA_ADMINISTRATIVA_PADRAO[quantidadeParcelas as QuantidadeParcelas];

  if (!Number.isFinite(taxaPercentualInformada) || taxaPercentualInformada < 0) {
    return NextResponse.json({ erro: "Taxa administrativa inválida." }, { status: 400 });
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome_completo, valor_contrato")
    .eq("id", params.id)
    .single();

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });
  if (!cliente.valor_contrato || cliente.valor_contrato <= 0) {
    return NextResponse.json(
      { erro: "Defina o valor do contrato da cliente antes de gerar os boletos." },
      { status: 400 }
    );
  }

  const { data: boletos, error } = await supabase.rpc("gerar_boletos_cliente", {
    p_cliente_id: params.id,
    p_quantidade_parcelas: quantidadeParcelas,
    p_taxa_percentual: taxaPercentualInformada,
    ...(primeiroVencimento ? { p_primeiro_vencimento: primeiroVencimento } : {}),
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: "gerou_boletos",
    entidade: "clientes",
    entidade_id: params.id,
    detalhes: {
      cliente: cliente.nome_completo,
      quantidade_parcelas: quantidadeParcelas,
      taxa_administrativa_percentual: taxaPercentualInformada,
    },
  });

  return NextResponse.json({
    boletos: (boletos ?? []).map((b: { valor: number }) => ({ ...b, valor: Number(b.valor) })),
  });
}
