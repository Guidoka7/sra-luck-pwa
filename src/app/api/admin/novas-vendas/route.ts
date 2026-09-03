import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const busca = url.searchParams.get("busca")?.trim() ?? "";

  let query = supabase.from("novas_vendas").select("*").order("data_venda", { ascending: false });
  if (status && ["aguardando_cadastro", "aguardando_boletos", "financeiro_concluido"].includes(status)) query = query.eq("status", status);
  if (busca) query = query.or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const vendas = (data ?? []).map((v) => ({
    ...v,
    valor_contrato: Number(v.valor_contrato),
    valor_parcela: v.valor_parcela == null ? null : Number(v.valor_parcela),
    taxa_administrativa: v.taxa_administrativa == null ? null : Number(v.taxa_administrativa),
  }));

  const { count, error: countError } = await supabase.from("novas_vendas").select("id", { count: "exact", head: true }).neq("status", "financeiro_concluido");
  if (countError) return NextResponse.json({ erro: countError.message }, { status: 500 });

  return NextResponse.json({ vendas, contador: count ?? 0 });
}
