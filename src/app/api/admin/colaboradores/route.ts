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
  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  const confirmarSenha = String(body.confirmarSenha ?? "");
  const cargo = body.cargo;

  if (!nome || nome.length < 3) return NextResponse.json({ erro: "Informe o nome completo do colaborador." }, { status: 400 });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  if (!cargoValido(cargo) || cargo === "administrativo") return NextResponse.json({ erro: "Cargo inválido." }, { status: 400 });
  if (senha.length < 8) return NextResponse.json({ erro: "A senha inicial deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (senha !== confirmarSenha) return NextResponse.json({ erro: "As senhas não conferem." }, { status: 400 });

  const { data: authResult, error: authError } = await sessao.service!.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, cargo, tipo: "colaborador" },
  });

  if (authError || !authResult.user) {
    const mensagem = authError?.message?.toLowerCase().includes("already") || authError?.message?.toLowerCase().includes("exist")
      ? "Já existe uma conta com este e-mail."
      : authError?.message ?? "Não foi possível criar a conta de acesso.";
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  const authUserId = authResult.user.id;
  const { data, error } = await sessao.service!.from("colaboradores").insert({
    auth_user_id: authUserId,
    nome,
    email,
    cargo,
    ativo: true,
    permissoes: [],
  }).select("id, auth_user_id, nome, email, cargo, ativo, permissoes").single();

  if (error) {
    await sessao.service!.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ erro: error.code === "23505" ? "Este e-mail já possui perfil de colaborador." : error.message }, { status: 400 });
  }

  return NextResponse.json({ colaborador: data }, { status: 201 });
}
