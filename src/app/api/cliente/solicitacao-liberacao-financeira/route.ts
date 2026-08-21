import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

const TAXA_CARTAO = 0.054;
const FORMAS = ["cartao", "pix", "cheques"] as const;
type Forma = (typeof FORMAS)[number];

async function clienteDaSessao(req: NextRequest) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  return verificarTokenSessao(token);
}

export async function GET(req: NextRequest) {
  const sessao = await clienteDaSessao(req);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("solicitacoes_liberacao_financeira")
    .select("id, forma_custeio, saldo_restante, taxa_cartao, total_com_taxa, status, observacao, created_at, updated_at")
    .eq("cliente_id", sessao.clienteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ solicitacao: data ?? null });
}

export async function POST(req: NextRequest) {
  const sessao = await clienteDaSessao(req);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const formaCusteio = body.formaCusteio as Forma | undefined;
  if (!formaCusteio || !FORMAS.includes(formaCusteio)) return NextResponse.json({ erro: "Escolha uma forma de custeio válida." }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  const { data: cliente, error: erroCliente } = await supabase.from("clientes").select("id, nome_completo, status_revisao_financeira").eq("id", sessao.clienteId).single();
  if (erroCliente || !cliente) return NextResponse.json({ erro: "Cliente não encontrada." }, { status: 404 });
  if (cliente.status_revisao_financeira !== "aprovada") return NextResponse.json({ erro: "A solicitação só pode ser enviada após a liberação da agenda." }, { status: 409 });
  const { data: boletos, error: erroBoletos } = await supabase.from("boletos").select("valor, status").eq("cliente_id", cliente.id);
  if (erroBoletos) return NextResponse.json({ erro: "Não foi possível calcular o saldo restante." }, { status: 500 });
  const saldoRestante = (boletos ?? []).filter((b: { status: string }) => b.status !== "pago").reduce((total: number, b: { valor: number }) => total + Number(b.valor || 0), 0);
  const taxaCartao = formaCusteio === "cartao" ? saldoRestante * TAXA_CARTAO : 0;
  const totalComTaxa = saldoRestante + taxaCartao;
  const { data: existente } = await supabase.from("solicitacoes_liberacao_financeira").select("id, status").eq("cliente_id", cliente.id).in("status", ["pendente", "em_analise"]).maybeSingle();
  if (existente) return NextResponse.json({ erro: "Sua solicitação já está em análise.", solicitacao: existente }, { status: 409 });
  const { data, error } = await supabase.from("solicitacoes_liberacao_financeira").insert({ cliente_id: cliente.id, forma_custeio: formaCusteio, saldo_restante: Math.round(saldoRestante * 100) / 100, taxa_cartao: Math.round(taxaCartao * 100) / 100, total_com_taxa: Math.round(totalComTaxa * 100) / 100, status: "pendente" }).select("id, forma_custeio, saldo_restante, taxa_cartao, total_com_taxa, status, created_at").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  await supabase.from("logs_alteracoes").insert({ usuario: `cliente:${cliente.id}`, acao: "solicitou_liberacao_financeira", entidade: "solicitacoes_liberacao_financeira", entidade_id: data.id, detalhes: { cliente: cliente.nome_completo, formaCusteio, saldoRestante, taxaCartao, totalComTaxa } });
  return NextResponse.json({ solicitacao: data });
}
