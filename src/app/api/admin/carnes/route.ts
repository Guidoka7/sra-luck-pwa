import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const INSTITUICOES = ["BRB", "Sicredi", "Santander", "Banco do Brasil", "Efí / Gerencianet"];

function normalizar(v: unknown) { return String(v ?? "").trim(); }
function numero(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const busca = normalizar(url.searchParams.get("busca")).toLowerCase();
  const instituicao = normalizar(url.searchParams.get("instituicao"));
  const status = normalizar(url.searchParams.get("status"));
  const clienteId = normalizar(url.searchParams.get("cliente_id"));
  const inicio = normalizar(url.searchParams.get("inicio"));
  const fim = normalizar(url.searchParams.get("fim"));

  let query = supabase.from("carnes").select(`id, cliente_id, instituicao_financeira, identificador_externo, data_geracao, quantidade_parcelas, valor_parcela, valor_total, status, created_at, updated_at, clientes ( id, nome_completo, cpf, telefone, email ), boletos ( id, numero_parcela, total_parcelas, valor, data_vencimento, status, identificador_externo, origem_boleto )`).order("data_geracao", { ascending: false });
  if (instituicao) query = query.eq("instituicao_financeira", instituicao);
  if (status) query = query.eq("status", status);
  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (inicio) query = query.gte("data_geracao", inicio);
  if (fim) query = query.lte("data_geracao", fim);

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const carnes = (data ?? []).filter((carne: any) => {
    if (!busca) return true;
    const c = carne.clientes;
    return [c?.nome_completo, c?.cpf, c?.telefone, carne.identificador_externo].some((v) => String(v ?? "").toLowerCase().includes(busca));
  }).map((carne: any) => {
    const boletos = Array.isArray(carne.boletos) ? carne.boletos : [];
    const pagas = boletos.filter((b: any) => b.status === "pago").length;
    const pendentes = boletos.length - pagas;
    const valorTotal = Number(carne.valor_total ?? 0);
    return { ...carne, valor_parcela: Number(carne.valor_parcela), valor_total: valorTotal, boletos, parcelas_pagas: pagas, parcelas_pendentes: pendentes };
  });

  return NextResponse.json({ carnes, instituicoes: INSTITUICOES });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clienteId = normalizar(body?.clienteId);
  let instituicao = normalizar(body?.instituicaoFinanceira);
  const identificador = normalizar(body?.identificadorExterno);
  const dataGeracao = normalizar(body?.dataGeracao);
  const parcelas = Array.isArray(body?.parcelas) ? body.parcelas : [];

  if (!clienteId || !instituicao || !identificador || !dataGeracao || parcelas.length === 0) return NextResponse.json({ erro: "Cliente, instituição, identificador, data de geração e parcelas são obrigatórios." }, { status: 400 });
  if (instituicao === "Outro") instituicao = normalizar(body?.outraInstituicao);
  if (!instituicao) return NextResponse.json({ erro: "Informe o nome da instituição financeira." }, { status: 400 });

  const { data: cliente, error: clienteError } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (clienteError) return NextResponse.json({ erro: clienteError.message }, { status: 500 });
  if (!cliente) return NextResponse.json({ erro: "A cliente selecionada não existe." }, { status: 400 });

  const numeros = parcelas.map((p: any) => Number(p.numero)).filter(Number.isInteger);
  if (numeros.length !== parcelas.length || new Set(numeros).size !== numeros.length) return NextResponse.json({ erro: "Os números das parcelas devem ser únicos e válidos." }, { status: 400 });

  const valores = parcelas.map((p: any) => numero(p.valor));
  if (valores.some((v: number) => !Number.isFinite(v) || v < 0)) return NextResponse.json({ erro: "Há valores de parcela inválidos." }, { status: 400 });

  const quantidade = numeros.length;
  const valorParcela = Number(body?.valorParcela);
  const valorTotal = Number(body?.valorTotal);
  if (!Number.isFinite(valorParcela) || valorParcela < 0 || !Number.isFinite(valorTotal) || valorTotal < 0) return NextResponse.json({ erro: "Valor da parcela e valor total são obrigatórios." }, { status: 400 });

  const { data: carne, error: carneError } = await supabase.from("carnes").insert({ cliente_id: clienteId, instituicao_financeira: instituicao, identificador_externo: identificador, data_geracao: dataGeracao, quantidade_parcelas: quantidade, valor_parcela: valorParcela, valor_total: valorTotal, status: "ativo" }).select("id, cliente_id, instituicao_financeira, identificador_externo, data_geracao, quantidade_parcelas, valor_parcela, valor_total, status").single();
  if (carneError) return NextResponse.json({ erro: carneError.message }, { status: carneError.code === "23505" ? 409 : 500 });

  for (const p of parcelas) {
    const n = Number(p.numero);
    const valor = Number(p.valor);
    const identificadorParcela = normalizar(p.identificadorExterno) || null;
    const { data: existente, error: buscaError } = await supabase.from("boletos").select("id, carne_id").eq("cliente_id", clienteId).eq("numero_parcela", n).maybeSingle();
    if (buscaError) return NextResponse.json({ erro: buscaError.message }, { status: 500 });
    if (existente?.carne_id && existente.carne_id !== carne.id) return NextResponse.json({ erro: `A parcela ${n} já está vinculada a outro carnê.` }, { status: 409 });

    const payload = { total_parcelas: quantidade, valor, data_vencimento: normalizar(p.vencimento) || null, carne_id: carne.id, instituicao_financeira: instituicao, identificador_externo: identificadorParcela, origem_boleto: "externo" };
    const result = existente ? await supabase.from("boletos").update(payload).eq("id", existente.id) : await supabase.from("boletos").insert({ cliente_id: clienteId, numero_parcela: n, status: "nao_pago", ...payload });
    if (result.error) return NextResponse.json({ erro: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ carne }, { status: 201 });
}
