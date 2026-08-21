import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Operações em lote da aba Pagamentos.
 * Parcelas pagas nunca entram em operações administrativas de edição.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const acao = body.acao as string | undefined;

  if (!ids.length || ids.length > 500) {
    return NextResponse.json({ erro: "Selecione entre 1 e 500 parcelas." }, { status: 400 });
  }

  const acoes = ["confirmar", "rejeitar", "reabrir", "suspender", "excluir"];
  if (!acao || !acoes.includes(acao)) return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });

  const { data: boletos, error: erroBusca } = await supabase
    .from("boletos")
    .select("id, cliente_id, numero_parcela, total_parcelas, valor, data_vencimento, status, suspensa")
    .in("id", ids);

  if (erroBusca) return NextResponse.json({ erro: erroBusca.message }, { status: 500 });
  if (!boletos?.length) return NextResponse.json({ erro: "Nenhuma parcela encontrada." }, { status: 404 });

  if (["reabrir", "suspender", "excluir"].includes(acao) && boletos.some((b) => b.status === "pago")) {
    return NextResponse.json({ erro: "Parcelas pagas não podem ser alteradas, suspensas ou excluídas." }, { status: 400 });
  }

  if (acao === "confirmar" || acao === "rejeitar") {
    const idsElegiveis = boletos.filter((b) => b.status === "pendente_confirmacao").map((b) => b.id);
    if (!idsElegiveis.length) return NextResponse.json({ erro: "Nenhuma parcela selecionada está aguardando confirmação." }, { status: 400 });
    const novoStatus = acao === "confirmar" ? "pago" : "rejeitado";
    const dataPagamento = acao === "confirmar" ? new Date().toISOString().slice(0, 10) : null;
    const { data: atualizados, error } = await supabase
      .from("boletos")
      .update({ status: novoStatus, data_pagamento: dataPagamento })
      .in("id", idsElegiveis)
      .select("id, cliente_id, numero_parcela, valor, status, data_pagamento");
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    const logs = idsElegiveis.map((id) => {
      const b = boletos.find((item) => item.id === id)!;
      return {
        usuario: user.email ?? "admin",
        acao: acao === "confirmar" ? "confirmou_pagamento" : "rejeitou_pagamento",
        entidade: "boleto",
        entidade_id: id,
        detalhes: { cliente_id: b.cliente_id, numero_parcela: b.numero_parcela },
      };
    });
    await supabase.from("logs_alteracoes").insert(logs);
    return NextResponse.json({ boletos: atualizados ?? [], total: atualizados?.length ?? 0 });
  }

  if (acao === "reabrir") {
    const elegiveis = boletos.filter((b) => b.status !== "pago");
    const { data: atualizados, error } = await supabase
      .from("boletos")
      .update({ status: "nao_pago", data_pagamento: null, suspensa: false })
      .in("id", elegiveis.map((b) => b.id))
      .select("id, cliente_id, numero_parcela, status, valor, data_vencimento");
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    await supabase.from("logs_alteracoes").insert(elegiveis.map((b) => ({
      usuario: user.email ?? "admin",
      acao: "reabriu_parcela",
      entidade: "boleto",
      entidade_id: b.id,
      detalhes: { cliente_id: b.cliente_id, numero_parcela: b.numero_parcela, status_anterior: b.status },
    })));
    return NextResponse.json({ boletos: atualizados ?? [], total: atualizados?.length ?? 0 });
  }

  if (acao === "excluir") {
    const elegiveis = boletos.filter((b) => b.status !== "pago");
    const idsExcluir = elegiveis.map((b) => b.id);
    const { error } = await supabase.from("boletos").delete().in("id", idsExcluir);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    // Preenche os números que ficaram vagos sem tocar nas parcelas pagas.
    const clientes = [...new Set(elegiveis.map((b) => b.cliente_id))];
    for (const clienteId of clientes) {
      const { data: restantes } = await supabase.from("boletos").select("id, numero_parcela, status").eq("cliente_id", clienteId).order("numero_parcela", { ascending: true });
      const abertas = (restantes ?? []).filter((b) => b.status !== "pago");
      const vagas = abertas.map((b) => b.numero_parcela).sort((a, b) => a - b);
      for (let i = 0; i < abertas.length; i++) {
        if (abertas[i].numero_parcela !== vagas[i]) {
          await supabase.from("boletos").update({ numero_parcela: 10000 + i }).eq("id", abertas[i].id);
        }
      }
      for (let i = 0; i < abertas.length; i++) {
        await supabase.from("boletos").update({ numero_parcela: vagas[i], total_parcelas: (restantes ?? []).length }).eq("id", abertas[i].id);
      }
      await supabase.from("clientes").update({ quantidade_parcelas: (restantes ?? []).length }).eq("id", clienteId);
    }

    await supabase.from("logs_alteracoes").insert(elegiveis.map((b) => ({
      usuario: user.email ?? "admin",
      acao: "excluiu_parcela",
      entidade: "boleto",
      entidade_id: b.id,
      detalhes: { cliente_id: b.cliente_id, numero_parcela: b.numero_parcela, valor: b.valor, data_vencimento: b.data_vencimento },
    })));
    return NextResponse.json({ total: idsExcluir.length });
  }

  // Suspender: as parcelas selecionadas vão para o final da sequência de parcelas abertas.
  const selecionadosPorCliente = new Map<string, Set<string>>();
  for (const b of boletos) {
    if (!selecionadosPorCliente.has(b.cliente_id)) selecionadosPorCliente.set(b.cliente_id, new Set());
    selecionadosPorCliente.get(b.cliente_id)!.add(b.id);
  }

  for (const [clienteId, selecionadosCliente] of selecionadosPorCliente) {
    const { data: todas, error } = await supabase
      .from("boletos")
      .select("id, numero_parcela, status, suspensa")
      .eq("cliente_id", clienteId)
      .order("numero_parcela", { ascending: true });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    const abertas = (todas ?? []).filter((b) => b.status !== "pago");
    const vagas = abertas.map((b) => b.numero_parcela).sort((a, b) => a - b);
    const novosAtivos = abertas.filter((b) => !selecionadosCliente.has(b.id) && !b.suspensa);
    const suspensasExistentes = abertas.filter((b) => !selecionadosCliente.has(b.id) && b.suspensa);
    const novasSuspensas = abertas.filter((b) => selecionadosCliente.has(b.id));
    const ordem = [...novosAtivos, ...suspensasExistentes, ...novasSuspensas];

    // Primeiro tira todas as parcelas abertas para uma faixa temporária, evitando conflito de índice único.
    for (let i = 0; i < ordem.length; i++) {
      await supabase.from("boletos").update({ numero_parcela: 10000 + i }).eq("id", ordem[i].id);
    }
    for (let i = 0; i < ordem.length; i++) {
      const id = ordem[i].id;
      const isNovaSuspensa = novasSuspensas.some((b) => b.id === id);
      await supabase.from("boletos").update({
        numero_parcela: vagas[i],
        suspensa: isNovaSuspensa || suspensasExistentes.some((b) => b.id === id),
        suspensa_em: isNovaSuspensa ? new Date().toISOString() : undefined,
        suspensa_por: isNovaSuspensa ? (user.email ?? "admin") : undefined,
      }).eq("id", id);
    }
  }

  await supabase.from("logs_alteracoes").insert(boletos.map((b) => ({
    usuario: user.email ?? "admin",
    acao: "suspendeu_parcela",
    entidade: "boleto",
    entidade_id: b.id,
    detalhes: { cliente_id: b.cliente_id, numero_parcela_anterior: b.numero_parcela, valor: b.valor, data_vencimento: b.data_vencimento, realocada_para_final: true },
  })));

  return NextResponse.json({ total: boletos.length });
}
