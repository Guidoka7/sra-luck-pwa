import { NextRequest, NextResponse } from "next/server";
import { cargoValido } from "@/lib/colaboradores";
import { getAdminOperator } from "@/lib/admin-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.titulo !== undefined) updates.titulo = String(body.titulo).trim();
  if (body.mensagem !== undefined) updates.mensagem = String(body.mensagem).trim();
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo);
  if (body.programadaPara !== undefined) updates.programada_para = body.programadaPara || null;
  if (body.cargo !== undefined) { if (body.cargo !== null && body.cargo !== "" && (!cargoValido(body.cargo) || body.cargo === "administrativo")) return NextResponse.json({ erro: "Cargo inválido." }, { status: 400 }); updates.cargo = body.cargo || null; }
  if (!Object.keys(updates).length) return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  const { data, error } = await sessao.service!.from("mensagens_motivacionais").update(updates).eq("id", params.id).select("id, cargo, titulo, mensagem, programada_para, ativo").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ mensagem: data });
}