import { NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

export async function GET() {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const { data, error } = await sessao.service!.from("agendamentos").select("id, cliente_id, sdr_id, comparecimento_status, comparecimento_em, created_at, datas(data), clientes(nome_completo)").eq("status", "confirmado").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ agendamentos: data ?? [] });
}