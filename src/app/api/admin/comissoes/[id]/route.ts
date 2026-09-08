import { NextRequest, NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!["pendente", "aprovada", "paga"].includes(status)) return NextResponse.json({ erro: "Status de comissão inválido." }, { status: 400 });
  const { data, error } = await sessao.service!.from("comissoes").update({ status, pago_em: status === "paga" ? new Date().toISOString() : null }).eq("id", params.id).select("id, status, pago_em").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ comissao: data });
}