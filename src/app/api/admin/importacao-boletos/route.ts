import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extrairDadosBoleto, normalizarCpf, normalizarNome } from "@/lib/pdf/boletos";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function texto(v: unknown) { return String(v ?? "").trim(); }
function numero(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function historicoItem(acao: string, detalhes: Record<string, unknown> = {}) {
  return { em: new Date().toISOString(), acao, detalhes };
}

async function autenticar() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

async function localizarCliente(supabase: any, cpf: string | null, nome: string | null) {
  if (cpf) {
    const cpfFormatado = cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
    const { data, error } = await supabase.from("clientes").select("id,nome_completo,cpf").or(`cpf.eq.${cpf},cpf.eq.${cpfFormatado}`).limit(10);
    if (error) throw new Error(error.message);
    if (data?.length === 1) return { cliente: data[0], confianca: "cpf" as const, candidatos: data };
    if (data?.length > 1) return { cliente: null, confianca: "ambigua" as const, candidatos: data };
  }

  const nomeNormalizado = normalizarNome(nome);
  if (!nomeNormalizado || nomeNormalizado.length < 5) return { cliente: null, confianca: "nenhuma" as const, candidatos: [] };
  const primeiroNome = nomeNormalizado.split(" ")[0];
  const { data, error } = await supabase.from("clientes").select("id,nome_completo,cpf").ilike("nome_completo", `%${primeiroNome}%`).limit(100);
  if (error) throw new Error(error.message);
  const exatos = (data ?? []).filter((cliente: any) => normalizarNome(cliente.nome_completo) === nomeNormalizado);
  if (exatos.length === 1) return { cliente: exatos[0], confianca: "nome" as const, candidatos: exatos };
  return { cliente: null, confianca: exatos.length > 1 ? "ambigua" as const : "nenhuma" as const, candidatos: exatos };
}

async function localizarCarne(supabase: any, clienteId: string, identificador: string | null, instituicao: string | null) {
  let query = supabase.from("carnes").select("id,cliente_id,instituicao_financeira,identificador_externo,data_geracao,quantidade_parcelas,valor_parcela,valor_total,status").eq("cliente_id", clienteId);
  if (identificador) query = query.ilike("identificador_externo", identificador);
  if (instituicao) query = query.ilike("instituicao_financeira", instituicao);
  const { data, error } = await query.order("data_geracao", { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  if (data?.length === 1) return { carne: data[0], candidatos: data };
  return { carne: null, candidatos: data ?? [] };
}

async function localizarBoleto(supabase: any, args: { clienteId: string; carneId: string; identificador: string | null; parcela: number | null; valor: number | null; vencimento: string | null }) {
  const base = () => supabase.from("boletos").select("id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto").eq("cliente_id", args.clienteId).eq("carne_id", args.carneId);

  if (args.identificador) {
    const { data, error } = await base().ilike("identificador_externo", args.identificador).limit(10);
    if (error) throw new Error(error.message);
    if (data?.length === 1) return { boleto: data[0], candidatos: data, criterio: "identificador_externo" };
    if (data?.length > 1) return { boleto: null, candidatos: data, criterio: "identificador_externo" };
  }

  if (args.parcela) {
    const { data, error } = await base().eq("numero_parcela", args.parcela).limit(10);
    if (error) throw new Error(error.message);
    if (data?.length === 1) return { boleto: data[0], candidatos: data, criterio: "numero_parcela" };
    if (data?.length > 1) return { boleto: null, candidatos: data, criterio: "numero_parcela" };
  }

  if (args.valor !== null && args.vencimento) {
    const { data, error } = await base().eq("valor", args.valor).eq("data_vencimento", args.vencimento).limit(10);
    if (error) throw new Error(error.message);
    if (data?.length === 1) return { boleto: data[0], candidatos: data, criterio: "valor_data_vencimento" };
    return { boleto: null, candidatos: data ?? [], criterio: "valor_data_vencimento" };
  }
  return { boleto: null, candidatos: [], criterio: null };
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
  let query = supabase.from("importacoes_boletos").select(`id,cliente_id,carne_id,boleto_id,instituicao_financeira,nosso_numero,numero_documento,identificador_externo,linha_digitavel,codigo_barras,nome_pagador_extraido,cpf_pagador_extraido,valor_extraido,vencimento_extraido,numero_parcela,status,arquivo_nome,arquivo_tamanho,arquivo_storage_path,erro_detalhes,created_at,updated_at,clientes(id,nome_completo,cpf),carnes(id,identificador_externo,instituicao_financeira),boletos(id,numero_parcela,total_parcelas,valor,data_vencimento,status)`).order("created_at", { ascending: false }).limit(200);
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
    const dados = extrairDadosBoleto(buffer);
    const clienteMatch = await localizarCliente(supabase, normalizarCpf(dados.cpf_pagador), dados.nome_pagador);
    const clienteId = clienteMatch.cliente?.id ?? null;
    let carneId: string | null = null;
    let boletoId: string | null = null;
    let carneCandidatos: any[] = [];
    let boletoCandidatos: any[] = [];

    if (clienteId) {
      const carneMatch = await localizarCarne(supabase, clienteId, dados.identificador_externo, dados.instituicao_financeira);
      carneId = carneMatch.carne?.id ?? null;
      carneCandidatos = carneMatch.candidatos;
      if (carneId) {
        const boletoMatch = await localizarBoleto(supabase, {
          clienteId,
          carneId,
          identificador: dados.identificador_externo,
          parcela: dados.numero_parcela,
          valor: dados.valor,
          vencimento: dados.vencimento,
        });
        boletoId = boletoMatch.boleto?.id ?? null;
        boletoCandidatos = boletoMatch.candidatos;
      }
    }

    const status = statusInicial(clienteId, carneId, boletoId);
    const historico = [historicoItem("PDF processado", { cliente_confianca: clienteMatch.confianca })];
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
      dados_extraidos: { ...dados, candidatos_carne: carneCandidatos.map((c) => c.id), candidatos_boleto: boletoCandidatos.map((b) => b.id) },
      arquivo_nome: file.name,
      arquivo_mime: file.type || "application/pdf",
      arquivo_tamanho: file.size,
      arquivo_sha256: sha256,
      status,
      historico,
    };

    const { data, error } = await supabase.from("importacoes_boletos").insert(payload).select("id,status,cliente_id,carne_id,boleto_id,arquivo_nome,created_at").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ erro: "Este boleto/PDF já foi importado anteriormente." }, { status: 409 });
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }
    return NextResponse.json({ importacao: data, dados, candidatos: { cliente: clienteMatch.candidatos, carne: carneCandidatos, boleto: boletoCandidatos } }, { status: 201 });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao processar o PDF.";
    const { data } = await supabase.from("importacoes_boletos").insert({ arquivo_nome: file.name, arquivo_mime: file.type || "application/pdf", arquivo_tamanho: file.size, arquivo_sha256: sha256, status: "erro", erro_detalhes: mensagem, dados_extraidos: {}, historico: [historicoItem("Erro no processamento", { mensagem })] }).select("id,status,erro_detalhes,created_at").single();
    if (data) return NextResponse.json({ importacao: data, erro: mensagem }, { status: 422 });
    return NextResponse.json({ erro: mensagem }, { status: 422 });
  }
}
