import { NextRequest, NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const agora = new Date();
  const ano = Number(body.ano ?? agora.getFullYear());
  const mes = Number(body.mes ?? agora.getMonth() + 1);
  const metaMinima = Number(body.metaMinima ?? 0);
  const percentual = body.percentualComissao === null || body.percentualComissao === "" || body.percentualComissao === undefined ? null : Number(body.percentualComissao);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isFinite(metaMinima) || metaMinima < 0 || (percentual !== null && (!Number.isFinite(percentual) || percentual < 0))) return NextResponse.json({ erro: "Meta ou percentual inválido." }, { status: 400 });
  const { data, error } = await sessao.service!.from("metas_colaboradores").upsert({ colaborador_id: params.id, ano, mes, meta_minima: metaMinima, percentual_comissao: percentual }, { onConflict: "colaborador_id,ano,mes" }).select("id, colaborador_id, ano, mes, meta_minima, percentual_comissao, comissao_estimada, comissao_final").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ meta: data });
}