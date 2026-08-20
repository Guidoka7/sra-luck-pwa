import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const { dataId } = await req.json();
  if (!dataId) return NextResponse.json({ erro: "Escolha uma data." }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, valor_contrato")
    .eq("id", sessao.clienteId)
    .single();
  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });

  const { data: jaTem } = await supabase
    .from("agendamentos")
    .select("id")
    .eq("cliente_id", cliente.id)
    .eq("status", "confirmado")
    .maybeSingle();
  if (jaTem) {
    return NextResponse.json(
      { erro: "Você já tem uma data confirmada. Fale com a clínica para remarcar." },
      { status: 409 }
    );
  }

  const { data: dataAlvo } = await supabase
    .from("datas")
    .select("id, data, vagas_totais, status")
    .eq("id", dataId)
    .single();
  if (!dataAlvo || dataAlvo.status !== "disponivel") {
    return NextResponse.json({ erro: "Essa data não está mais disponível." }, { status: 409 });
  }

  const { count } = await supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("data_id", dataId)
    .eq("status", "confirmado");

  if ((count ?? 0) >= dataAlvo.vagas_totais) {
    return NextResponse.json({ erro: "As vagas dessa data acabaram de se esgotar." }, { status: 409 });
  }

  const { data: novoAgendamento, error } = await supabase
    .from("agendamentos")
    .insert({
      cliente_id: cliente.id,
      data_id: dataId,
      valor_contrato: cliente.valor_contrato,
      status: "confirmado",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ erro: "Não foi possível confirmar sua data. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, agendamentoId: novoAgendamento.id, data: dataAlvo.data });
}
