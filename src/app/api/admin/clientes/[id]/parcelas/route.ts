import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function avisarCliente(clienteId: string, payload: Record<string, unknown>) {
  try {
    const service = createServiceSupabaseClient();
    await service.channel(`notificacoes-cliente:${clienteId}`).send({ type: "broadcast", event: "nova_notificacao", payload });
  } catch (erro) { console.error("Falha no realtime das parcelas:", erro); }
}

function dataValida(data: unknown) {
  return data === null || data === undefined || (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data: boletos, error } = await supabase.from("boletos").select("*").eq("cliente_id", params.id).order("numero_parcela", { ascending: true });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  const { data: historico } = await supabase.from("logs_alteracoes").select("*").eq("entidade_id", params.id).in("acao", ["editou_parcela", "reabriu_parcela", "excluiu_parcela", "suspendeu_parcelas", "gerou_parcelas", "alterou_quantidade_parcelas"]).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ boletos: (boletos ?? []).map((b) => ({ ...b, valor: Number(b.valor) })), historico: historico ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const acao = String(body.acao ?? "");

  if (acao === "gerar") {
    const quantidade = Number(body.quantidade);
    const valorParcela = body.valorParcela === undefined || body.valorParcela === "" ? null : Number(body.valorParcela);
    const primeiroVencimento = body.primeiroVencimento || null;
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 240) return NextResponse.json({ erro: "A quantidade deve ser um número inteiro entre 1 e 240." }, { status: 400 });
    if (valorParcela !== null && (!Number.isFinite(valorParcela) || valorParcela <= 0)) return NextResponse.json({ erro: "Valor da parcela inválido." }, { status: 400 });
    if (!dataValida(primeiroVencimento)) return NextResponse.json({ erro: "Data de vencimento inválida." }, { status: 400 });
    const { data: cliente } = await supabase.from("clientes").select("id, nome_completo, quantidade_parcelas, valor_contrato, custo_total").eq("id", params.id).single();
    if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });
    const { data: existentes } = await supabase.from("boletos").select("numero_parcela, data_vencimento").eq("cliente_id", params.id).order("numero_parcela", { ascending: false }).limit(1);
    const ultima = Number(existentes?.[0]?.numero_parcela ?? 0);
    const primeiro = primeiroVencimento || existentes?.[0]?.data_vencimento || new Date().toISOString().slice(0, 10);
    const total = ultima + quantidade;
    if (total > 240) return NextResponse.json({ erro: "O contrato não pode ultrapassar 240 parcelas." }, { status: 400 });
    const totalBase = Number(cliente.custo_total ?? cliente.valor_contrato ?? 0);
    const valor = valorParcela ?? Number((totalBase / total).toFixed(2));
    const rows = Array.from({ length: quantidade }, (_, index) => {
      const n = ultima + index + 1;
      const base = new Date(`${primeiro}T00:00:00`);
      base.setMonth(base.getMonth() + (primeiroVencimento ? index : index + (ultima ? 1 : 0)));
      return { cliente_id: params.id, numero_parcela: n, total_parcelas: total, valor, data_vencimento: base.toISOString().slice(0, 10), status: "nao_pago" as const };
    });
    const { error } = await supabase.from("boletos").insert(rows);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await supabase.from("boletos").update({ total_parcelas: total }).eq("cliente_id", params.id).neq("status", "pago");
    await supabase.from("clientes").update({ quantidade_parcelas: total }).eq("id", params.id);
    await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "gerou_parcelas", entidade: "clientes", entidade_id: params.id, detalhes: { quantidade_adicionada: quantidade, total_anterior: ultima, total_novo: total, valor_parcela: valor } });
    await avisarCliente(params.id, { tipo: "parcelamento_atualizado", quantidadeParcelas: total });
    return NextResponse.json({ sucesso: true, quantidadeAdicionada: quantidade, totalParcelas: total });
  }

  if (["reabrir", "excluir", "editar"].includes(acao)) {
    const boletoId = String(body.boletoId ?? "");
    if (!boletoId) return NextResponse.json({ erro: "Parcela não informada." }, { status: 400 });
    const { data: atual } = await supabase.from("boletos").select("*").eq("id", boletoId).eq("cliente_id", params.id).single();
    if (!atual) return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
    if (atual.status === "pago") return NextResponse.json({ erro: "Parcelas pagas não podem ser alteradas." }, { status: 400 });
    if (acao === "excluir") {
      const { error } = await supabase.from("boletos").delete().eq("id", boletoId);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "excluiu_parcela", entidade: "clientes", entidade_id: params.id, detalhes: { parcela: atual.numero_parcela, valor: atual.valor, vencimento: atual.data_vencimento } });
      await avisarCliente(params.id, { tipo: "parcelamento_atualizado" });
      return NextResponse.json({ sucesso: true });
    }
    if (acao === "reabrir") {
      const { data, error } = await supabase.from("boletos").update({ status: "nao_pago", data_pagamento: null, observacoes: body.observacoes ?? atual.observacoes }).eq("id", boletoId).select("*").single();
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "reabriu_parcela", entidade: "clientes", entidade_id: params.id, detalhes: { parcela: atual.numero_parcela, status_anterior: atual.status } });
      await avisarCliente(params.id, { tipo: "parcela_atualizada", parcela: atual.numero_parcela });
      return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
    }
    const valor = body.valor === undefined || body.valor === "" ? undefined : Number(body.valor);
    const dataVencimento = body.dataVencimento === undefined ? undefined : (body.dataVencimento || null);
    if (valor !== undefined && (!Number.isFinite(valor) || valor <= 0)) return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
    if (!dataValida(dataVencimento)) return NextResponse.json({ erro: "Data de vencimento inválida." }, { status: 400 });
    if (valor === undefined && dataVencimento === undefined) return NextResponse.json({ erro: "Informe valor ou data de vencimento." }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (valor !== undefined) update.valor = valor;
    if (dataVencimento !== undefined) update.data_vencimento = dataVencimento;
    const { data, error } = await supabase.from("boletos").update(update).eq("id", boletoId).select("*").single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "editou_parcela", entidade: "clientes", entidade_id: params.id, detalhes: { parcela: atual.numero_parcela, de: { valor: atual.valor, data_vencimento: atual.data_vencimento }, para: { valor: data.valor, data_vencimento: data.data_vencimento } } });
    await avisarCliente(params.id, { tipo: "parcela_atualizada", parcela: atual.numero_parcela });
    return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
  }

  if (acao === "suspender") {
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) return NextResponse.json({ erro: "Selecione ao menos uma parcela em aberto." }, { status: 400 });
    const { data: atuais, error } = await supabase.from("boletos").select("*").eq("cliente_id", params.id).order("numero_parcela", { ascending: true });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    const selecionadas = (atuais ?? []).filter((b) => ids.includes(b.id));
    if (selecionadas.length !== ids.length) return NextResponse.json({ erro: "Uma ou mais parcelas não pertencem a esta cliente." }, { status: 400 });
    if (selecionadas.some((b) => b.status === "pago")) return NextResponse.json({ erro: "Parcelas pagas nunca podem ser suspensas." }, { status: 400 });
    const abertas = (atuais ?? []).filter((b) => b.status !== "pago");
    const selecionadasSet = new Set(ids);
    const novaOrdem = [...abertas.filter((b) => !selecionadasSet.has(b.id)), ...abertas.filter((b) => selecionadasSet.has(b.id))];
    const dataBase = abertas.find((b) => b.data_vencimento)?.data_vencimento ?? new Date().toISOString().slice(0, 10);
    const maiorPago = Math.max(0, ...(atuais ?? []).filter((b) => b.status === "pago").map((b) => Number(b.numero_parcela)));
    const totalContrato = (atuais ?? []).length;
    for (const boleto of abertas) {
      const { error: e } = await supabase.from("boletos").update({ numero_parcela: 9001 + abertas.indexOf(boleto), total_parcelas: 10000 }).eq("id", boleto.id);
      if (e) return NextResponse.json({ erro: e.message }, { status: 500 });
    }
    const alteracoes: Array<Record<string, unknown>> = [];
    for (let i = 0; i < novaOrdem.length; i++) {
      const boleto = novaOrdem[i];
      const novaData = new Date(`${dataBase}T00:00:00`);
      novaData.setMonth(novaData.getMonth() + i);
      const suspensa = selecionadasSet.has(boleto.id);
      const { error: e } = await supabase.from("boletos").update({ numero_parcela: maiorPago + i + 1, total_parcelas: totalContrato, data_vencimento: novaData.toISOString().slice(0, 10), suspensa, suspensa_em: suspensa ? new Date().toISOString() : boleto.suspensa_em, suspensa_por: suspensa ? (user.email ?? "admin") : boleto.suspensa_por }).eq("id", boleto.id);
      if (e) return NextResponse.json({ erro: e.message }, { status: 500 });
      if (suspensa) alteracoes.push({ id: boleto.id, de: boleto.numero_parcela, para: maiorPago + i + 1, novaData: novaData.toISOString().slice(0, 10) });
    }
    await supabase.from("clientes").update({ quantidade_parcelas: totalContrato }).eq("id", params.id);
    await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "suspendeu_parcelas", entidade: "clientes", entidade_id: params.id, detalhes: { parcelas: selecionadas.map((b) => b.numero_parcela), realocadas: alteracoes, regra: "parcelas abertas selecionadas foram movidas para o final; parcelas pagas preservadas" } });
    await avisarCliente(params.id, { tipo: "parcelamento_atualizado", suspensas: ids.length });
    return NextResponse.json({ sucesso: true, mensagem: `${ids.length} parcela(s) suspensa(s) e realocada(s) para o final.` });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
