import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classificarConfianca, normalizarDocumento, normalizarTexto, pontuarCandidato, type CandidatoBoleto, type DadosImportacao } from "@/lib/vinculacao-boletos";

function texto(v: unknown) { return String(v ?? "").trim(); }
function historicoItem(acao: string, usuario: string, detalhes: Record<string, unknown> = {}) { return { em: new Date().toISOString(), usuario, acao, detalhes }; }

async function autenticar() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function carregarCandidatos(supabase: any, dados: DadosImportacao) {
  const cpf = normalizarDocumento(dados.cpf_pagador_extraido);
  let clientes: any[] = [];
  if (cpf) {
    const { data } = await supabase.from("clientes").select("id,nome_completo,cpf,telefone").or(`cpf.eq.${cpf},cpf.eq.${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`).limit(10);
    clientes = data ?? [];
  }
  if (!clientes.length && dados.nome_pagador_extraido) {
    const primeiro = normalizarTexto(dados.nome_pagador_extraido).split(" ")[0];
    if (primeiro.length >= 3) {
      const { data } = await supabase.from("clientes").select("id,nome_completo,cpf,telefone").ilike("nome_completo", `%${primeiro}%`).limit(50);
      clientes = data ?? [];
    }
  }

  const clienteIds = clientes.map((c) => c.id);
  let query = supabase.from("boletos").select("id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto,clientes(id,nome_completo,cpf,telefone),carnes(id,identificador_externo,instituicao_financeira,quantidade_parcelas)").limit(500);
  if (clienteIds.length) query = query.in("cliente_id", clienteIds);
  else {
    if (dados.vencimento_extraido) query = query.eq("data_vencimento", dados.vencimento_extraido);
    const valor = Number(dados.valor_extraido);
    if (Number.isFinite(valor)) query = query.gte("valor", valor - 0.01).lte("valor", valor + 0.01);
  }
  const { data: boletos, error } = await query;
  if (error) throw new Error(error.message);
  return (boletos ?? []) as CandidatoBoleto[];
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data: importacao, error: importacaoError } = await supabase.from("importacoes_boletos").select("*").eq("id", params.id).maybeSingle();
  if (importacaoError) return NextResponse.json({ erro: importacaoError.message }, { status: 500 });
  if (!importacao) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });

  const dados: DadosImportacao = {
    cpf_pagador_extraido: importacao.cpf_pagador_extraido,
    nome_pagador_extraido: importacao.nome_pagador_extraido,
    nosso_numero: importacao.nosso_numero,
    identificador_externo: importacao.identificador_externo,
    linha_digitavel: importacao.linha_digitavel,
    codigo_barras: importacao.codigo_barras,
    valor_extraido: importacao.valor_extraido,
    vencimento_extraido: importacao.vencimento_extraido,
    numero_parcela: importacao.numero_parcela,
    instituicao_financeira: importacao.instituicao_financeira,
  };

  const candidatos = await carregarCandidatos(supabase, dados);
  const analisados = candidatos.map((c) => pontuarCandidato(dados, c)).sort((a, b) => b.pontuacao - a.pontuacao);
  const principal = analisados[0] ?? null;
  const nivel = principal ? classificarConfianca(principal.pontuacao) : "baixa";
  const unica = principal ? analisados.filter((c) => c.pontuacao === principal.pontuacao).length === 1 : false;
  const status = principal && principal.pontuacao >= 80 && unica ? "aguardando_confirmacao" : "analisado";
  const analise = {
    executada_em: new Date().toISOString(),
    regras: "CPF + identificadores + valor + vencimento + banco + carnê + nome + parcela",
    candidatos: analisados.slice(0, 10).map((c) => ({ id: c.id, pontuacao: c.pontuacao, percentual: c.percentual, motivos: c.motivos })),
    quantidade_candidatos: analisados.length,
  };
  const historicoAtual = Array.isArray(importacao.historico) ? importacao.historico : [];
  const historico = [...historicoAtual, historicoItem("Análise inteligente executada", user.id, { pontuacao: principal?.pontuacao ?? 0, nivel, candidatos: analisados.length })];
  const { data, error } = await supabase.from("importacoes_boletos").update({ cliente_sugerido_id: principal?.cliente_id ?? null, carne_sugerido_id: principal?.carne_id ?? null, boleto_sugerido_id: principal?.id ?? null, pontuacao_confianca: principal?.pontuacao ?? 0, nivel_confianca: nivel, status_vinculacao: status, analise_detalhada: analise, historico }).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ importacao: data, analise: { principal, candidatos: analisados.slice(0, 10), nivel, status } });
}
