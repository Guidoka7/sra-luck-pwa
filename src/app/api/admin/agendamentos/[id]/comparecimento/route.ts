import { NextRequest, NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

const STATUS = ["compareceu", "nao_compareceu", "pendente"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const status = body.status === undefined ? null : String(body.status) as (typeof STATUS)[number];
  if (status !== null && !STATUS.includes(status)) return NextResponse.json({ erro: "Status de comparecimento inválido." }, { status: 400 });
  if (status === null && body.sdrId === undefined) return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  const { data: atual, error: atualError } = await sessao.service!.from("agendamentos").select("id, sdr_id, comparecimento_status").eq("id", params.id).single();
  if (atualError || !atual) return NextResponse.json({ erro: "Agendamento não encontrado." }, { status: 404 });
  if (status === "nao_compareceu" && atual.comparecimento_status === "compareceu") {
    const { data: comissao } = await sessao.service!.from("comissoes").select("id").eq("agendamento_id", params.id).eq("evento", "comparecimento").maybeSingle();
    if (comissao) return NextResponse.json({ erro: "O comparecimento já gerou comissão e não pode ser desfeito por esta tela." }, { status: 409 });
  }
  const updates: Record<string, unknown> = {};
  if (body.sdrId !== undefined) updates.sdr_id = body.sdrId || null;
  if (status !== null) {
    updates.comparecimento_status = status;
    updates.comparecimento_em = status === "pendente" ? null : new Date().toISOString();
    updates.comparecimento_registrado_por = sessao.user!.id;
  }
  const { data, error } = await sessao.service!.from("agendamentos").update(updates).eq("id", params.id).select("id, comparecimento_status, comparecimento_em, sdr_id").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  let comissao = null;
  if (status === "compareceu") {
    const result = await sessao.service!.rpc("gerar_comissao_sdr_comparecimento", { p_agendamento_id: params.id, p_usuario_id: sessao.user!.id });
    if (result.error) return NextResponse.json({ erro: `Comparecimento salvo, mas a comissão não foi processada: ${result.error.message}` }, { status: 500 });
    comissao = result.data;
  }
  return NextResponse.json({ agendamento: data, comissao });
}