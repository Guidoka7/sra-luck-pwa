import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ClienteAgendamento {
  agendamentoId: string;
  clienteId: string;
  nome: string;
  dataTermos: string | null;
  previsaoAtual: string | null;
  valor: number;
  custeioConfirmado: boolean;
  cirurgiaRealizada: boolean;
  statusFinanceiro: string | null;
  formaCusteio: string | null;
  saldoRestante: number | null;
}

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(
      "id, cliente_id, valor_contrato, previsao_liberacao_financeira, datas(data), clientes(id, nome_completo, status_cirurgia, status_financeiro, custeio_confirmado_em, financeiro_saldo_restante), solicitacoes_liberacao_financeira(forma_custeio, saldo_restante, status, updated_at)"
    )
    .eq("status", "confirmado")
    .order("previsao_liberacao_financeira", { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const clientes: ClienteAgendamento[] = (agendamentos ?? [])
    .map((item: any) => {
      const cliente = item.clientes;
      const solicitacao = Array.isArray(item.solicitacoes_liberacao_financeira)
        ? [...item.solicitacoes_liberacao_financeira].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0]
        : item.solicitacoes_liberacao_financeira;
      return {
        agendamentoId: item.id,
        clienteId: item.cliente_id,
        nome: cliente?.nome_completo ?? "Cliente",
        dataTermos: item.datas?.data ?? null,
        previsaoAtual: item.previsao_liberacao_financeira,
        valor: Number(item.valor_contrato ?? 0),
        custeioConfirmado: Boolean(cliente?.custeio_confirmado_em),
        cirurgiaRealizada: cliente?.status_cirurgia === "realizada",
        statusFinanceiro: cliente?.status_financeiro ?? null,
        formaCusteio: solicitacao?.forma_custeio ?? null,
        saldoRestante: solicitacao?.saldo_restante != null
          ? Number(solicitacao.saldo_restante)
          : (cliente?.financeiro_saldo_restante != null ? Number(cliente.financeiro_saldo_restante) : null),
      };
    })
    .filter((item) => !(item.custeioConfirmado && item.cirurgiaRealizada));

  return NextResponse.json({ clientes });
}
