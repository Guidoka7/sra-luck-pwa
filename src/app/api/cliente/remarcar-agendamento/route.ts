import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

const HORARIOS_VALIDOS = new Set(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);

export async function POST(req: NextRequest) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const body = await req.json();
  const dataId = body.dataId as string | undefined;
  const horario = body.horario as string | undefined;
  if (!dataId || !horario || !HORARIOS_VALIDOS.has(horario)) return NextResponse.json({ erro: "Escolha a data e o horário da assinatura." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: cliente } = await supabase.from("clientes").select("id").eq("id", sessao.clienteId).single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });

  const { data: agendamento } = await supabase.from("agendamentos").select("id, data_id").eq("cliente_id", cliente.id).eq("status", "confirmado").maybeSingle();
  if (!agendamento) return NextResponse.json({ erro: "Não existe um agendamento confirmado para alterar." }, { status: 409 });

  const { data: dataAlvo } = await supabase.from("datas").select("id, data, vagas_totais, status").eq("id", dataId).single();
  if (!dataAlvo || dataAlvo.status !== "disponivel") return NextResponse.json({ erro: "Essa data não está mais disponível." }, { status: 409 });

  const { count } = await supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("data_id", dataId).eq("status", "confirmado").neq("id", agendamento.id);
  if ((count ?? 0) >= dataAlvo.vagas_totais) return NextResponse.json({ erro: "As vagas dessa data acabaram de se esgotar." }, { status: 409 });

  const { error } = await supabase.from("agendamentos").update({ data_id: dataId, horario_termos: horario, previsao_liberacao_financeira: null }).eq("id", agendamento.id).eq("cliente_id", cliente.id);
  if (error) return NextResponse.json({ erro: "Não foi possível alterar a data dos termos." }, { status: 500 });

  try { await supabase.channel("agenda-clientes").send({ type: "broadcast", event: "datas_atualizadas", payload: { acao: "agendamento_remarcado", data: dataAlvo.data, dataId: dataAlvo.id, clienteId: cliente.id, agendamentoId: agendamento.id, cirurgiaResetada: true } }); } catch {}
  return NextResponse.json({ ok: true, data: dataAlvo.data, horario, cirurgiaResetada: true });
}
