import { NextRequest, NextResponse } from "next/server";
import { cargoValido } from "@/lib/colaboradores";
import { getAdminOperator } from "@/lib/admin-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.nome !== undefined) updates.nome = String(body.nome).trim();
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo);
  if (body.cargo !== undefined) { if (!cargoValido(body.cargo) || body.cargo === "administrativo") return NextResponse.json({ erro: "Cargo inválido." }, { status: 400 }); updates.cargo = body.cargo; }
  if (body.permissoes !== undefined) updates.permissoes = Array.isArray(body.permissoes) ? body.permissoes.map(String) : [];
  if (!Object.keys(updates).length) return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  const { data, error } = await sessao.service!.from("colaboradores").update(updates).eq("id", params.id).select("id, auth_user_id, nome, email, cargo, ativo, permissoes").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ colaborador: data });
}