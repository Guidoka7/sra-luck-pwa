import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

const HORARIOS_VALIDOS = new Set(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);
function adicionarDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const body = await req.json();
  const data = body.data as string | undefined;
  const horario = body.horario as string | undefined;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !horario || !HORARIOS_VALIDOS.has(horario)) return NextResponse.json({ erro: "Escolha a data e o horário da cirurgia." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: cliente } = await supabase.from("clientes").select("id").eq("id", sessao.clienteId).single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });

  const { data: agendamento } = await supabase.from("agendamentos").select("id, data_id, previsao_liberacao_financeira, datas(data)").eq("cliente_id", cliente.id).eq("status", "confirmado").maybeSingle();
  if (!agendamento) return NextResponse.json({ erro: "Primeiro escolha a data da assinatura dos termos." }, { status: 409 });

  const dataAssinaturaTermos = (agendamento as any).datas?.data as string | null;
  if (!dataAssinaturaTermos) return NextResponse.json({ erro: "Não foi possível identificar a data da assinatura dos termos." }, { status: 409 });
  const primeiraDataPermitida = adicionarDias(dataAssinaturaTermos, 90);
  if (data < primeiraDataPermitida) return NextResponse.json({ erro: "Essa data ainda não está disponível para esta cliente." }, { status: 409 });

  const { data: solicitacao } = await supabase.from("solicitacoes_liberacao_financeira").select("id, forma_custeio, status").eq("cliente_id", cliente.id).eq("agendamento_id", agendamento.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!solicitacao) return NextResponse.json({ erro: "Informe primeiro como será realizado o custeio do valor restante." }, { status: 409 });

  const { data: dataAlvo } = await supabase.from("datas_liberacao_financeira").select("id, data, status").eq("data", data).single();
  if (!dataAlvo || dataAlvo.status !== "disponivel") return NextResponse.json({ erro: "Essa data não foi liberada pela equipe ou já não está disponível." }, { status: 409 });

  const { count } = await supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "confirmado").eq("previsao_liberacao_financeira", data);
  if ((count ?? 0) > 0) return NextResponse.json({ erro: "Essa data acabou de ser ocupada. Escolha outra data disponível." }, { status: 409 });

  const { error } = await supabase.from("agendamentos").update({ previsao_liberacao_financeira: data }).eq("id", agendamento.id).eq("cliente_id", cliente.id);
  if (error) return NextResponse.json({ erro: "Não foi possível confirmar a data da cirurgia." }, { status: 500 });

  await supabase.from("solicitacoes_liberacao_financeira").update({ updated_at: new Date().toISOString() }).eq("id", solicitacao.id);

  try {
    await supabase.channel("agenda-clientes").send({ type: "broadcast", event: "datas_atualizadas", payload: { acao: "cirurgia_confirmada", data, clienteId: cliente.id, agendamentoId: agendamento.id, horario } });
  } catch {}

  return NextResponse.json({ ok: true, data, horario });
}
