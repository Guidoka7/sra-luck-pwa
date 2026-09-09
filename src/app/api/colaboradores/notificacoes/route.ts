import { NextResponse } from "next/server";
import { getColaboradorSessao } from "@/lib/colaboradores";

export async function GET() {
  const sessao = await getColaboradorSessao();
  if (!sessao.colaborador || !sessao.service) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.motivo === "nao_autenticado" ? 401 : 403 });
  const { data, error } = await sessao.service.from("notificacoes_colaboradores").select("id, tipo, titulo, mensagem, data_referencia, lida, created_at").eq("colaborador_id", sessao.colaborador.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ notificacoes: data ?? [] });
}