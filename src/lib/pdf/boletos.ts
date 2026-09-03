import { inflateSync, inflateRawSync } from "node:zlib";

export type CampoExtraido = { valor: string | number | null; origem: string | null; confianca: "alta" | "media" | "baixa" | null; motivo?: "encontrado" | "nao_encontrado_no_texto" | "texto_insuficiente" | "campo_invalido" | "campo_ambiguo" };
export type QualidadeExtracaoPdf = { caracteres: number; palavras: number; numeros: number; linhas: number; fontesToUnicode: number; suficiente: boolean; motivo: string | null };
export type DadosBoletoExtraidos = {
  instituicao_financeira: string | null; codigo_banco: string | null; confianca_banco?: number; metodo_identificacao_banco?: string | null;
  nome_beneficiario: string | null; cpf_cnpj_beneficiario: string | null; nome_pagador: string | null; cpf_pagador: string | null;
  nosso_numero: string | null; numero_documento: string | null; identificador_externo: string | null; linha_digitavel: string | null; codigo_barras: string | null;
  valor: number | null; vencimento: string | null; numero_parcela: number | null; total_parcelas: number | null; texto_extraido: string;
  qualidade_extracao?: QualidadeExtracaoPdf; dados_origem?: Record<string, CampoExtraido>;
};

type Banco = { codigo: string; nome: string; marcadores: string[] };
const BANCOS: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil", marcadores: ["BANCO DO BRASIL", "BB.COM.BR"] },
  { codigo: "033", nome: "Santander", marcadores: ["SANTANDER", "BANCO SANTANDER"] },
  { codigo: "070", nome: "BRB", marcadores: ["BANCO DE BRASILIA", "BANCO DE BRASÍLIA", "BRB"] },
  { codigo: "364", nome: "Efí / Gerencianet", marcadores: ["BANCO EFI", "BANCO EFÍ", "GERENCIANET", "EFI BANK", "EFÍ BANK"] },
  { codigo: "748", nome: "Sicredi", marcadores: ["SICREDI", "COOPERATIVA SICREDI"] },
];
type CMap = Map<number, string>;

function latin1(v: Uint8Array) { return Buffer.from(v).toString("latin1"); }
function clean(v: string) { return v.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[\uD800-\uDFFF]/g, ""); }
function inflate(stream: Buffer, dict: string) { if (!/\/FlateDecode/.test(dict)) return stream; try { return inflateSync(stream); } catch { return stream; } }
function objetos(pdf: Buffer) {
  const raw = latin1(pdf); const out = new Map<number, { dict: string; stream: Buffer | null }>();
  for (const m of raw.matchAll(/(?:^|\n)(\d+)\s+0\s+obj\s*([\s\S]*?)(?:\nendobj\b)/g)) {
    const body = m[2]; const sm = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    out.set(Number(m[1]), sm ? { dict: body.slice(0, body.indexOf("stream")), stream: inflate(Buffer.from(sm[1], "latin1"), body.slice(0, body.indexOf("stream"))) } : { dict: body, stream: null });
  }
  return out;
}
function cmap(stream: Buffer): CMap {
  const text = clean(latin1(stream)); const map: CMap = new Map();
  for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    const a = parseInt(m[1], 16), b = parseInt(m[2], 16); let target = parseInt(m[3], 16); if (b > 0xFFFF) continue;
    for (let c = a; c <= b; c++) map.set(c, String.fromCodePoint(target++));
  }
  for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    const bytes = Buffer.from(m[2], "hex"); let value = ""; for (let i = 0; i + 1 < bytes.length; i += 2) value += String.fromCharCode(bytes.readUInt16BE(i)); map.set(parseInt(m[1], 16), value);
  }
  return map;
}
function mapasUnicode(objs: Map<number, { dict: string; stream: Buffer | null }>) {
  const cmaps = new Map<number, CMap>(); for (const [id, o] of objs) if (o.stream && /begincmap/.test(latin1(o.stream))) { const m = cmap(o.stream); if (m.size) cmaps.set(id, m); }
  const result: CMap[] = []; for (const o of objs.values()) { const ref = o.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/); const m = ref ? cmaps.get(Number(ref[1])) : null; if (m?.size) result.push(m); } return result;
}
function decodeHex(hex: string, maps: CMap[]) {
  const bytes = Buffer.from(hex.replace(/\s+/g, ""), "hex"); if (!bytes.length) return "";
  const candidates = maps.map((map) => { let s = ""; for (let i = 0; i + 1 < bytes.length; i += 2) s += map.get(bytes.readUInt16BE(i)) ?? ""; return s; }).filter(Boolean);
  if (!candidates.length) return latin1(bytes); candidates.sort((a, b) => score(b) - score(a)); return candidates[0];
}
function score(v: string) { return [...v].filter((c) => /[\p{L}\p{N}\s.,:/()%-]/u.test(c)).length * 2; }
function literal(v: string) { return clean(v.replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)))); }
function operadores(stream: string, maps: CMap[]) {
  const out: string[] = []; const push = (src: string) => { let i = 0, depth = 0, esc = false, val = ""; while (i < src.length) { const ch = src[i++]; if (ch === "(" && !esc) { if (depth++) val += ch; else val = ""; } else if (ch === ")" && !esc) { if (--depth === 0) out.push(literal(val)); else val += ch; } else if (ch === "\\" && !esc) { esc = true; val += ch; } else { val += ch; esc = false; } } };
  for (const m of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ|'|")/g)) push(m[0]);
  for (const m of stream.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) push(m[1]);
  for (const m of stream.matchAll(/<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ|'|")/g)) out.push(decodeHex(m[1], maps));
  return out.filter((v) => v.trim());
}
function streams(pdf: Buffer) { const raw = latin1(pdf), out: Buffer[] = []; for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) { const i = m.index ?? 0; const dict = raw.slice(Math.max(0, i - 800), i); out.push(inflate(Buffer.from(m[1], "latin1"), dict)); } return out; }
function normSpaces(v: string) { return clean(v).replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\r?\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }
function quality(text: string, fonts: number): QualidadeExtracaoPdf { const compact = text.replace(/\s+/g, ""); const words = text.match(/[\p{L}]{2,}/gu)?.length ?? 0; const nums = text.match(/\d+/g)?.length ?? 0; const lines = text.split(/\r?\n/).filter(Boolean).length; const chars = compact.length; const numeric = chars > 0 && (compact.match(/\D/g)?.length ?? 0) / chars < .25; const ok = chars >= 80 && words >= 4 && !numeric; return { caracteres: chars, palavras: words, numeros: nums, linhas: lines, fontesToUnicode: fonts, suficiente: ok, motivo: ok ? null : numeric ? "texto dominado por sequências numéricas" : "texto extraído insuficiente" }; }

export function extrairTextoPdf(pdf: Buffer) {
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("O arquivo enviado não é um PDF válido.");
  const objs = objetos(pdf), maps = mapasUnicode(objs); let text = normSpaces(streams(pdf).flatMap((s) => operadores(latin1(s), maps)).join("\n")); let q = quality(text, maps.length);
  if (!q.suficiente) { text = normSpaces([text, clean(latin1(pdf)).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ")].join("\n")); q = quality(text, maps.length); }
  if (!q.suficiente) throw new Error(`PDF SEM TEXTO EXTRAÍVEL: ${q.motivo ?? "qualidade insuficiente"}`); return text;
}
export function normalizarTexto(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
export function somenteDigitos(v: string | null | undefined) { return String(v ?? "").replace(/\D/g, ""); }
function lines(t: string) { return t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); }
function fragmented(v: string) { return v.replace(/(?<=\d)[ .-]+(?=\d)/g, ""); }
function context(t: string, labels: string[], validate: (v: string) => string | number | null) {
  const ls = lines(t), nl = labels.map(normalizarTexto);
  for (let i = 0; i < ls.length; i++) { if (!nl.some((x) => normalizarTexto(ls[i]).includes(x))) continue; const direct = validate(ls[i].replace(new RegExp(`.*?(?:${labels.join("|")})\\s*[:\\-]?\\s*`, "i"), "")); if (direct !== null && ls[i].trim() !== String(direct).trim()) return { valor: direct, origem: ls[i] }; for (let j = i + 1; j < Math.min(i + 25, ls.length); j++) { const v = validate(ls[j]); if (v !== null) return { valor: v, origem: `${ls[i]} → ${ls[j]}` }; } }
  return null;
}
function money(v: string) { const m = v.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i) ?? v.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/); if (!m) return null; const raw = m[1] ?? m[0]; const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "")); return Number.isFinite(n) ? n : null; }
function date(v: string) { const br = v.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/); if (br) return `${br[3]}-${br[2]}-${br[1]}`; const iso = v.match(/\b(\d{4})[\/.-](\d{2})[\/.-](\d{2})\b/); return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null; }
function digits(v: string, min: number, max: number) { const d = somenteDigitos(fragmented(v)); return d.length >= min && d.length <= max ? d : null; }
function textValue(v: string) { const x = v.trim().replace(/^[|:;\-]+\s*/, ""); return x && !/^(não|nao|n\/a|-)$/i.test(x) ? x : null; }
function linha(t: string) { return [...t.matchAll(/(?:\d[\s.-]?){47,48}/g)].map((m) => somenteDigitos(m[0])).find((x) => x.length === 47 || x.length === 48) ?? null; }
function barcode(t: string, l: string | null) { const c = [...t.matchAll(/\b\d{44}\b/g)].map((m) => m[0]); if (l?.length === 47) { const r = `${l.slice(0, 4)}${l.slice(32, 33)}${l.slice(33)}${l.slice(4, 9)}${l.slice(10, 20)}${l.slice(21, 31)}`; if (r.length === 44) c.unshift(r); } return c[0] ?? null; }
export function identificarInstituicao(text: string, line: string | null) {
  const n = normalizarTexto(text), ev: Array<{ b: Banco; p: number; m: string }> = [];
  for (const b of BANCOS) { if (line?.slice(0, 3) === b.codigo) ev.push({ b, p: 80, m: "codigo_bancario_linha_digitavel" }); const hits = b.marcadores.filter((x) => n.includes(normalizarTexto(x))); if (hits.length) ev.push({ b, p: Math.min(75, 45 + hits.length * 15), m: "texto_identificador_instituicao" }); }
  if (!ev.length) return { nome: null, codigo: null, confianca: 0, origem: null }; const grouped = new Map<string, { b: Banco; p: number; m: string[] }>(); for (const e of ev) { const x = grouped.get(e.b.codigo) ?? { b: e.b, p: 0, m: [] }; x.p += e.p; x.m.push(e.m); grouped.set(e.b.codigo, x); }
  const sorted = [...grouped.values()].sort((a, b) => b.p - a.p), best = sorted[0], second = sorted[1]; if (second && second.p >= best.p - 10) return { nome: null, codigo: null, confianca: 0, origem: "evidências conflitantes" };
  return { nome: best.b.nome, codigo: best.b.codigo, confianca: Math.min(99, best.p), origem: [...new Set(best.m)].join("+") };
}
function field(r: { valor: string | number | null; origem: string } | null, missing: CampoExtraido["motivo"]): CampoExtraido { return r ? { valor: r.valor, origem: r.origem, confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing }; }
export function extrairDadosBoleto(pdf: Buffer): DadosBoletoExtraidos {
  const text = extrairTextoPdf(pdf), l = linha(text), b = identificarInstituicao(text, l), get = (ls: string[], v: (x: string) => string | number | null) => context(text, ls, v);
  const nome = get(["Nome do pagador", "Pagador", "Cliente"], textValue), cpf = get(["CPF do pagador", "CPF/CNPJ", "CPF"], (v) => digits(v, 11, 14));
  const nosso = get(["Nosso Número", "Nosso Numero"], (v) => digits(v, 3, 30)), doc = get(["Número do Documento", "Numero do Documento", "Nº do Documento", "Documento"], (v) => digits(v, 1, 30));
  const ext = get(["Identificador externo", "Referência adicional", "Referencia adicional", "Referência"], textValue), valor = get(["Valor do Documento", "Valor a pagar", "Valor Cobrado", "Valor"], money);
  const venc = get(["Data de Vencimento", "Vencimento", "Vencimento do Documento"], date), ben = get(["Nome do beneficiário", "Nome do beneficiario", "Beneficiário", "Beneficiario"], textValue);
  const cpfBen = get(["CPF/CNPJ do beneficiário", "CNPJ do beneficiário", "CNPJ"], (v) => digits(v, 11, 14)), parc = text.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/), bar = barcode(text, l), q = quality(text, 0), missing = q.suficiente ? "nao_encontrado_no_texto" : "texto_insuficiente";
  const origem: Record<string, CampoExtraido> = { nome_pagador: field(nome, missing), cpf_pagador: field(cpf, missing), nosso_numero: field(nosso, missing), numero_documento: field(doc, missing), identificador_externo: field(ext, missing), valor: field(valor, missing), vencimento: field(venc, missing), nome_beneficiario: field(ben, missing), cpf_cnpj_beneficiario: field(cpfBen, missing), instituicao_financeira: { valor: b.nome, origem: b.origem, confianca: b.nome ? (b.confianca >= 80 ? "alta" : "media") : null, motivo: b.nome ? "encontrado" : "nao_encontrado_no_texto" }, linha_digitavel: { valor: l, origem: l ? "sequência numérica compatível" : null, confianca: l ? "media" : null, motivo: l ? "encontrado" : "nao_encontrado_no_texto" }, codigo_barras: { valor: bar, origem: bar ? "código de barras de 44 dígitos" : null, confianca: bar ? "media" : null, motivo: bar ? "encontrado" : "nao_encontrado_no_texto" } };
  return { instituicao_financeira: b.nome, codigo_banco: b.codigo, confianca_banco: b.confianca, metodo_identificacao_banco: b.origem, nome_beneficiario: typeof ben?.valor === "string" ? ben.valor : null, cpf_cnpj_beneficiario: typeof cpfBen?.valor === "string" ? cpfBen.valor : null, nome_pagador: typeof nome?.valor === "string" ? nome.valor : null, cpf_pagador: typeof cpf?.valor === "string" ? cpf.valor : null, nosso_numero: typeof nosso?.valor === "string" ? nosso.valor : null, numero_documento: typeof doc?.valor === "string" ? doc.valor : null, identificador_externo: typeof ext?.valor === "string" ? ext.valor : null, linha_digitavel: l, codigo_barras: bar, valor: typeof valor?.valor === "number" ? valor.valor : null, vencimento: typeof venc?.valor === "string" ? venc.valor : null, numero_parcela: parc ? Number(parc[1]) : null, total_parcelas: parc ? Number(parc[2]) : null, texto_extraido: text, qualidade_extracao: q, dados_origem: origem };
}
export function normalizarNome(v: string | null | undefined) { return normalizarTexto(String(v ?? "")).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export function normalizarCpf(v: string | null | undefined) { return somenteDigitos(v); }
