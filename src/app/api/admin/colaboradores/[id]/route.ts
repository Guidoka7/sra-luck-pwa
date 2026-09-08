import { NextRequest, NextResponse } from "next/server";
import { cargoValido } from "@/lib/colaboradores";
import { getAdminOperator } from "@/lib/admin-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  const senha = body.senha !== undefined ? String(body.senha) : null;

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (nome.length < 3) return NextResponse.json({ erro: "Informe um nome válido." }, { status: 400 });
    updates.nome = nome;
  }
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo);
  if (body.cargo !== undefined) {
    if (!cargoValido(body.cargo) || body.cargo === "administrativo") return NextResponse.json({ erro: "Cargo inválido." }, { status: 400 });
    updates.cargo = body.cargo;
  }
  if (body.permissoes !== undefined) updates.permissoes = Array.isArray(body.permissoes) ? body.permissoes.map(String) : [];

  if (senha !== null) {
    if (senha.length < 8) return NextResponse.json({ erro: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });
    const { data: colaborador, error: colaboradorError } = await sessao.service!.from("colaboradores").select("auth_user_id").eq("id", params.id).single();
    if (colaboradorError || !colaborador) return NextResponse.json({ erro: "Colaborador não encontrado." }, { status: 404 });
    const { error: authError } = await sessao.service!.auth.admin.updateUserById(colaborador.auth_user_id, { password: senha });
    if (authError) return NextResponse.json({ erro: authError.message }, { status: 400 });
  }

  if (!Object.keys(updates).length) {
    if (senha !== null) {
      const { data } = await sessao.service!.from("colaboradores").select("id, auth_user_id, nome, email, cargo, ativo, permissoes").eq("id", params.id).single();
      return NextResponse.json({ colaborador: data });
    }
    return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  }

  const { data, error } = await sessao.service!.from("colaboradores").update(updates).eq("id", params.id).select("id, auth_user_id, nome, email, cargo, ativo, permissoes").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ colaborador: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });

  const { data: colaborador, error: colaboradorError } = await sessao.service!
    .from("colaboradores")
    .select("auth_user_id")
    .eq("id", params.id)
    .single();

  if (colaboradorError || !colaborador) return NextResponse.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  const { error: deleteProfileError } = await sessao.service!.from("colaboradores").delete().eq("id", params.id);
  if (deleteProfileError) return NextResponse.json({ erro: deleteProfileError.message }, { status: 400 });

  const { error: deleteAuthError } = await sessao.service!.auth.admin.deleteUser(colaborador.auth_user_id);
  if (deleteAuthError) return NextResponse.json({ erro: `Perfil removido, mas não foi possível remover a conta de acesso: ${deleteAuthError.message}` }, { status: 500 });

  return NextResponse.json({ sucesso: true });
}
