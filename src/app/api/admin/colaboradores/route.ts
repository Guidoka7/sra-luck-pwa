import { NextRequest, NextResponse } from "next/server";
import { cargoValido } from "@/lib/colaboradores";
import { getAdminOperator } from "@/lib/admin-access";

function erroAdmin(error: string) {
  if (error === "nao_autenticado") return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (error === "migration_pendente") return NextResponse.json({ erro: "A migration de colaboradores ainda não foi aplicada no Supabase." }, { status: 503 });
  return NextResponse.json({ erro: "Apenas o Administrativo pode gerenciar colaboradores." }, { status: 403 });
}

export async function GET() {
  const sessao = await getAdminOperator();
  if (sessao.error) return erroAdmin(sessao.error);
  const { data, error } = await sessao.service!.from("colaboradores").select("id, auth_user_id, nome, email, cargo, ativo, permissoes, created_at").order("nome");
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ colaboradores: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sessao = await getAdminOperator();
  if (sessao.error) return erroAdmin(sessao.error);
  const body = await req.json().catch(() => ({}));
  const authUserId = String(body.authUserId ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const cargo = body.cargo;
  if (!authUserId || !nome || !cargoValido(cargo) || cargo === "administrativo") return NextResponse.json({ erro: "Informe usuário Supabase, nome e um cargo de colaborador válido." }, { status: 400 });
  const { data: authUser, error: authError } = await sessao.service!.auth.admin.getUserById(authUserId);
  if (authError || !authUser.user) return NextResponse.json({ erro: "Usuário Supabase não encontrado. Nenhuma conta foi criada." }, { status: 404 });
  const { data, error } = await sessao.service!.from("colaboradores").insert({ auth_user_id: authUserId, nome, email: authUser.user.email ?? "", cargo, permissoes: [] }).select("id, auth_user_id, nome, email, cargo, ativo, permissoes").single();
  if (error) return NextResponse.json({ erro: error.code === "23505" ? "Este usuário já possui perfil de colaborador." : error.message }, { status: 400 });
  return NextResponse.json({ colaborador: data }, { status: 201 });
}