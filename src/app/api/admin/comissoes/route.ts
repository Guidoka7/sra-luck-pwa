import { NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

export async function GET() {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const { data, error } = await sessao.service!.from("comissoes").select("id, colaborador_id, cargo, cliente_id, agendamento_id, boleto_id, evento, valor, status, created_at, pago_em, colaboradores(nome), clientes(nome_completo)").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ comissoes: data ?? [] });
}