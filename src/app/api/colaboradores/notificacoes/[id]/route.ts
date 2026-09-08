import { NextResponse } from "next/server";
import { getColaboradorSessao } from "@/lib/colaboradores";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const sessao = await getColaboradorSessao();
  if (!sessao.colaborador || !sessao.service) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.motivo === "nao_autenticado" ? 401 : 403 });
  const { data, error } = await sessao.service.from("notificacoes_colaboradores").update({ lida: true }).eq("id", params.id).eq("colaborador_id", sessao.colaborador.id).select("id, lida").maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Notificação não encontrada." }, { status: 404 });
  return NextResponse.json({ notificacao: data });
}