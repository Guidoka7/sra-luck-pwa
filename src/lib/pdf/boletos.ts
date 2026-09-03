import { inflateSync, inflateRawSync } from "node:zlib";

export type DadosBoletoExtraidos = {
  instituicao_financeira: string | null;
  codigo_banco: string | null;
  nome_beneficiario: string | null;
  cpf_cnpj_beneficiario: string | null;
  nome_pagador: string | null;
  cpf_pagador: string | null;
  nosso_numero: string | null;
  numero_documento: string | null;
  identificador_externo: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  valor: number | null;
  vencimento: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  texto_extraido: string;
};

type Banco = { codigo: string; nome: string; marcadores: string[] };

const BANCOS: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil", marcadores: ["BANCO DO BRASIL", "BB.COM.BR"] },
  { codigo: "033", nome: "Santander", marcadores: ["SANTANDER", "BANCO SANTANDER"] },
  { codigo: "070", nome: "BRB", marcadores: ["BANCO DE BRASILIA", "BANCO DE BRASÍLIA", "BRB"] },
  { codigo: "364", nome: "Efí / Gerencianet", marcadores: ["BANCO EFI", "BANCO EFÍ", "GERENCIANET", "EFI BANK", "EFÍ BANK"] },
  { codigo: "748", nome: "Sicredi", marcadores: ["SICREDI", "COOPERATIVA SICREDI"] },
];

function latin1(bytes: Uint8Array) { return Buffer.from(bytes).toString("latin1"); }

/**
 * PDF pode carregar bytes de controle dentro de strings literais (inclusive
 * via escapes octais). Eles são tolerados pelo parser de PDF, mas alguns,
 * especialmente NUL (\\u0000), não são aceitos pelo jsonb do PostgreSQL.
 * Mantemos whitespace útil e removemos somente caracteres de controle.
 */
function sanitizarTexto(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFFFE|\uFFFF/g, "")
    .replace(/[\uD800-\uDFFF]/g, "");
}

function decodificarLiteral(value: string) {
  return sanitizarTexto(
    value
      .replace(/\\([\\()])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
  );
}

function decodificarHex(value: string) {
  const clean = value.replace(/\s+/g, "");
  const even = clean.length % 2 ? `${clean}0` : clean;
  return sanitizarTexto(Buffer.from(even, "hex").toString("latin1"));
}

function extrairStringsDeOperadores(stream: string) {
  const out: string[] = [];
  const pushLiteralStrings = (source: string) => {
    let i = 0;
    while (i < source.length) {
      if (source[i] !== "(") { i += 1; continue; }
      i += 1; let depth = 1; let escaped = false; let value = "";
      while (i < source.length && depth > 0) {
        const ch = source[i++];
        if (escaped) { value += `\\${ch}`; escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === "(") { depth += 1; value += ch; continue; }
        if (ch === ")") { depth -= 1; if (depth === 0) break; value += ch; continue; }
        value += ch;
      }
      out.push(decodificarLiteral(value));
    }
  };
  for (const match of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ|'|\")/gs)) pushLiteralStrings(match[0]);
  for (const match of stream.matchAll(/\[(.*?)\]\s*TJ/gs)) pushLiteralStrings(match[1]);
  for (const match of stream.matchAll(/<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ|'|\")/gs)) out.push(decodificarHex(match[1]));
  return out.map(sanitizarTexto).filter((value) => value.trim());
}

function extrairStreams(pdf: Buffer) {
  const raw = latin1(pdf); const streams: Buffer[] = [];
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(regex)) {
    const start = match.index ?? 0; const dictionary = raw.slice(Math.max(0, start - 500), start); const source = Buffer.from(match[1], "latin1");
    if (/\/FlateDecode/.test(dictionary)) {
      try { streams.push(inflateSync(source)); continue; } catch { try { streams.push(inflateRawSync(source)); continue; } catch { /* tenta sem compressão */ } }
    }
    streams.push(source);
  }
  return streams;
}

export function extrairTextoPdf(pdf: Buffer) {
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("O arquivo enviado não é um PDF válido.");
  const chunks = extrairStreams(pdf);
  const textos = chunks.flatMap((chunk) => extrairStringsDeOperadores(latin1(chunk)));
  const fallback = sanitizarTexto(latin1(pdf)).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
  const text = sanitizarTexto([...textos, fallback.match(/[\x20-\x7E\xC0-\xFF\n\r\t]{4,}/g)?.join(" ") ?? ""].join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 20) throw new Error("PDF SEM TEXTO EXTRAÍVEL");
  return text;
}

function normalizarTexto(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
function somenteDigitos(value: string | null | undefined) { return String(value ?? "").replace(/\D/g, ""); }
function capturar(text: string, labels: string[]) { const match = text.match(new RegExp(`(?:${labels.join("|")})\\s*[:\\-]?\\s*([^\\n]{2,100})`, "i")); return match?.[1]?.trim() || null; }
function capturarDigitos(text: string, labels: string[], min: number, max: number) { const value = capturar(text, labels); if (!value) return null; const digits = somenteDigitos(value); return digits.length >= min && digits.length <= max ? digits : null; }
function valorBrasileiro(value: string | null) { if (!value) return null; const clean = value.replace(/R\$\s*/i, "").replace(/\./g, "").replace(",", ".").match(/\d+(?:\.\d{1,2})?/); if (!clean) return null; const number = Number(clean[0]); return Number.isFinite(number) ? number : null; }
function dataIso(value: string | null) { if (!value) return null; const br = value.match(/(\d{2})[\\/.-](\d{2})[\\/.-](\d{4})/); if (br) return `${br[3]}-${br[2]}-${br[1]}`; const iso = value.match(/(\d{4})[\\/.-](\d{2})[\\/.-](\d{2})/); return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null; }
function encontrarLinhaDigitavel(text: string) { const candidates = [...text.matchAll(/(?:\d[ .-]?){47,48}/g)].map((m) => somenteDigitos(m[0])); return candidates.find((digits) => digits.length === 47 || digits.length === 48) ?? null; }
function encontrarCodigoBarras(text: string, linha: string | null) {
  const candidates = [...text.matchAll(/\b\d{44}\b/g)].map((m) => m[0]);
  if (linha?.length === 47) {
    const rebuilt = `${linha.slice(0, 4)}${linha.slice(32, 33)}${linha.slice(33, 47)}${linha.slice(4, 9)}${linha.slice(10, 20)}${linha.slice(21, 31)}`;
    if (rebuilt.length === 44 && !candidates.includes(rebuilt)) candidates.unshift(rebuilt);
  }
  return candidates[0] ?? null;
}

export function identificarInstituicao(text: string, linhaDigitavel: string | null) {
  const normalized = normalizarTexto(text); const byCode = linhaDigitavel?.slice(0, 3) ?? ""; const byCodeMatch = BANCOS.find((banco) => banco.codigo === byCode);
  if (byCodeMatch) return { nome: byCodeMatch.nome, codigo: byCodeMatch.codigo };
  const byMarker = BANCOS.find((banco) => banco.marcadores.some((marker) => normalized.includes(normalizarTexto(marker))));
  return byMarker ? { nome: byMarker.nome, codigo: byMarker.codigo } : { nome: null, codigo: null };
}

export function extrairDadosBoleto(pdf: Buffer): DadosBoletoExtraidos {
  const texto = extrairTextoPdf(pdf); const linha = encontrarLinhaDigitavel(texto); const banco = identificarInstituicao(texto, linha); const barcode = encontrarCodigoBarras(texto, linha);
  const nomePagador = capturar(texto, ["Nome do pagador", "Pagador", "Cliente"]);
  const cpfPagador = capturarDigitos(texto, ["CPF do pagador", "CPF", "CNPJ/CPF"], 11, 14);
  const nossoNumero = capturarDigitos(texto, ["Nosso Número", "Nosso Numero"], 3, 30);
  const numeroDocumento = capturarDigitos(texto, ["Número do Documento", "Numero do Documento", "Nº do Documento"], 1, 30);
  const identificador = capturar(texto, ["Referência adicional", "Referencia adicional", "Identificador externo", "Referência"]);
  const valor = valorBrasileiro(capturar(texto, ["Valor do documento", "Valor a pagar", "Valor"]));
  const vencimento = dataIso(capturar(texto, ["Data de vencimento", "Vencimento"]));
  const beneficiario = capturar(texto, ["Nome do beneficiário", "Nome do beneficiario", "Beneficiário", "Beneficiario"]);
  const cpfBeneficiario = capturarDigitos(texto, ["CPF/CNPJ do beneficiário", "CPF/CNPJ", "CNPJ do beneficiário", "CNPJ"], 11, 14);
  let numeroParcela: number | null = null; let totalParcelas: number | null = null;
  const parcela = texto.match(/parcela\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})/i);
  if (parcela) { numeroParcela = Number(parcela[1]); totalParcelas = Number(parcela[2]); }
  return { instituicao_financeira: banco.nome, codigo_banco: banco.codigo, nome_beneficiario: beneficiario, cpf_cnpj_beneficiario: cpfBeneficiario, nome_pagador: nomePagador, cpf_pagador: cpfPagador, nosso_numero: nossoNumero, numero_documento: numeroDocumento, identificador_externo: identificador, linha_digitavel: linha, codigo_barras: barcode, valor, vencimento, numero_parcela: numeroParcela, total_parcelas: totalParcelas, texto_extraido: texto };
}

export function normalizarNome(value: string | null | undefined) { return normalizarTexto(String(value ?? "")).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export function normalizarCpf(value: string | null | undefined) { return somenteDigitos(value); }
