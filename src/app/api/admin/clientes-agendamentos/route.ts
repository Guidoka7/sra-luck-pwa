import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * API para listar clientes com agendamentos confirmados
 * Retorna lista para popolar seletor na interface de liberação financeira inteligente
 */

interface ClienteAgendamento {
  agendamentoId: string;
  clienteId: string;
  nome: string;
  previsaoAtual: string | null;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // Buscar todos os agendamentos confirmados com informações de cliente
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(
      "id, cliente_id, valor_contrato, previsao_liberacao_financeira, clientes(id, nome_completo)"
    )
    .eq("status", "confirmado")
    .order("clientes(nome_completo)", { ascending: true });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const clientes: ClienteAgendamento[] = (agendamentos ?? []).map((item: any) => ({
    agendamentoId: item.id,
    clienteId: item.cliente_id,
    nome: item.clientes?.nome_completo ?? "Cliente",
    previsaoAtual: item.previsao_liberacao_financeira,
  }));

  return NextResponse.json({ clientes });
}
