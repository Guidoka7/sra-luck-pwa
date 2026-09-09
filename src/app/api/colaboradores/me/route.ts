import { NextResponse } from "next/server";
import { getColaboradorSessao } from "@/lib/colaboradores";

export async function GET() {
  const sessao = await getColaboradorSessao();
  if (sessao.motivo === "configuracao_ausente") return NextResponse.json({ erro: "Integração Supabase não configurada neste ambiente." }, { status: 503 });
  if (sessao.motivo === "nao_autenticado") return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (sessao.motivo === "migration_pendente") return NextResponse.json({ erro: "A estrutura de colaboradores ainda não foi aplicada no Supabase." }, { status: 503 });
  if (!sessao.colaborador) return NextResponse.json({ erro: "Usuário sem perfil de colaborador ativo." }, { status: 403 });
  return NextResponse.json({ colaborador: sessao.colaborador });
}