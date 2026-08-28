import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .from("solicitacoes_remarcacao_agendamento")
    .select("id, tipo, data_id, data_solicitada, horario_termos, status, observacao, created_at, agendamento_id, cliente_id, clientes(nome_completo)")
    .eq("status", "pendente")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ solicitacoes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const id = body.id as string | undefined;
  const acao = body.acao as "aprovar" | "recusar" | undefined;
  if (!id || !acao || !["aprovar", "recusar"].includes(acao)) {
    return NextResponse.json({ erro: "Solicitação ou ação inválida." }, { status: 400 });
  }

  const service = createServiceSupabaseClient();
  const { data: solicitacao } = await service
    .from("solicitacoes_remarcacao_agendamento")
    .select("id, cliente_id, agendamento_id, tipo, data_id, data_solicitada, horario_termos, status")
    .eq("id", id)
    .maybeSingle();
  if (!solicitacao || solicitacao.status !== "pendente") {
    return NextResponse.json({ erro: "Esta solicitação não está mais pendente." }, { status: 409 });
  }

  const agora = new Date().toISOString();
  if (acao === "aprovar") {
    const alteracao = solicitacao.tipo === "termos"
      ? { data_id: solicitacao.data_id, horario_termos: solicitacao.horario_termos }
      : { previsao_liberacao_financeira: solicitacao.data_solicitada };
    const { error: erroAgendamento } = await service.from("agendamentos").update(alteracao).eq("id", solicitacao.agendamento_id);
    if (erroAgendamento) return NextResponse.json({ erro: "Não foi possível aplicar a alteração." }, { status: 500 });
  }

  const { error } = await service
    .from("solicitacoes_remarcacao_agendamento")
    .update({ status: acao === "aprovar" ? "aprovada" : "recusada", analisada_por: user.id, analisada_em: agora, updated_at: agora })
    .eq("id", id);
  if (error) return NextResponse.json({ erro: "Não foi possível concluir a análise." }, { status: 500 });

  try {
    await service.channel("agenda-clientes").send({ type: "broadcast", event: "datas_atualizadas", payload: { acao: "remarcacao_analisada", clienteId: solicitacao.cliente_id, agendamentoId: solicitacao.agendamento_id, status: acao === "aprovar" ? "aprovada" : "recusada" } });
  } catch {}

  return NextResponse.json({ ok: true, status: acao === "aprovar" ? "aprovada" : "recusada" });
}
