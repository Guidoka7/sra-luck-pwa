import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Confirma (libera a agenda) ou recusa (divergência no levantamento
// financeiro) a revisão financeira de uma cliente que atingiu o % de
// pagamento necessário.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { decisao, observacao } = body as { decisao?: string; observacao?: string };

  if (!decisao || !["aprovada", "recusada"].includes(decisao)) {
    return NextResponse.json({ erro: "Decisão inválida. Use 'aprovada' ou 'recusada'." }, { status: 400 });
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome_completo, status_revisao_financeira")
    .eq("id", params.id)
    .single();

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });
  if (cliente.status_revisao_financeira !== "pendente") {
    return NextResponse.json(
      { erro: "Essa cliente não está com uma revisão financeira pendente no momento." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("clientes")
    .update({
      status_revisao_financeira: decisao,
      observacao_revisao_financeira: observacao || null,
    })
    .eq("id", params.id)
    .select("id, nome_completo, status_revisao_financeira")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: decisao === "aprovada" ? "aprovou_revisao_financeira" : "recusou_revisao_financeira",
    entidade: "clientes",
    entidade_id: params.id,
    detalhes: { cliente: cliente.nome_completo, observacao: observacao || null },
  });

  return NextResponse.json({ cliente: data });
}
