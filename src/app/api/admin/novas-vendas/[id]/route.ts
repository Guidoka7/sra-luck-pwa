import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase.from("novas_vendas").select("*").eq("id", params.id).single();
  if (error || !data) return NextResponse.json({ erro: "Nova venda não encontrada." }, { status: 404 });
  return NextResponse.json({ venda: { ...data, valor_contrato: Number(data.valor_contrato), valor_parcela: data.valor_parcela == null ? null : Number(data.valor_parcela), taxa_administrativa: data.taxa_administrativa == null ? null : Number(data.taxa_administrativa) } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  const fields = ["nome_completo", "cpf", "telefone", "email", "data_venda", "vendedora_responsavel", "valor_contrato", "quantidade_parcelas", "valor_parcela", "taxa_administrativa", "tipo_venda", "origem_venda"];
  for (const field of fields) if (body[field] !== undefined) updates[field] = body[field] === "" ? null : body[field];
  if (body.status && ["aguardando_cadastro", "aguardando_boletos", "financeiro_concluido"].includes(body.status)) updates.status = body.status;
  if (!Object.keys(updates).length) return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  const { data, error } = await supabase.from("novas_vendas").update(updates).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "editou_nova_venda", entidade: "novas_vendas", entidade_id: params.id, detalhes: updates });
  return NextResponse.json({ venda: data });
}
