import { NextRequest, NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

type BoletoFinanceiro = {
  id: string;
  cliente_id: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  valor: number;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  carne_id: string | null;
  clientes?: unknown;
};

function isoDate(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function monthKey(value: string | null) {
  return value ? value.slice(0, 7) : null;
}

export async function GET(req: NextRequest) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });

  const params = req.nextUrl.searchParams;
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hojeIso = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
  const inicioMes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
  const inicio = isoDate(params.get("inicio")) ?? inicioMes;
  const fim = isoDate(params.get("fim")) ?? hojeIso;
  const status = params.get("status");
  const clienteId = params.get("cliente_id");

  let query = sessao.service!
    .from("boletos")
    .select("id, cliente_id, numero_parcela, total_parcelas, valor, status, data_vencimento, data_pagamento, observacoes, carne_id, clientes(id, nome_completo, cpf)")
    .order("data_vencimento", { ascending: true });

  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (status && status !== "todos") query = query.eq("status", status);

  const { data: boletos, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });

  const lista: BoletoFinanceiro[] = (boletos ?? []).map((b: any) => ({ ...b, valor: Number(b.valor) }));
  const dentroPeriodo = (date: string | null) => Boolean(date && date >= inicio && date <= fim);
  const vencido = (b: BoletoFinanceiro) => b.status !== "pago" && Boolean(b.data_vencimento && b.data_vencimento < hojeIso);
  const previsto = lista.filter((b) => b.status !== "pago" && dentroPeriodo(b.data_vencimento));
  const recebido = lista.filter((b) => b.status === "pago" && dentroPeriodo(b.data_pagamento));
  const vencidos = lista.filter(vencido);
  const pendentes = lista.filter((b) => b.status === "pendente_confirmacao");

  const totalReceber = previsto.reduce((s, b) => s + b.valor, 0);
  const totalRecebido = recebido.reduce((s, b) => s + b.valor, 0);
  const totalVencido = vencidos.reduce((s, b) => s + b.valor, 0);
  const totalPendente = pendentes.reduce((s, b) => s + b.valor, 0);
  const taxaRecebimento = totalReceber + totalRecebido > 0 ? (totalRecebido / (totalReceber + totalRecebido)) * 100 : 0;
  const taxaInadimplencia = totalReceber + totalVencido > 0 ? (totalVencido / (totalReceber + totalVencido)) * 100 : 0;

  const meses = new Map<string, { previsto: number; recebido: number }>();
  for (const b of lista) {
    const k = monthKey(b.data_vencimento);
    if (k) meses.set(k, { ...(meses.get(k) ?? { previsto: 0, recebido: 0 }), previsto: (meses.get(k)?.previsto ?? 0) + (b.status === "pago" ? 0 : b.valor) });
    const p = monthKey(b.data_pagamento);
    if (b.status === "pago" && p) meses.set(p, { ...(meses.get(p) ?? { previsto: 0, recebido: 0 }), recebido: (meses.get(p)?.recebido ?? 0) + b.valor });
  }
  const serie = Array.from(meses.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, valores]) => ({ mes, ...valores, diferenca: valores.recebido - valores.previsto }));

  const proximosVencimentos = lista.filter((b) => b.status !== "pago" && b.data_vencimento && b.data_vencimento >= hojeIso).slice(0, 12);
  const statusResumo = ["nao_pago", "pendente_confirmacao", "rejeitado", "pago"].map((s) => ({ status: s, quantidade: lista.filter((b) => b.status === s).length, valor: lista.filter((b) => b.status === s).reduce((sum, b) => sum + b.valor, 0) }));

  const { data: comissoes } = await sessao.service!.from("comissoes").select("valor, status, created_at").gte("created_at", `${inicio}T00:00:00`).lte("created_at", `${fim}T23:59:59`);
  const comissoesGeradas = (comissoes ?? []).reduce((s, c) => s + Number(c.valor ?? 0), 0);

  return NextResponse.json({
    periodo: { inicio, fim },
    kpis: { totalReceber, totalRecebido, totalPendente, totalVencido, previsaoRecebimento: totalReceber, taxaRecebimento, taxaInadimplencia, comissoesGeradas },
    serie,
    statusResumo,
    proximosVencimentos,
    contagens: { boletos: lista.length, vencidos: vencidos.length, pendentes: pendentes.length, recebimentos: recebido.length },
  });
}
