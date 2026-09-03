import { inflateSync, inflateRawSync } from "node:zlib";

export type CampoExtraido = {
  valor: string | number | null;
  origem: string | null;
  confianca: "alta" | "media" | "baixa" | null;
  motivo?: "encontrado" | "nao_encontrado_no_texto" | "texto_insuficiente" | "campo_invalido" | "campo_ambiguo";
};
export type QualidadeExtracaoPdf = { caracteres: number; palavras: number; numeros: number; linhas: number; fontesToUnicode: number; suficiente: boolean; motivo: string | null };
export type DadosBoletoExtraidos = {
  instituicao_financeira: string | null; codigo_banco: string | null; confianca_banco?: number; metodo_identificacao_banco?: string | null;
  nome_beneficiario: string | null; cpf_cnpj_beneficiario: string | null; nome_pagador: string | null; cpf_pagador: string | null;
  nosso_numero: string | null; numero_documento: string | null; identificador_externo: string | null; linha_digitavel: string | null; codigo_barras: string | null;
  valor: number | null; vencimento: string | null; numero_parcela: number | null; total_parcelas: number | null; texto_extraido: string;
  qualidade_extracao?: QualidadeExtracaoPdf; dados_origem?: Record<string, CampoExtraido>;
};
type Banco = { codigo: string; nome: string; marcadores: string[] };
type CMap = Map<number, string>;
type Candidato = { valor: string | number; origem: string; pontos: number };

const BANCOS: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil", marcadores: ["BANCO DO BRASIL", "BB.COM.BR"] },
  { codigo: "033", nome: "Santander", marcadores: ["SANTANDER", "BANCO SANTANDER"] },
  { codigo: "070", nome: "BRB", marcadores: ["BANCO DE BRASILIA", "BANCO DE BRASÍLIA", "BRB"] },
  { codigo: "104", nome: "Caixa Econômica Federal", marcadores: ["CAIXA ECONOMICA FEDERAL", "CAIXA ECONÔMICA FEDERAL", "CEF"] },
  { codigo: "237", nome: "Bradesco", marcadores: ["BRADESCO", "BANCO BRADESCO"] },
  { codigo: "341", nome: "Itaú", marcadores: ["ITAU", "ITAÚ", "BANCO ITAU", "BANCO ITAÚ"] },
  { codigo: "364", nome: "Efí / Gerencianet", marcadores: ["BANCO EFI", "BANCO EFÍ", "GERENCIANET", "EFI BANK", "EFÍ BANK"] },
  { codigo: "748", nome: "Sicredi", marcadores: ["SICREDI", "COOPERATIVA SICREDI"] },
];
const latin = (v: Uint8Array) => Buffer.from(v).toString("latin1");
const clean = (v: string) => v.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[\uD800-\uDFFF]/g, "");
function unzip(v: Buffer, dict: string) { if (!/\/FlateDecode/.test(dict)) return v; try { return inflateSync(v); } catch { try { return inflateRawSync(v); } catch { return v; } } }
function getObjects(pdf: Buffer) {
  const raw = latin(pdf), out = new Map<number, { d: string; s: Buffer | null }>();
  for (const m of raw.matchAll(/(?:^|\n)(\d+)\s+0\s+obj\s*([\s\S]*?)(?:\nendobj\b)/g)) {
    const body = m[2], p = body.indexOf("stream");
    if (p < 0) out.set(+m[1], { d: body, s: null });
    else { const d = body.slice(0, p), sm = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/); out.set(+m[1], { d, s: sm ? unzip(Buffer.from(sm[1], "latin1"), d) : null }); }
  }
  return out;
}
function parseCMap(s: Buffer): CMap {
  const t = clean(latin(s)), map: CMap = new Map();
  for (const m of t.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) { const a = parseInt(m[1], 16), b = parseInt(m[2], 16); let u = parseInt(m[3], 16); for (let c = a; c <= b && c <= 0xffff; c++) map.set(c, String.fromCodePoint(u++)); }
  for (const m of t.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) { const b = Buffer.from(m[2], "hex"); let u = ""; for (let i = 0; i + 1 < b.length; i += 2) u += String.fromCharCode(b.readUInt16BE(i)); map.set(parseInt(m[1], 16), u); }
  return map;
}
function unicodeMaps(objects: Map<number, { d: string; s: Buffer | null }>) {
  const cmaps = new Map<number, CMap>();
  for (const [id, o] of objects) if (o.s && /begincmap/.test(latin(o.s))) { const m = parseCMap(o.s); if (m.size) cmaps.set(id, m); }
  const maps: CMap[] = [];
  for (const o of objects.values()) { const r = o.d.match(/\/ToUnicode\s+(\d+)\s+0\s+R/), m = r ? cmaps.get(+r[1]) : null; if (m?.size) maps.push(m); }
  return maps;
}
function scoreText(v: string) { return [...v].filter(c => /[\p{L}\p{N}\s.,:/()%-]/u.test(c)).length; }
function decodeType0(v: string, maps: CMap[]) {
  const b = Buffer.from(v, "latin1"); if (!maps.length || !b.includes(0) || b.length < 2 || b.length % 2) return null;
  const candidates = maps.map(m => { let s = ""; for (let i = 0; i + 1 < b.length; i += 2) s += m.get(b.readUInt16BE(i)) ?? ""; return s; }).filter(Boolean);
  return candidates.sort((a, z) => scoreText(z) - scoreText(a))[0] ?? null;
}
function literal(v: string, maps: CMap[]) { const decoded = clean(v.replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)))); return decodeType0(decoded, maps) ?? decoded; }
function operatorText(stream: string, maps: CMap[]) {
  const out: string[] = [];
  const push = (src: string) => { let i = 0, depth = 0, escaped = false, value = ""; while (i < src.length) { const c = src[i++]; if (escaped) { value += `\\${c}`; escaped = false; continue; } if (c === "\\") { escaped = true; continue; } if (c === "(") { if (depth++) value += c; continue; } if (c === ")") { if (--depth === 0) { out.push(literal(value, maps)); value = ""; continue; } } if (depth) value += c; } };
  for (const m of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ|'|")/g)) push(m[0]);
  for (const m of stream.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) push(m[1]);
  for (const m of stream.matchAll(/<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ|'|")/g)) out.push(decodeType0(m[1], maps) ?? latin(Buffer.from(m[1].replace(/\s+/g, ""), "hex")));
  return out.filter(x => x.trim());
}
function allStreams(pdf: Buffer) { const raw = latin(pdf), out: Buffer[] = []; for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) { const i = m.index ?? 0, d = raw.slice(Math.max(0, i - 800), i); out.push(unzip(Buffer.from(m[1], "latin1"), d)); } return out; }
function spaces(v: string) { return clean(v).replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
function quality(t: string, fonts: number): QualidadeExtracaoPdf {
  const compact = t.replace(/\s+/g, ""), palavras = t.match(/[\p{L}]{2,}/gu)?.length ?? 0, numeros = t.match(/\d+/g)?.length ?? 0, linhas = t.split(/\r?\n/).filter(Boolean).length, chars = compact.length;
  const numeric = chars > 0 && ((compact.match(/\D/g)?.length ?? 0) / chars) < .25, suficiente = chars >= 80 && palavras >= 4 && !numeric;
  return { caracteres: chars, palavras, numeros, linhas, fontesToUnicode: fonts, suficiente, motivo: suficiente ? null : numeric ? "texto dominado por sequências numéricas" : "texto extraído insuficiente" };
}
export function extrairTextoPdf(pdf: Buffer) {
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("O arquivo enviado não é um PDF válido.");
  const objects = getObjects(pdf), maps = unicodeMaps(objects); let text = spaces(allStreams(pdf).flatMap(s => operatorText(latin(s), maps)).join("\n")), q = quality(text, maps.length);
  if (!q.suficiente) { text = spaces([text, clean(latin(pdf)).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ")].join("\n")); q = quality(text, maps.length); }
  if (!q.suficiente) throw new Error(`PDF SEM TEXTO EXTRAÍVEL: ${q.motivo ?? "qualidade insuficiente"}`);
  return { texto: text, qualidade: q };
}
export function normalizarTexto(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
export function somenteDigitos(v: string | null | undefined) { return String(v ?? "").replace(/\D/g, ""); }
export function validarCpf(v: string | null | undefined) {
  const d = somenteDigitos(v); if (d.length !== 11 || /^([0-9])\1{10}$/.test(d)) return false;
  const calc = (len: number) => { let sum = 0; for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; }; return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
function lines(t: string) { return t.split(/\r?\n/).map(x => x.trim()).filter(Boolean); }
function normalizarCampo(v: string) { return normalizarTexto(v).replace(/[^A-Z0-9/ ]/g, " ").replace(/\s+/g, " ").trim(); }
function fragmented(v: string) { return v.replace(/(?<=\d)[ .-]+(?=\d)/g, ""); }
const LABELS = ["PAGADOR", "NOME DO PAGADOR", "CLIENTE", "NOME", "BENEFICIARIO", "BENEFICIÁRIO", "VENCIMENTO", "DATA DE VENCIMENTO", "VENC.", "PAGAR ATE", "PAGAR ATÉ", "VALOR DO DOCUMENTO", "VALOR COBRADO", "VALOR A PAGAR", "VALOR", "TOTAL", "NOSSO NUMERO", "NOSSO NÚMERO", "Nº DO DOCUMENTO", "NUMERO DO DOCUMENTO", "NÚMERO DO DOCUMENTO", "IDENTIFICADOR EXTERNO", "REFERENCIA ADICIONAL", "REFERÊNCIA ADICIONAL", "CNPJ/CPF", "CPF/CNPJ", "CPF DO PAGADOR", "CPF", "PARCELA", "PARCELA/PLANO", "PARCELA/ PLANO", "DATA DE PROCESSAMENTO", "DATA DO DOCUMENTO", "DATA DE EMISSÃO", "DATA DE EMISSAO", "FICHA DE COMPENSAÇÃO", "LOCAL DE PAGAMENTO"];
const LABEL_SET = new Set(LABELS.map(normalizarCampo));
function isLabel(v: string) { return LABEL_SET.has(normalizarCampo(v)); }
function escapeRegExp(v: string) { return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function stripLabel(line: string, labels: string[]) {
  const pattern = labels.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|");
  const match = line.match(new RegExp(`^(?:\\s*)(?:${pattern})\\s*[:\\-]?\\s*(.*)$`, "i"));
  return match?.[1]?.trim() ?? null;
}
function candidateLines(t: string, labels: string[], maxAhead = 10) {
  const ls = lines(t), wanted = labels.map(normalizarCampo), out: Array<{ value: string; origin: string; distance: number; label: string }> = [];
  for (let i = 0; i < ls.length; i++) {
    const current = normalizarCampo(ls[i]), label = wanted.find(x => current === x || current.startsWith(`${x} `));
    if (!label) continue;
    const inline = stripLabel(ls[i], labels);
    if (inline && !isLabel(inline)) out.push({ value: inline, origin: ls[i], distance: 0, label });
    for (let j = i + 1; j < Math.min(ls.length, i + 1 + maxAhead); j++) {
      if (isLabel(ls[j])) break;
      out.push({ value: ls[j], origin: `${ls[i]} → ${ls[j]}`, distance: j - i, label });
    }
  }
  return out;
}
function choose(t: string, labels: string[], validate: (v: string) => string | number | null, base = 50) {
  const candidates: Candidato[] = [];
  for (const c of candidateLines(t, labels)) { const value = validate(c.value); if (value === null || (typeof value === "string" && !value.trim())) continue; const specific = normalizarCampo(c.label) !== "VALOR" && normalizarCampo(c.label) !== "TOTAL" ? 25 : 10; candidates.push({ valor: value, origem: c.origin, pontos: base + specific - c.distance * 4 + (c.distance === 0 ? 12 : 0) }); }
  candidates.sort((a, b) => b.pontos - a.pontos); return candidates[0] ?? null;
}
function money(v: string) {
  const matches = [...v.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2}))/gi), ...v.matchAll(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g)]; if (!matches.length) return null;
  const raw = matches[0][1] ?? matches[0][0], n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "")); return Number.isFinite(n) ? n : null;
}
function date(v: string) { const m = v.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})\b/); if (!m) return null; const day = Number(m[1]), month = Number(m[2]); if (month < 1 || month > 12 || day < 1 || day > 31) return null; const year = m[3].length === 2 ? Number(m[3]) >= 50 ? `19${m[3]}` : `20${m[3]}` : m[3]; const d = new Date(`${year}-${m[2]}-${m[1]}T00:00:00Z`); if (d.getUTCFullYear() !== Number(year) || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null; return `${year}-${m[2]}-${m[1]}`; }
function digits(v: string, min: number, max: number) { const d = somenteDigitos(fragmented(v)); return d.length >= min && d.length <= max ? d : null; }
function textValue(v: string) {
  const x = v.trim().replace(/^[|:;\-]+\s*/, "");
  if (!x || isLabel(x) || /^(não|nao|n\/a|-)$/i.test(x) || !/[\p{L}]/u.test(x)) return null;
  return x;
}
function nomePagador(t: string) {
  const contextual = choose(t, ["Pagador", "Nome do Pagador"], v => { const x = textValue(v); if (!x || /^(CPF|CNPJ|ENDERECO|ENDEREÇO|VENCIMENTO|VALOR|DOCUMENTO|NOSSO NUMERO|LOCAL DE PAGAMENTO)\b/i.test(x)) return null; return x; }, 75);
  if (contextual) return contextual;
  return choose(t, ["Cliente", "Nome"], v => textValue(v), 45);
}
function cpfPagadorContextual(t: string) {
  const explicit = choose(t, ["CPF do Pagador"], v => { const d = digits(v, 11, 11); return d && validarCpf(d) ? d : null; }, 90);
  if (explicit) return explicit;
  const ls = lines(t), out: Candidato[] = [];
  for (let i = 0; i < ls.length; i++) if (/^(?:PAGADOR|NOME DO PAGADOR)$/i.test(normalizarCampo(ls[i]))) for (let j = i; j < Math.min(ls.length, i + 8); j++) {
    const d = digits(ls[j], 11, 11); if (d && validarCpf(d)) out.push({ valor: d, origem: `${ls[i]} → ${ls[j]}`, pontos: 95 - (j - i) * 5 });
    const embedded = ls[j].match(/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/); if (embedded) { const e = somenteDigitos(embedded[0]); if (validarCpf(e)) out.push({ valor: e, origem: `${ls[i]} → ${ls[j]}`, pontos: 95 - (j - i) * 5 }); }
  }
  out.sort((a, b) => b.pontos - a.pontos); return out[0] ?? null;
}
function modulo10(value: string) { let sum = 0, mult = 2; for (let i = value.length - 1; i >= 0; i--) { const n = Number(value[i]) * mult; sum += Math.floor(n / 10) + (n % 10); mult = mult === 2 ? 1 : 2; } return (10 - (sum % 10)) % 10; }
function modulo11Boleto(value: string) { let sum = 0, weight = 2; for (let i = value.length - 1; i >= 0; i--) { sum += Number(value[i]) * weight; weight = weight === 9 ? 2 : weight + 1; } const r = sum % 11; return r === 0 || r === 10 || r === 11 ? 1 : 11 - r; }
function validarLinha47(v: string) {
  if (!/^\d{47}$/.test(v)) return false;
  if (modulo10(v.slice(0, 9)) !== Number(v[9]) || modulo10(v.slice(10, 20)) !== Number(v[20]) || modulo10(v.slice(21, 31)) !== Number(v[31])) return false;
  const barcode = `${v.slice(0, 4)}${v.slice(32, 33)}${v.slice(33)}${v.slice(4, 9)}${v.slice(10, 20)}${v.slice(21, 31)}`;
  return barcode.length === 44 && modulo11Boleto(`${barcode.slice(0, 4)}${barcode.slice(5)}`) === Number(barcode[4]);
}
function validarLinha48(v: string) { if (!/^\d{48}$/.test(v)) return false; for (let i = 0; i < 4; i++) { const bloco = v.slice(i * 12, i * 12 + 11); if (modulo10(bloco) !== Number(v[i * 12 + 11])) return false; } return true; }
function linhaParaCodigoBarras(line: string) { return line.length === 47 ? `${line.slice(0, 4)}${line.slice(32, 33)}${line.slice(33)}${line.slice(4, 9)}${line.slice(10, 20)}${line.slice(21, 31)}` : null; }
function validarCodigoBarras(v: string) { if (!/^\d{44}$/.test(v) || v[0] === "8") return false; return modulo11Boleto(`${v.slice(0, 4)}${v.slice(5)}`) === Number(v[4]); }
function findLine(t: string) { const candidates = [...t.matchAll(/(?:\d[\s.-]?){47,48}/g)].map(m => somenteDigitos(m[0])).filter(x => x.length === 47 || x.length === 48); return candidates.find(x => validarLinha47(x) || validarLinha48(x)) ?? null; }
function findBar(t: string, line: string | null) { const derived = line ? linhaParaCodigoBarras(line) : null; if (derived && validarCodigoBarras(derived)) return derived; const candidates = [...t.matchAll(/\b\d{44}\b/g)].map(m => m[0]); return candidates.find(validarCodigoBarras) ?? null; }
export function identificarInstituicao(text: string, line: string | null) {
  const n = normalizarTexto(text), evidence: Array<{ b: Banco; p: number; m: string }> = [];
  for (const b of BANCOS) { if (line?.slice(0, 3) === b.codigo) evidence.push({ b, p: 85, m: "código bancário na linha digitável" }); if (b.marcadores.some(x => n.includes(normalizarTexto(x)))) evidence.push({ b, p: 55, m: "texto identificador da instituição" }); }
  if (!evidence.length) return { nome: null, codigo: null, confianca: 0, origem: null };
  const grouped = new Map<string, { b: Banco; p: number; m: string[] }>(); for (const e of evidence) { const x = grouped.get(e.b.codigo) ?? { b: e.b, p: 0, m: [] }; x.p += e.p; x.m.push(e.m); grouped.set(e.b.codigo, x); }
  const a = [...grouped.values()].sort((x, y) => y.p - x.p), best = a[0], second = a[1]; if (second && second.p >= best.p - 10) return { nome: null, codigo: null, confianca: 0, origem: "evidências conflitantes" };
  return { nome: best.b.nome, codigo: best.b.codigo, confianca: Math.min(99, best.p), origem: [...new Set(best.m)].join(" + ") };
}
const field = (r: Candidato | null, missing: CampoExtraido["motivo"]): CampoExtraido => r ? { valor: r.valor, origem: r.origem, confianca: r.pontos >= 80 ? "alta" : r.pontos >= 55 ? "media" : "baixa", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing };
function parcelaContextual(t: string) { const r = choose(t, ["Parcela", "Parcela/Plano", "Parcela de"], v => { const m = v.match(/\b(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\b/i); return m ? `${m[1]}/${m[2]}` : null; }, 60); if (!r || typeof r.valor !== "string") return null; const [numero, total] = r.valor.split("/").map(Number); if (!Number.isInteger(numero) || !Number.isInteger(total) || numero < 1 || total < 1 || numero > total) return null; return { numero, total, origem: r.origem, pontos: r.pontos }; }
export type ParcelaExtraidaPdf = {
  pagina: number;
  numero_documento: string | null;
  nosso_numero: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  valor: number | null;
  vencimento: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  texto: string;
  confianca: number;
};

export type ResultadoLeituraPdfBoleto = {
  tipo_documento: "boleto" | "carne";
  quantidade_parcelas_detectadas: number;
  paginas_detectadas: number;
  cliente: { nome: string | null; cpf: string | null };
  instituicao_financeira: string | null;
  codigo_banco: string | null;
  parcelas: ParcelaExtraidaPdf[];
};

function normalizarBlocoPagina(v: string) {
  return spaces(v.replace(/\bRECIBO DO PAGADOR\b/gi, "RECIBO DO PAGADOR"));
}

/**
 * PDFs de carnê normalmente repetem "FICHA DE COMPENSAÇÃO" em cada página.
 * O extractor de baixo nível preserva a ordem dos streams; por isso usamos a
 * repetição como fronteira e nunca tentamos misturar campos de parcelas distintas.
 */
function separarParcelasDoTexto(text: string): string[] {
  const normalized = normalizarBlocoPagina(text);
  const markers = [...normalized.matchAll(/\bFICHA DE COMPENSA(?:ÇÃO|CAO)\b/gi)].map(m => m.index ?? 0);
  if (markers.length >= 2) {
    const chunks: string[] = [];
    for (let i = 0; i < markers.length; i++) {
      const from = i === 0 ? Math.max(0, markers[i] - 1600) : markers[i - 1];
      const to = i + 1 < markers.length ? markers[i + 1] : normalized.length;
      const chunk = normalized.slice(from, to);
      if (chunk.replace(/\s+/g, "").length > 80) chunks.push(chunk);
    }
    return deduplicarBlocos(chunks);
  }
  // Fallback para boletos com QR PIX ou recibo repetido.
  const parts = normalized.split(/(?=\b(?:\d{3}|\d{1,3})[- ]?X\b|\bAUTENTICAÇÃO MECÂNICA\b)/i).filter(p => p.replace(/\s+/g, "").length > 120);
  return parts.length ? deduplicarBlocos(parts) : [normalized];
}

function deduplicarBlocos(blocos: string[]) {
  const seen = new Set<string>();
  return blocos.filter(b => {
    const key = somenteDigitos(b).slice(0, 80) + "|" + b.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cpfEmLinhaPagador(t: string) {
  const direct = t.match(/([A-ZÀ-Ú][A-ZÀ-Ú '\-]{3,})\s*[-–]\s*(\d{11})/i);
  if (direct) {
    const cpf = somenteDigitos(direct[2]);
    return validarCpf(cpf) ? { nome: direct[1].trim(), cpf } : null;
  }
  const pag = nomePagador(t);
  const cpf = cpfPagadorContextual(t);
  return {
    nome: typeof pag?.valor === "string" ? pag.valor : null,
    cpf: cpf?.valor && typeof cpf.valor === "string" && validarCpf(cpf.valor) ? cpf.valor : null,
  };
}

function extrairParcelaDeBloco(bloco: string, pagina: number): ParcelaExtraidaPdf {
  const line = findLine(bloco);
  const nosso = choose(bloco, ["Nosso Número", "Nosso Numero", "Nosso Número / Cód. do Documento"], v => {
    const m = v.match(/\b\d{1,3}\/\d{4,12}(?:-\d)?\b/);
    return m?.[0] ?? digits(v, 3, 30);
  }, 85);
  const doc = choose(bloco, ["Número do Documento", "Numero do Documento", "Nº do Documento"], v => digits(v, 1, 30), 85);
  const valor = choose(bloco, ["Valor do Documento", "Valor Cobrado", "Valor a Pagar", "Valor"], money, 85);
  const venc = choose(bloco, ["Vencimento", "Data de Vencimento", "Venc.", "Pagar até", "Pagar ate"], date, 85);
  const parcela = parcelaContextual(bloco);
  const bar = findBar(bloco, line);
  const fields = [nosso, doc, valor, venc].filter(Boolean).length + (line ? 1 : 0);
  return {
    pagina,
    numero_documento: typeof doc?.valor === "string" ? doc.valor : null,
    nosso_numero: typeof nosso?.valor === "string" ? nosso.valor : null,
    linha_digitavel: line,
    codigo_barras: bar,
    valor: typeof valor?.valor === "number" ? valor.valor : null,
    vencimento: typeof venc?.valor === "string" ? venc.valor : null,
    numero_parcela: parcela?.numero ?? null,
    total_parcelas: parcela?.total ?? null,
    texto: bloco,
    confianca: Math.round((fields / 5) * 100),
  };
}

export function extrairCarnêOuBoleto(pdf: Buffer): ResultadoLeituraPdfBoleto {
  const { texto, qualidade } = extrairTextoPdf(pdf);
  const blocos = separarParcelasDoTexto(texto);
  const parcelas = blocos
    .map((bloco, i) => extrairParcelaDeBloco(bloco, i + 1))
    .filter((p, i, arr) => {
      // Um PDF costuma conter recibo + ficha com os mesmos dados; deduplicamos por identidade.
      const key = [p.numero_documento, p.nosso_numero, p.linha_digitavel, p.vencimento, p.valor].filter(Boolean).join("|");
      return key ? arr.findIndex(x => [x.numero_documento, x.nosso_numero, x.linha_digitavel, x.vencimento, x.valor].filter(Boolean).join("|") === key) === i : true;
    });

  const primeiro = parcelas.find(p => p.confianca >= 40) ?? parcelas[0];
  const clienteInfo = cpfEmLinhaPagador(texto);
  const banco = identificarInstituicao(texto, primeiro?.linha_digitavel ?? findLine(texto));

  return {
    tipo_documento: parcelas.filter(p => p.numero_documento || p.nosso_numero || p.vencimento).length > 1 ? "carne" : "boleto",
    quantidade_parcelas_detectadas: parcelas.filter(p => p.numero_documento || p.nosso_numero || p.vencimento).length,
    paginas_detectadas: Math.max(1, parcelas.length),
    cliente: { nome: clienteInfo?.nome ?? null, cpf: clienteInfo?.cpf ?? null },
    instituicao_financeira: banco.nome,
    codigo_banco: banco.codigo,
    parcelas,
  };
}

export function extrairDadosBoleto(pdf: Buffer): DadosBoletoExtraidos {
  const { texto: text, qualidade } = extrairTextoPdf(pdf);
  const leitura = extrairCarnêOuBoleto(pdf);
  const principal = leitura.parcelas.find(p => p.confianca >= 40) ?? leitura.parcelas[0] ?? null;
  const line = principal?.linha_digitavel ?? findLine(text);
  const banco = identificarInstituicao(text, line);
  const pag = nomePagador(text);
  const contextual = cpfEmLinhaPagador(text);
  const cpfCandidate = contextual?.cpf ?? cpfPagadorContextual(text)?.valor ?? null;
  const cpfValido = typeof cpfCandidate === "string" && validarCpf(cpfCandidate) ? cpfCandidate : null;
  const nosso = principal?.nosso_numero ?? (choose(text, ["Nosso Número", "Nosso Numero"], v => digits(v, 3, 30), 70)?.valor ?? null);
  const doc = principal?.numero_documento ?? (choose(text, ["Número do Documento", "Numero do Documento", "Nº do Documento"], v => digits(v, 1, 30), 65)?.valor ?? null);
  const ext = choose(text, ["Identificador Externo", "Referência Adicional", "Referencia Adicional"], textValue, 65);
  const ben = choose(text, ["Beneficiário", "Beneficiario"], textValue, 55);
  const cpfBen = choose(text, ["CNPJ/CPF", "CPF/CNPJ", "CNPJ"], v => digits(v, 11, 14), 50);
  const missing = qualidade.suficiente ? "nao_encontrado_no_texto" : "texto_insuficiente";
  const origem: Record<string, CampoExtraido> = {
    nome_pagador: contextual?.nome ? { valor: contextual.nome, origem: "pagador identificado no bloco do boleto", confianca: "alta", motivo: "encontrado" } : field(pag, missing),
    cpf_pagador: cpfValido ? { valor: cpfValido, origem: "CPF associado ao pagador", confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing },
    nosso_numero: principal?.nosso_numero ? { valor: principal.nosso_numero, origem: "parcela individual", confianca: "alta", motivo: "encontrado" } : { valor: nosso as any, origem: null, confianca: nosso ? "media" : null, motivo: nosso ? "encontrado" : missing },
    numero_documento: principal?.numero_documento ? { valor: principal.numero_documento, origem: "parcela individual", confianca: "alta", motivo: "encontrado" } : { valor: doc as any, origem: null, confianca: doc ? "media" : null, motivo: doc ? "encontrado" : missing },
    identificador_externo: field(ext, missing),
    valor: principal?.valor != null ? { valor: principal.valor, origem: "parcela individual", confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing },
    vencimento: principal?.vencimento ? { valor: principal.vencimento, origem: "parcela individual", confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing },
    nome_beneficiario: field(ben, missing),
    cpf_cnpj_beneficiario: field(cpfBen, missing),
  };

  const result: DadosBoletoExtraidos & Record<string, unknown> = {
    instituicao_financeira: leitura.instituicao_financeira ?? banco.nome,
    codigo_banco: leitura.codigo_banco ?? banco.codigo,
    confianca_banco: banco.confianca,
    metodo_identificacao_banco: banco.origem,
    nome_beneficiario: typeof ben?.valor === "string" ? ben.valor : null,
    cpf_cnpj_beneficiario: typeof cpfBen?.valor === "string" ? cpfBen.valor : null,
    nome_pagador: contextual?.nome ?? (typeof pag?.valor === "string" ? pag.valor : null),
    cpf_pagador: cpfValido,
    nosso_numero: typeof nosso === "string" ? nosso : null,
    numero_documento: typeof doc === "string" ? doc : null,
    identificador_externo: typeof ext?.valor === "string" ? ext.valor : null,
    linha_digitavel: line,
    codigo_barras: principal?.codigo_barras ?? findBar(text, line),
    valor: principal?.valor ?? null,
    vencimento: principal?.vencimento ?? null,
    numero_parcela: principal?.numero_parcela ?? null,
    total_parcelas: principal?.total_parcelas ?? leitura.quantidade_parcelas_detectadas || null,
    texto_extraido: text,
    qualidade_extracao: qualidade,
    dados_origem: origem,
    tipo_documento: leitura.tipo_documento,
    quantidade_parcelas_detectadas: leitura.quantidade_parcelas_detectadas,
    paginas_detectadas: leitura.paginas_detectadas,
    parcelas_extraidas: leitura.parcelas.map(({ texto, ...p }) => p),
  };
  return result;
}

export function normalizarNome(v: string | null | undefined) { return normalizarTexto(String(v ?? "")).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export function normalizarCpf(v: string | null | undefined) { return somenteDigitos(v); }
