import { NextRequest, NextResponse } from "next/server";
import { cargoValido } from "@/lib/colaboradores";
import { getAdminOperator } from "@/lib/admin-access";

export async function GET() {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const { data, error } = await sessao.service!.from("mensagens_motivacionais").select("id, cargo, titulo, mensagem, programada_para, ativo, created_at, updated_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ mensagens: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const titulo = String(body.titulo ?? "").trim();
  const mensagem = String(body.mensagem ?? "").trim();
  const cargo = body.cargo === "" || body.cargo == null ? null : body.cargo;
  if (!titulo || !mensagem || (cargo !== null && (!cargoValido(cargo) || cargo === "administrativo"))) return NextResponse.json({ erro: "Título, mensagem e cargo válido são obrigatórios." }, { status: 400 });
  const { data, error } = await sessao.service!.from("mensagens_motivacionais").insert({ titulo, mensagem, cargo, programada_para: body.programadaPara || null, ativo: body.ativo !== false, created_by: sessao.user!.id }).select("id, cargo, titulo, mensagem, programada_para, ativo").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ mensagem: data }, { status: 201 });
}