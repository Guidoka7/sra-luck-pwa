import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

async function avisarCliente(clienteId: string, payload: Record<string, unknown>) {
  try {
    const service = createServiceSupabaseClient();
    await service.channel(`notificacoes-cliente:${clienteId}`).send({ type: "broadcast", event: "nova_notificacao", payload });
  } catch (erro) { console.error("Falha no realtime do boleto:", erro); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { acao, observacoes, valor, dataVencimento } = body as { acao?: string; observacoes?: string; valor?: number | string; dataVencimento?: string | null };

  if (valor !== undefined || dataVencimento !== undefined) {
    const { data: atual } = await supabase.from("boletos").select("id, cliente_id, numero_parcela, valor, data_vencimento, status").eq("id", params.id).single();
    if (!atual) return NextResponse.json({ erro: "Boleto não encontrado." }, { status: 404 });
    if (atual.status === "pago") return NextResponse.json({ erro: "Parcelas pagas não podem ser alteradas." }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (valor !== undefined) {
      const valorNumero = Number(valor);
      if (!Number.isFinite(valorNumero) || valorNumero <= 0) return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
      update.valor = valorNumero;
    }
    if (dataVencimento !== undefined) {
      if (dataVencimento !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) return NextResponse.json({ erro: "Data de vencimento inválida." }, { status: 400 });
      update.data_vencimento = dataVencimento || null;
    }
    const { data, error } = await supabase.from("boletos").update(update).eq("id", params.id).select("*").single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "editou_parcela", entidade: "boleto", entidade_id: params.id, detalhes: { cliente_id: atual.cliente_id, numero_parcela: atual.numero_parcela, de: { valor: atual.valor, data_vencimento: atual.data_vencimento }, para: { valor: data.valor, data_vencimento: data.data_vencimento } } });
    await avisarCliente(atual.cliente_id, { tipo: "parcela_atualizada", parcela: atual.numero_parcela });
    return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
  }

  if (!acao || !["confirmar", "rejeitar"].includes(acao)) return NextResponse.json({ erro: "Ação inválida. Use 'confirmar' ou 'rejeitar'." }, { status: 400 });
  const { data: boleto } = await supabase.from("boletos").select("id, cliente_id, numero_parcela, status").eq("id", params.id).single();
  if (!boleto) return NextResponse.json({ erro: "Boleto não encontrado." }, { status: 404 });
  const novoStatus = acao === "confirmar" ? "pago" : "rejeitado";
  const dataPagamento = acao === "confirmar" ? new Date().toISOString().slice(0, 10) : null;
  const { data, error } = await supabase.from("boletos").update({ status: novoStatus, data_pagamento: dataPagamento, observacoes: observacoes || null }).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: acao === "confirmar" ? "confirmou_pagamento" : "rejeitou_pagamento", entidade: "boleto", entidade_id: params.id, detalhes: { cliente_id: boleto.cliente_id, numero_parcela: boleto.numero_parcela } });
  await avisarCliente(boleto.cliente_id, { tipo: "status_parcela_atualizado", parcela: boleto.numero_parcela });
  return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
}
