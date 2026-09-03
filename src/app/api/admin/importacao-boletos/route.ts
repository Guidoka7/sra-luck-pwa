import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizarCpf, normalizarNome } from "@/lib/pdf/boletos";
import { extrairDadosBoletoComFallback } from "@/lib/pdf/interpretador-ia";
import { complementarLeituraCarne } from "@/lib/pdf/complementar-carne";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Candidato = { id: string; pontuacao: number; motivos: string[] };

function texto(v: unknown) { return String(v ?? "").trim(); }
function numero(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function historicoItem(acao: string, detalhes: Record<string, unknown> = {}) {
  return { em: new Date().toISOString(), acao, detalhes };
}
function confianca(pontuacao: number) {
  if (pontuacao >= 85) return "alta";
  if (pontuacao >= 60) return "media";
  if (pontuacao >= 30) return "baixa";
  return "sem_correspondencia";
}
function similaridade(a: string, b: string) {
  const x = normalizarNome(a), y = normalizarNome(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ax = new Set(x.split(/\s+/).filter(Boolean));
  const by = new Set(y.split(/\s+/).filter(Boolean));
  const inter = [...ax].filter((v) => by.has(v)).length;
  return inter / Math.max(ax.size, by.size);
}
function mesmoValor(a: unknown, b: unknown) {
  const x = numero(a), y = numero(b);
  return x !== null && y !== null && Math.abs(x - y) < 0.01;
}
function mesmoTexto(a: unknown, b: unknown) {
  return texto(a).toUpperCase() !== "" && texto(a).toUpperCase() === texto(b).toUpperCase();
}

async function autenticar() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

async function localizarCliente(supabase: any, cpf: string | null, nome: string | null) {
  const nomeNormalizado = normalizarNome(nome);
  const candidatos: any[] = [];

  if (cpf) {
    const cpfFormatado = cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
    const { data, error } = await supabase.from("clientes")
      .select("id,nome_completo,cpf,telefone")
      .or(`cpf.eq.${cpf},cpf.eq.${cpfFormatado}`).limit(20);
    if (error) throw new Error(error.message);
    candidatos.push(...(data ?? []));
  }

  if (nomeNormalizado) {
    const primeiroNome = nomeNormalizado.split(" ")[0];
    const { data, error } = await supabase.from("clientes")
      .select("id,nome_completo,cpf,telefone")
      .ilike("nome_completo", `%${primeiroNome}%`).limit(100);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) if (!candidatos.some((c) => c.id === item.id)) candidatos.push(item);
  }

  const pontuados: Candidato[] = candidatos.map((cliente) => {
    let pontuacao = 0;
    const motivos: string[] = [];
    if (cpf && normalizarCpf(cliente.cpf) === cpf) {
      pontuacao += 100;
      motivos.push("CPF válido e coincidente (+100)");
    } else if (cpf && cliente.cpf) {
      motivos.push("CPF do PDF diverge da cliente candidata");
    }

    const sim = similaridade(nome ?? "", cliente.nome_completo ?? "");
    if (nomeNormalizado && normalizarNome(cliente.nome_completo) === nomeNormalizado) {
      pontuacao += 70;
      motivos.push("Nome normalizado exato (+70)");
    } else if (sim >= 0.8) {
      pontuacao += 60;
      motivos.push("Nome aproximado muito semelhante (+60)");
    } else if (sim >= 0.6) {
      pontuacao += 45;
      motivos.push("Nome aproximado semelhante (+45)");
    } else if (sim >= 0.4) {
      pontuacao += 30;
      motivos.push("Nome parcialmente semelhante (+30)");
    }
    return { id: cliente.id, pontuacao, motivos };
  }).sort((a, b) => b.pontuacao - a.pontuacao);

  const melhor = pontuados[0];
  const segundo = pontuados[1];
  const cliente = melhor && melhor.pontuacao >= 30 && (!segundo || melhor.pontuacao > segundo.pontuacao)
    ? candidatos.find((c) => c.id === melhor.id) ?? null
    : null;

  return {
    cliente,
    confianca: melhor ? confianca(melhor.pontuacao) : "sem_correspondencia",
    pontuacao: melhor?.pontuacao ?? 0,
    motivos: melhor?.motivos ?? [],
    candidatos: pontuados.map((c) => ({
      ...c,
      confianca: confianca(c.pontuacao),
      nome: candidatos.find((x) => x.id === c.id)?.nome_completo ?? null,
    })),
  };
}

async function localizarCarne(supabase: any, clienteId: string, dados: any) {
  const { data, error } = await supabase.from("carnes")
    .select("id,cliente_id,instituicao_financeira,identificador_externo,data_geracao,quantidade_parcelas,valor_parcela,valor_total,status")
    .eq("cliente_id", clienteId)
    .order("data_geracao", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const candidatos = (data ?? []).map((carne: any) => {
    let pontuacao = 0;
    const motivos: string[] = [];
    if (dados.instituicao_financeira && mesmoTexto(carne.instituicao_financeira, dados.instituicao_financeira)) {
      pontuacao += 30;
      motivos.push("Instituição financeira coincide (+30)");
    }
    if (dados.identificador_externo && mesmoTexto(carne.identificador_externo, dados.identificador_externo)) {
      pontuacao += 100;
      motivos.push("Identificador externo coincide (+100)");
    }
    if (dados.total_parcelas && numero(carne.quantidade_parcelas) === numero(dados.total_parcelas)) {
      pontuacao += 20;
      motivos.push("Quantidade de parcelas coincide (+20)");
    }
    if (dados.valor !== null && mesmoValor(carne.valor_parcela, dados.valor)) {
      pontuacao += 20;
      motivos.push("Valor aproximado da parcela coincide (+20)");
    }
    return { ...carne, pontuacao, motivos };
  }).sort((a: any, b: any) => b.pontuacao - a.pontuacao);

  const melhor = candidatos[0];
  const segundo = candidatos[1];
  const carne = melhor && melhor.pontuacao >= 30 && (!segundo || melhor.pontuacao > segundo.pontuacao) ? melhor : null;
  return {
    carne,
    pontuacao: melhor?.pontuacao ?? 0,
    confianca: confianca(melhor?.pontuacao ?? 0),
    motivos: melhor?.motivos ?? [],
    candidatos,
  };
}

async function localizarBoleto(supabase: any, clienteId: string, carneId: string, dados: any) {
  // REGRA CRÍTICA: a busca já está limitada ao cliente e ao carnê identificado.
  const { data, error } = await supabase.from("boletos")
    .select("id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto")
    .eq("cliente_id", clienteId)
    .eq("carne_id", carneId)
    .limit(200);
  if (error) throw new Error(error.message);

  const candidatos = (data ?? []).map((boleto: any) => {
    let pontuacao = 0;
    const motivos: string[] = [];

    if (dados.nosso_numero && mesmoTexto(boleto.identificador_externo, dados.nosso_numero)) {
      pontuacao += 100;
      motivos.push("Nosso Número coincide com identificador do boleto (+100)");
    }
    if (dados.identificador_externo && mesmoTexto(boleto.identificador_externo, dados.identificador_externo)) {
      pontuacao += 100;
      motivos.push("Identificador externo coincide (+100)");
    }
    if (dados.valor !== null && mesmoValor(boleto.valor, dados.valor)) {
      pontuacao += 40;
      motivos.push("Valor coincide (+40)");
    }
    if (dados.vencimento && texto(boleto.data_vencimento) === texto(dados.vencimento)) {
      pontuacao += 40;
      motivos.push("Vencimento coincide (+40)");
    }
    if (dados.numero_parcela !== null && dados.numero_parcela !== undefined && numero(boleto.numero_parcela) === numero(dados.numero_parcela)) {
      pontuacao += 50;
      motivos.push("Número da parcela coincide (+50)");
    }
    if (dados.instituicao_financeira && mesmoTexto(boleto.instituicao_financeira, dados.instituicao_financeira)) {
      pontuacao += 20;
      motivos.push("Instituição financeira coincide (+20)");
    }
    return { ...boleto, pontuacao, motivos };
  }).sort((a: any, b: any) => b.pontuacao - a.pontuacao);

  const melhor = candidatos[0];
  const segundo = candidatos[1];
  const boleto = melhor && melhor.pontuacao >= 30 && (!segundo || melhor.pontuacao > segundo.pontuacao) ? melhor : null;
  return {
    boleto,
    pontuacao: melhor?.pontuacao ?? 0,
    confianca: confianca(melhor?.pontuacao ?? 0),
    motivos: melhor?.motivos ?? [],
    candidatos,
  };
}

function statusInicial(clienteId: string | null, carneId: string | null, boletoId: string | null) {
  return clienteId && carneId && boletoId ? "aguardando_confirmacao" : "aguardando_vinculacao";
}

export async function GET(req: NextRequest) {
  const supabase = await autenticar();
  if (!supabase) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const url = new URL(req.url);
  const status = texto(url.searchParams.get("status"));
  const busca = texto(url.searchParams.get("busca"));
  let query = supabase.from("importacoes_boletos").select(`id,cliente_id,carne_id,boleto_id,instituicao_financeira,nosso_numero,numero_documento,identificador_externo,linha_digitavel,codigo_barras,nome_pagador_extraido,cpf_pagador_extraido,valor_extraido,vencimento_extraido,numero_parcela,status,arquivo_nome,arquivo_tamanho,arquivo_storage_path,erro_detalhes,created_at,updated_at,cliente:clientes!importacoes_boletos_cliente_id_fkey(id,nome_completo,cpf),carne:carnes!importacoes_boletos_carne_id_fkey(id,identificador_externo,instituicao_financeira),boleto:boletos!importacoes_boletos_boleto_id_fkey(id,numero_parcela,total_parcelas,valor,data_vencimento,status)`).order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  if (busca) query = query.or(`nome_pagador_extraido.ilike.%${busca}%,cpf_pagador_extraido.ilike.%${busca}%,nosso_numero.ilike.%${busca}%,identificador_externo.ilike.%${busca}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ importacoes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await autenticar();
  if (!supabase) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("arquivo");
  if (!(file instanceof File)) return NextResponse.json({ erro: "Envie um arquivo PDF no campo 'arquivo'." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ erro: "Apenas arquivos PDF são aceitos." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) return NextResponse.json({ erro: "O PDF deve possuir entre 1 byte e 10 MB." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  try {
    const leituraPdf = await extrairDadosBoletoComFallback(buffer);
    const dadosBrutos = leituraPdf.dados;
    // Segunda camada: carnês multiparcela podem ter os campos dispersos visualmente.
    // Complementamos apenas com valores efetivamente presentes no texto extraído.
    const dados = complementarLeituraCarne(dadosBrutos.texto_extraido, dadosBrutos);
    const clienteMatch = await localizarCliente(supabase, normalizarCpf(dados.cpf_pagador), dados.nome_pagador);
    const clienteId = clienteMatch.cliente?.id ?? null;
    let carneId: string | null = null;
    let boletoId: string | null = null;
    let carneMatch: any = null;
    let boletoMatch: any = null;

    // Encadeamento obrigatório: PDF -> cliente -> carnês da cliente -> boletos do carnê.
    if (clienteId) {
      carneMatch = await localizarCarne(supabase, clienteId, dados);
      carneId = carneMatch.carne?.id ?? null;
      if (carneId) {
        boletoMatch = await localizarBoleto(supabase, clienteId, carneId, dados);
        boletoId = boletoMatch.boleto?.id ?? null;
      }
    }

    const status = statusInicial(clienteId, carneId, boletoId);
    const diagnostico = {
      cliente: { pontuacao: clienteMatch.pontuacao, confianca: clienteMatch.confianca, motivos: clienteMatch.motivos },
      carne: { pontuacao: carneMatch?.pontuacao ?? 0, confianca: carneMatch?.confianca ?? "sem_correspondencia", motivos: carneMatch?.motivos ?? [] },
      boleto: { pontuacao: boletoMatch?.pontuacao ?? 0, confianca: boletoMatch?.confianca ?? "sem_correspondencia", motivos: boletoMatch?.motivos ?? [] },
    };
    const historico = [historicoItem("PDF processado", { diagnostico, cliente_confianca: clienteMatch.confianca, motor_leitura: leituraPdf.motor, aviso_interpretador: leituraPdf.erroIA })];
    const payload = {
      cliente_id: clienteId,
      carne_id: carneId,
      boleto_id: boletoId,
      instituicao_financeira: dados.instituicao_financeira,
      nosso_numero: dados.nosso_numero,
      numero_documento: dados.numero_documento,
      identificador_externo: dados.identificador_externo,
      linha_digitavel: dados.linha_digitavel,
      codigo_barras: dados.codigo_barras,
      nome_pagador_extraido: dados.nome_pagador,
      cpf_pagador_extraido: dados.cpf_pagador,
      valor_extraido: dados.valor,
      vencimento_extraido: dados.vencimento,
      numero_parcela: dados.numero_parcela,
      dados_extraidos: {
        ...dados,
        diagnostico_vinculacao: diagnostico,
        candidatos_cliente: clienteMatch.candidatos,
        candidatos_carne: (carneMatch?.candidatos ?? []).map((c: any) => ({ id: c.id, pontuacao: c.pontuacao, motivos: c.motivos })),
        candidatos_boleto: (boletoMatch?.candidatos ?? []).map((b: any) => ({ id: b.id, pontuacao: b.pontuacao, motivos: b.motivos })),
      },
      arquivo_nome: file.name,
      arquivo_mime: file.type || "application/pdf",
      arquivo_tamanho: file.size,
      arquivo_sha256: sha256,
      status,
      historico,
    };

    const { data, error } = await supabase.from("importacoes_boletos")
      .insert(payload)
      .select("id,status,cliente_id,carne_id,boleto_id,arquivo_nome,created_at")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ erro: "Este boleto/PDF já foi importado anteriormente." }, { status: 409 });
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }
    return NextResponse.json({
      importacao: data,
      dados,
      diagnostico,
      candidatos: {
        cliente: clienteMatch.candidatos,
        carne: carneMatch?.candidatos ?? [],
        boleto: boletoMatch?.candidatos ?? [],
      },
    }, { status: 201 });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao processar o PDF.";
    const { data } = await supabase.from("importacoes_boletos").insert({
      arquivo_nome: file.name,
      arquivo_mime: file.type || "application/pdf",
      arquivo_tamanho: file.size,
      arquivo_sha256: sha256,
      status: "erro",
      erro_detalhes: mensagem,
      dados_extraidos: {},
      historico: [historicoItem("Erro no processamento", { mensagem })],
    }).select("id,status,erro_detalhes,created_at").single();
    if (data) return NextResponse.json({ importacao: data, erro: mensagem }, { status: 422 });
    return NextResponse.json({ erro: mensagem }, { status: 422 });
  }
}
