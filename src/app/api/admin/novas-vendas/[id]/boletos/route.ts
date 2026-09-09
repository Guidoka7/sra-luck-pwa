import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QUANTIDADE_PARCELAS_OPCOES } from "@/types/database";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data: venda } = await supabase.from("novas_vendas").select("id, cliente_id, quantidade_parcelas, valor_parcela, taxa_administrativa, status").eq("id", params.id).single();
  if (!venda) return NextResponse.json({ erro: "Nova venda não encontrada." }, { status: 404 });
  if (!venda.cliente_id) return NextResponse.json({ erro: "Complete o cadastro antes de gerar os boletos." }, { status: 400 });

  const quantidade = Number(body.quantidadeParcelas ?? venda.quantidade_parcelas);
  const primeiroVencimento = body.primeiroVencimento;
  if (!QUANTIDADE_PARCELAS_OPCOES.includes(quantidade as any)) return NextResponse.json({ erro: "Quantidade de parcelas inválida." }, { status: 400 });
  if (typeof primeiroVencimento !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) return NextResponse.json({ erro: "Informe o 1º vencimento antes de gerar as parcelas." }, { status: 400 });

  const origin = new URL(req.url).origin;
  const internal = await fetch(`${origin}/api/admin/clientes/${venda.cliente_id}/boletos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify({ quantidadeParcelas: quantidade, primeiroVencimento, valorParcela: venda.valor_parcela, taxaPercentual: venda.taxa_administrativa }),
  });
  const result = await internal.json().catch(() => ({}));
  if (!internal.ok) return NextResponse.json({ erro: result.erro ?? "Não foi possível gerar os boletos." }, { status: internal.status });

  const { error } = await supabase.from("novas_vendas").update({ quantidade_parcelas: quantidade, status: "financeiro_concluido" }).eq("id", params.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "concluiu_financeiro_nova_venda", entidade: "novas_vendas", entidade_id: params.id, detalhes: { cliente_id: venda.cliente_id, quantidade_parcelas: quantidade, primeiro_vencimento: primeiroVencimento } });
  return NextResponse.json({ ok: true, status: "financeiro_concluido", boletos: result.boletos ?? [] });
}
