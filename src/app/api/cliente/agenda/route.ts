import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  const supabase = createServiceSupabaseClient();

  const { data: cliente } = await supabase.from("clientes")
    .select("id, nome_completo, procedimento, valor_contrato, status_revisao_financeira, financeiro_saldo_restante, financeiro_taxa_cartao, financeiro_total_com_taxa, financeiro_formas_custeio")
    .eq("id", sessao.clienteId).single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });

  const { data: agendamentoAtivo } = await supabase.from("agendamentos")
    .select("id, data_id, status, previsao_liberacao_financeira, datas(data)")
    .eq("cliente_id", cliente.id).eq("status", "confirmado").maybeSingle();

  const { data: solicitacao } = await supabase.from("solicitacoes_liberacao_financeira")
    .select("id, forma_custeio, saldo_restante, taxa_cartao, total_com_taxa, status, observacao, agendamento_id, created_at, updated_at")
    .eq("cliente_id", cliente.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: datasDisponiveis } = await supabase.from("datas")
    .select("id, data, vagas_totais").eq("status", "disponivel").gte("data", hoje).order("data", { ascending: true });
  const { data: agendamentosAtivos } = await supabase.from("agendamentos").select("data_id").eq("status", "confirmado");
  const ocupacaoPorData = new Map<string, number>();
  for (const a of agendamentosAtivos ?? []) ocupacaoPorData.set(a.data_id, (ocupacaoPorData.get(a.data_id) ?? 0) + 1);
  const datas = (datasDisponiveis ?? []).map((d: { id: string; data: string; vagas_totais: number }) => ({ id: d.id, data: d.data, vagasRestantes: Math.max(0, d.vagas_totais - (ocupacaoPorData.get(d.id) ?? 0)) }));

  return NextResponse.json({
    cliente: { id: cliente.id, nome: cliente.nome_completo, procedimento: cliente.procedimento },
    financeiro: {
      statusRevisao: cliente.status_revisao_financeira ?? null,
      saldoRestante: cliente.financeiro_saldo_restante ?? null,
      taxaCartao: cliente.financeiro_taxa_cartao ?? 5.4,
      totalComTaxa: cliente.financeiro_total_com_taxa ?? null,
      formasCusteio: Array.isArray(cliente.financeiro_formas_custeio) ? cliente.financeiro_formas_custeio : [],
    },
    solicitacaoLiberacaoFinanceira: solicitacao ?? null,
    agendamentoAtivo: agendamentoAtivo ? {
      id: agendamentoAtivo.id,
      data: (agendamentoAtivo as any).datas?.data,
      previsaoLiberacaoFinanceira: agendamentoAtivo.previsao_liberacao_financeira ?? null,
    } : null,
    datasDisponiveis: datas,
  });
}
