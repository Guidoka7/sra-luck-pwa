import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

const STATUS = ["pendente", "em_analise", "aprovada", "recusada"] as const;

async function autenticar() {
  const authClient = createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

export async function GET() {
  const user = await autenticar();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("solicitacoes_liberacao_financeira")
    .select("id, cliente_id, forma_custeio, saldo_restante, taxa_cartao, total_com_taxa, status, observacao, created_at, updated_at, clientes(nome_completo, cpf, quantidade_parcelas)")
    .in("status", ["pendente", "em_analise", "aprovada"])
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ solicitacoes: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const user = await autenticar();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = body.id as string | undefined;
  const status = body.status as string | undefined;
  const observacao = typeof body.observacao === "string" ? body.observacao.trim() : null;
  if (!id || !status || !STATUS.includes(status as (typeof STATUS)[number])) return NextResponse.json({ erro: "Solicitação ou status inválido." }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  const { data: atual, error: erroAtual } = await supabase.from("solicitacoes_liberacao_financeira").update({ status, observacao }).eq("id", id).select("id, cliente_id, status, forma_custeio, saldo_restante, taxa_cartao, total_com_taxa").single();
  if (erroAtual) return NextResponse.json({ erro: erroAtual.message }, { status: 500 });
  await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: `solicitacao_liberacao_${status}`, entidade: "solicitacoes_liberacao_financeira", entidade_id: id, detalhes: { status, observacao } });
  return NextResponse.json({ solicitacao: atual });
}
