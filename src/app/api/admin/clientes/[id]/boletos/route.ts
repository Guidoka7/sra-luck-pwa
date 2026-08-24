import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { QUANTIDADE_PARCELAS_OPCOES, TAXA_ADMINISTRATIVA_PADRAO, type QuantidadeParcelas } from "@/types/database";

function canalCliente(clienteId: string) {
  return `notificacoes-cliente:${clienteId}`;
}

async function avisarCliente(clienteId: string, evento: string, payload: Record<string, unknown> = {}) {
  try {
    const service = createServiceSupabaseClient();
    await service.channel(canalCliente(clienteId)).send({
      type: "broadcast",
      event: "nova_notificacao",
      payload: { tipo: evento, ...payload },
    });
  } catch (erro) {
    console.error("Falha ao atualizar cliente em tempo real:", erro);
  }
}

function dataValida(data: unknown): data is string {
  return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data);
}

function adicionarMeses(dataIso: string, meses: number) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const diaSeguro = Math.min(dia, ultimoDia);
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
}

async function alinharVencimentosAbertos(supabase: ReturnType<typeof createServerSupabaseClient>, clienteId: string, primeiroVencimento: string) {
  if (!dataValida(primeiroVencimento)) return;
  const { data: abertos, error } = await supabase
    .from("boletos")
    .select("id, numero_parcela, status")
    .eq("cliente_id", clienteId)
    .neq("status", "pago")
    .order("numero_parcela", { ascending: true });
  if (error) throw new Error(error.message);

  for (const boleto of abertos ?? []) {
    const novaData = adicionarMeses(primeiroVencimento, Number(boleto.numero_parcela) - 1);
    const { error: erroUpdate } = await supabase.from("boletos").update({ data_vencimento: novaData }).eq("id", boleto.id);
    if (erroUpdate) throw new Error(erroUpdate.message);
  }
}

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

  const { data: porcentagem } = await supabase.rpc("porcentagem_pagamento", { p_cliente_id: params.id });
  const { data: podeAgendar } = await supabase.rpc("pode_agendar", { p_cliente_id: params.id });
  const { data: agendaLiberada } = await supabase.rpc("agenda_liberada", { p_cliente_id: params.id });
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quantidadeParcelas = Number(body.quantidadeParcelas);
  const primeiroVencimento = body.primeiroVencimento || undefined;
  if (!QUANTIDADE_PARCELAS_OPCOES.includes(quantidadeParcelas as QuantidadeParcelas)) {
    return NextResponse.json({ erro: `Quantidade de parcelas inválida. Use: ${QUANTIDADE_PARCELAS_OPCOES.join(", ")}.` }, { status: 400 });
  }
  if (primeiroVencimento !== undefined && !dataValida(primeiroVencimento)) {
    return NextResponse.json({ erro: "Primeiro vencimento inválido." }, { status: 400 });
  }

  const taxaPercentual = body.taxaPercentual !== undefined && body.taxaPercentual !== null && body.taxaPercentual !== ""
    ? Number(body.taxaPercentual)
    : TAXA_ADMINISTRATIVA_PADRAO[quantidadeParcelas as QuantidadeParcelas];
  if (!Number.isFinite(taxaPercentual) || taxaPercentual < 0) return NextResponse.json({ erro: "Taxa administrativa inválida." }, { status: 400 });

  const { data: cliente } = await supabase.from("clientes").select("id, nome_completo, valor_contrato").eq("id", params.id).single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });
  if (!cliente.valor_contrato || cliente.valor_contrato <= 0) return NextResponse.json({ erro: "Defina a carta de crédito antes de gerar as parcelas." }, { status: 400 });

  const { data: boletos, error } = await supabase.rpc("gerar_boletos_cliente", {
    p_cliente_id: params.id,
    p_quantidade_parcelas: quantidadeParcelas,
    p_taxa_percentual: taxaPercentual,
    ...(primeiroVencimento ? { p_primeiro_vencimento: primeiroVencimento } : {}),
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Garante a regra mesmo se a função RPC do banco estiver desatualizada:
  // a 1ª parcela usa exatamente o primeiro vencimento informado e as demais
  // avançam mês a mês, preservando o dia sempre que o mês permitir.
  if (primeiroVencimento) {
    try {
      await alinharVencimentosAbertos(supabase, params.id, primeiroVencimento);
    } catch (erro) {
      return NextResponse.json({ erro: erro instanceof Error ? erro.message : "Não foi possível ajustar os vencimentos." }, { status: 500 });
    }
  }

  const { data: boletosAtualizados } = await supabase
    .from("boletos")
    .select("*")
    .eq("cliente_id", params.id)
    .order("numero_parcela", { ascending: true });

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: "gerou_boletos",
    entidade: "clientes",
    entidade_id: params.id,
    detalhes: { cliente: cliente.nome_completo, quantidade_parcelas: quantidadeParcelas, taxa_administrativa_percentual: taxaPercentual, primeiro_vencimento: primeiroVencimento ?? null },
  });
  await avisarCliente(params.id, "parcelamento_atualizado", { quantidadeParcelas });

  return NextResponse.json({ boletos: (boletosAtualizados ?? boletos ?? []).map((b: { valor: number }) => ({ ...b, valor: Number(b.valor) })) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quantidade = Number(body.quantidadeParcelas);
  const recalcularAbertas = body.recalcularAbertas !== false;
  const taxa = Number(body.taxaPercentual);
  const primeiroVencimentoInformado = body.primeiroVencimento || undefined;
  if (!QUANTIDADE_PARCELAS_OPCOES.includes(quantidade as QuantidadeParcelas)) return NextResponse.json({ erro: "Quantidade de parcelas inválida." }, { status: 400 });
  if (!Number.isFinite(taxa) || taxa < 0) return NextResponse.json({ erro: "Taxa administrativa inválida." }, { status: 400 });
  if (primeiroVencimentoInformado !== undefined && !dataValida(primeiroVencimentoInformado)) return NextResponse.json({ erro: "Primeiro vencimento inválido." }, { status: 400 });

  const { data: cliente } = await supabase.from("clientes").select("id, nome_completo, valor_contrato, quantidade_parcelas, taxa_administrativa_percentual").eq("id", params.id).single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });

  const { data: atuais, error: erroBusca } = await supabase.from("boletos").select("*").eq("cliente_id", params.id).order("numero_parcela", { ascending: true });
  if (erroBusca) return NextResponse.json({ erro: erroBusca.message }, { status: 500 });

  const pagos = (atuais ?? []).filter((b) => b.status === "pago");
  if (pagos.some((b) => b.numero_parcela > quantidade)) {
    return NextResponse.json({ erro: `Não é possível reduzir para ${quantidade}x porque existem parcelas pagas além da nova quantidade.` }, { status: 400 });
  }

  const custoTotal = Number(cliente.valor_contrato) * (1 + taxa / 100);
  const valorPadrao = Number((custoTotal / quantidade).toFixed(2));

  const { error: erroCliente } = await supabase.from("clientes").update({ quantidade_parcelas: quantidade, taxa_administrativa_percentual: taxa }).eq("id", params.id);
  if (erroCliente) return NextResponse.json({ erro: erroCliente.message }, { status: 500 });

  if (atuais?.length) {
    const manter = atuais.filter((b) => b.numero_parcela <= quantidade);
    const remover = atuais.filter((b) => b.numero_parcela > quantidade && b.status !== "pago");

    for (const b of manter) {
      const update: Record<string, unknown> = { total_parcelas: quantidade };
      if (recalcularAbertas && b.status !== "pago") update.valor = valorPadrao;
      const { error } = await supabase.from("boletos").update(update).eq("id", b.id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    }
    for (const b of remover) {
      const { error } = await supabase.from("boletos").delete().eq("id", b.id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const faltantes = Array.from({ length: quantidade }, (_, i) => i + 1).filter((n) => !atuais.some((b) => b.numero_parcela === n));
    for (const n of faltantes) {
      const referencia = atuais.find((b) => b.numero_parcela === n - 1)?.data_vencimento;
      const dataBase = referencia || primeiroVencimentoInformado || new Date(Date.now() + n * 30 * 86400000).toISOString().slice(0, 10);
      const data = referencia || primeiroVencimentoInformado
        ? adicionarMeses(dataBase, referencia ? 1 : n - 1)
        : dataBase;
      const { error } = await supabase.from("boletos").insert({ cliente_id: params.id, numero_parcela: n, total_parcelas: quantidade, valor: valorPadrao, data_vencimento: data, status: "nao_pago" });
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const primeiroAberto = (atuais ?? []).find((b) => b.numero_parcela === 1)?.data_vencimento;
    const ancora = primeiroVencimentoInformado || primeiroAberto;
    if (ancora) {
      try {
        await alinharVencimentosAbertos(supabase, params.id, ancora);
      } catch (erro) {
        return NextResponse.json({ erro: erro instanceof Error ? erro.message : "Não foi possível alinhar os vencimentos." }, { status: 500 });
      }
    }
  } else {
    const { data, error } = await supabase.rpc("gerar_boletos_cliente", {
      p_cliente_id: params.id,
      p_quantidade_parcelas: quantidade,
      p_taxa_percentual: taxa,
      ...(primeiroVencimentoInformado ? { p_primeiro_vencimento: primeiroVencimentoInformado } : {}),
    });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    if (primeiroVencimentoInformado) {
      try {
        await alinharVencimentosAbertos(supabase, params.id, primeiroVencimentoInformado);
      } catch (erro) {
        return NextResponse.json({ erro: erro instanceof Error ? erro.message : "Não foi possível alinhar os vencimentos." }, { status: 500 });
      }
    }
    const { data: atualizadosSemBoletos } = await supabase.from("boletos").select("*").eq("cliente_id", params.id).order("numero_parcela", { ascending: true });
    return NextResponse.json({ boletos: (atualizadosSemBoletos ?? data ?? []).map((b: { valor: number }) => ({ ...b, valor: Number(b.valor) })) });
  }

  const { data: atualizados } = await supabase.from("boletos").select("*").eq("cliente_id", params.id).order("numero_parcela", { ascending: true });
  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: "alterou_parcelamento",
    entidade: "clientes",
    entidade_id: params.id,
    detalhes: { cliente: cliente.nome_completo, de_quantidade: cliente.quantidade_parcelas, para_quantidade: quantidade, de_taxa: cliente.taxa_administrativa_percentual, para_taxa: taxa, recalculou_abertas: recalcularAbertas, primeiro_vencimento: primeiroVencimentoInformado ?? null },
  });
  await avisarCliente(params.id, "parcelamento_atualizado", { quantidadeParcelas: quantidade });

  return NextResponse.json({ boletos: (atualizados ?? []).map((b) => ({ ...b, valor: Number(b.valor) })) });
}
