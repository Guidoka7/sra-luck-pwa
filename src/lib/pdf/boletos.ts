import { inflateSync, inflateRawSync } from "node:zlib";

export type CampoExtraido = {
  valor: string | number | null;
  origem: string | null;
  confianca: "alta" | "media" | "baixa" | null;
  motivo?: "encontrado" | "nao_encontrado_no_texto" | "texto_insuficiente" | "campo_invalido" | "campo_ambiguo";
};
export type QualidadeExtracaoPdf = {
  caracteres: number; palavras: number; numeros: number; linhas: number;
  fontesToUnicode: number; suficiente: boolean; motivo: string | null;
};
export type DadosBoletoExtraidos = {
  instituicao_financeira: string | null; codigo_banco: string | null;
  confianca_banco?: number; metodo_identificacao_banco?: string | null;
  nome_beneficiario: string | null; cpf_cnpj_beneficiario: string | null;
  nome_pagador: string | null; cpf_pagador: string | null;
  nosso_numero: string | null; numero_documento: string | null; identificador_externo: string | null;
  linha_digitavel: string | null; codigo_barras: string | null; valor: number | null;
  vencimento: string | null; numero_parcela: number | null; total_parcelas: number | null;
  texto_extraido: string; qualidade_extracao?: QualidadeExtracaoPdf;
  dados_origem?: Record<string, CampoExtraido>;
};
type Banco = { codigo: string; nome: string; marcadores: string[] };
type CMap = Map<number, string>;
const BANCOS: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil", marcadores: ["BANCO DO BRASIL", "BB.COM.BR"] },
  { codigo: "033", nome: "Santander", marcadores: ["SANTANDER", "BANCO SANTANDER"] },
  { codigo: "070", nome: "BRB", marcadores: ["BANCO DE BRASILIA", "BANCO DE BRASÍLIA", "BRB"] },
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
    else { const d = body.slice(0, p); const sm = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/); out.set(+m[1], { d, s: sm ? unzip(Buffer.from(sm[1], "latin1"), d) : null }); }
  }
  return out;
}
function parseCMap(s: Buffer): CMap {
  const t = clean(latin(s)), map: CMap = new Map();
  for (const m of t.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    const a = parseInt(m[1], 16), b = parseInt(m[2], 16); let u = parseInt(m[3], 16);
    for (let c = a; c <= b && c <= 0xffff; c++) map.set(c, String.fromCodePoint(u++));
  }
  for (const m of t.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    const b = Buffer.from(m[2], "hex"); let u = "";
    for (let i = 0; i + 1 < b.length; i += 2) u += String.fromCharCode(b.readUInt16BE(i));
    map.set(parseInt(m[1], 16), u);
  }
  return map;
}
function unicodeMaps(objects: Map<number, { d: string; s: Buffer | null }>) {
  const cmaps = new Map<number, CMap>();
  for (const [id, o] of objects) if (o.s && /begincmap/.test(latin(o.s))) { const m = parseCMap(o.s); if (m.size) cmaps.set(id, m); }
  const maps: CMap[] = [];
  for (const o of objects.values()) { const r = o.d.match(/\/ToUnicode\s+(\d+)\s+0\s+R/); const m = r ? cmaps.get(+r[1]) : null; if (m?.size) maps.push(m); }
  return maps;
}
function score(v: string) { return [...v].filter(c => /[\p{L}\p{N}\s.,:/()%-]/u.test(c)).length; }
function decodeType0(v: string, maps: CMap[]) {
  const b = Buffer.from(v, "latin1"); if (!maps.length || !b.includes(0) || b.length < 2 || b.length % 2) return null;
  const candidates = maps.map(m => { let s = ""; for (let i = 0; i + 1 < b.length; i += 2) s += m.get(b.readUInt16BE(i)) ?? ""; return s; }).filter(Boolean);
  return candidates.sort((a, z) => score(z) - score(a))[0] ?? null;
}
function literal(v: string, maps: CMap[]) {
  const decoded = clean(v.replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8))));
  return decodeType0(decoded, maps) ?? decoded;
}
function operatorText(stream: string, maps: CMap[]) {
  const out: string[] = [];
  const push = (src: string) => { let i = 0, depth = 0, escaped = false, value = ""; while (i < src.length) { const c = src[i++]; if (escaped) { value += `\\${c}`; escaped = false; continue; } if (c === "\\") { escaped = true; continue; } if (c === "(") { if (depth++) value += c; continue; } if (c === ")") { if (--depth === 0) { out.push(literal(value, maps)); value = ""; continue; } } if (depth) value += c; } };
  for (const m of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|TJ|'|")/g)) push(m[0]);
  for (const m of stream.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) push(m[1]);
  for (const m of stream.matchAll(/<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ|'|")/g)) out.push(decodeType0(m[1], maps) ?? latin(Buffer.from(m[1].replace(/\s+/g, ""), "hex")));
  return out.filter(x => x.trim());
}
function allStreams(pdf: Buffer) {
  const raw = latin(pdf), out: Buffer[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) { const i = m.index ?? 0; const d = raw.slice(Math.max(0, i - 800), i); out.push(unzip(Buffer.from(m[1], "latin1"), d)); }
  return out;
}
function spaces(v: string) { return clean(v).replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
function quality(t: string, fonts: number): QualidadeExtracaoPdf {
  const compact = t.replace(/\s+/g, ""), palavras = t.match(/[\p{L}]{2,}/gu)?.length ?? 0, numeros = t.match(/\d+/g)?.length ?? 0, linhas = t.split(/\r?\n/).filter(Boolean).length, chars = compact.length;
  const numeric = chars > 0 && ((compact.match(/\D/g)?.length ?? 0) / chars) < .25, suficiente = chars >= 80 && palavras >= 4 && !numeric;
  return { caracteres: chars, palavras, numeros, linhas, fontesToUnicode: fonts, suficiente, motivo: suficiente ? null : numeric ? "texto dominado por sequências numéricas" : "texto extraído insuficiente" };
}
export function extrairTextoPdf(pdf: Buffer) {
  if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("O arquivo enviado não é um PDF válido.");
  const objects = getObjects(pdf), maps = unicodeMaps(objects); let text = spaces(allStreams(pdf).flatMap(s => operatorText(latin(s), maps)).join("\n")); let q = quality(text, maps.length);
  if (!q.suficiente) { text = spaces([text, clean(latin(pdf)).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ")].join("\n")); q = quality(text, maps.length); }
  if (!q.suficiente) throw new Error(`PDF SEM TEXTO EXTRAÍVEL: ${q.motivo ?? "qualidade insuficiente"}`);
  return { texto: text, qualidade: q };
}
export function normalizarTexto(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
export function somenteDigitos(v: string | null | undefined) { return String(v ?? "").replace(/\D/g, ""); }
export function validarCpf(v: string | null | undefined) {
  const d = somenteDigitos(v); if (d.length !== 11 || /^([0-9])\1{10}$/.test(d)) return false;
  const calc = (len: number) => { let sum = 0; for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
function lines(t: string) { return t.split(/\r?\n/).map(x => x.trim()).filter(Boolean); }
function fragmented(v: string) { return v.replace(/(?<=\d)[ .-]+(?=\d)/g, ""); }
const LABELS = new Set(["PAGADOR","BENEFICIARIO","VENCIMENTO","VALOR DO DOCUMENTO","VALOR COBRADO","VALOR A PAGAR","NOSSO NUMERO","Nº DO DOCUMENTO","NUMERO DO DOCUMENTO","NÚMERO DO DOCUMENTO","CNPJ/CPF","CPF","PARCELA","PARCELA/ PLANO","PARCELA/PLANO","DATA DE PROCESSAMENTO","DATA DO DOCUMENTO","FICHA DE COMPENSAÇÃO"]);
function context(t: string, labels: string[], validate: (v: string) => string | number | null) {
  const ls = lines(t), want = labels.map(normalizarTexto);
  for (let i = 0; i < ls.length; i++) {
    if (!want.some(x => normalizarTexto(ls[i]).includes(x))) continue;
    for (let j = i; j < Math.min(i + 8, ls.length); j++) {
      let candidate = ls[j]; if (j === i) candidate = candidate.replace(new RegExp(`.*?(?:${labels.join("|")})\\s*[:\\-]?\\s*`, "i"), "");
      if (LABELS.has(normalizarTexto(candidate))) continue;
      const value = validate(candidate); if (value !== null && candidate.trim()) return { valor: value, origem: j === i ? ls[i] : `${ls[i]} → ${ls[j]}` };
    }
  }
  return null;
}
function money(v: string) {
  const m = v.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i) ?? v.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/); if (!m) return null;
  const r = m[1] ?? m[0], n = Number(r.includes(",") ? r.replace(/\./g, "").replace(",", ".") : r.replace(/,/g, "")); return Number.isFinite(n) ? n : null;
}
function date(v: string) { const m = v.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})\b/); if (!m) return null; const year = m[3].length === 2 ? Number(m[3]) >= 50 ? `19${m[3]}` : `20${m[3]}` : m[3]; return `${year}-${m[2]}-${m[1]}`; }
function digits(v: string, min: number, max: number) { const d = somenteDigitos(fragmented(v)); return d.length >= min && d.length <= max ? d : null; }
function textValue(v: string) { const x = v.trim().replace(/^[|:;\-]+\s*/, ""); return x && !LABELS.has(normalizarTexto(x)) && !/^(não|nao|n\/a|-)$/i.test(x) ? x : null; }
function modulo10(value: string) { let sum = 0, mult = 2; for (let i = value.length - 1; i >= 0; i--) { let n = Number(value[i]) * mult; sum += Math.floor(n / 10) + (n % 10); mult = mult === 2 ? 1 : 2; } return (10 - (sum % 10)) % 10; }
function validarLinha47(v: string) { if (!/^\d{47}$/.test(v)) return false; return modulo10(v.slice(0, 9)) === Number(v[9]) && modulo10(v.slice(10, 20)) === Number(v[20]) && modulo10(v.slice(21, 31)) === Number(v[31]); }
function validarLinha48(v: string) { if (!/^\d{48}$/.test(v)) return false; for (let i = 0; i < 4; i++) { const bloco = v.slice(i * 12, i * 12 + 11); if (modulo10(bloco) !== Number(v[i * 12 + 11])) return false; } return true; }
function findLine(t: string) {
  const candidates = [...t.matchAll(/(?:\d[\s.-]?){47,48}/g)].map(m => somenteDigitos(m[0])).filter(x => x.length === 47 || x.length === 48);
  return candidates.find(x => validarLinha47(x) || validarLinha48(x)) ?? null;
}
function findBar(t: string, line: string | null) {
  const candidates = [...t.matchAll(/\b\d{44}\b/g)].map(m => m[0]);
  if (line?.length === 47) { const r = `${line.slice(0, 4)}${line.slice(32, 33)}${line.slice(33)}${line.slice(4, 9)}${line.slice(10, 20)}${line.slice(21, 31)}`; if (r.length === 44) candidates.unshift(r); }
  return candidates.find(x => /^\d{44}$/.test(x)) ?? null;
}
export function identificarInstituicao(text: string, line: string | null) {
  const n = normalizarTexto(text), evidence: Array<{ b: Banco; p: number; m: string }> = [];
  for (const b of BANCOS) { if (line?.slice(0, 3) === b.codigo) evidence.push({ b, p: 80, m: "código bancário na linha digitável" }); if (b.marcadores.some(x => n.includes(normalizarTexto(x)))) evidence.push({ b, p: 55, m: "texto identificador da instituição" }); }
  if (!evidence.length) return { nome: null, codigo: null, confianca: 0, origem: null };
  const grouped = new Map<string, { b: Banco; p: number; m: string[] }>(); for (const e of evidence) { const x = grouped.get(e.b.codigo) ?? { b: e.b, p: 0, m: [] }; x.p += e.p; x.m.push(e.m); grouped.set(e.b.codigo, x); }
  const a = [...grouped.values()].sort((x, y) => y.p - x.p), best = a[0], second = a[1]; if (second && second.p >= best.p - 10) return { nome: null, codigo: null, confianca: 0, origem: "evidências conflitantes" };
  return { nome: best.b.nome, codigo: best.b.codigo, confianca: Math.min(99, best.p), origem: [...new Set(best.m)].join(" + ") };
}
const field = (r: { valor: string | number | null; origem: string } | null, missing: CampoExtraido["motivo"]): CampoExtraido => r ? { valor: r.valor, origem: r.origem, confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing };
function parcelaContextual(t: string) {
  const r = context(t, ["Parcela", "Parcela/Plano", "Parcela de"], v => { const m = v.match(/\b(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\b/i); return m ? `${m[1]}/${m[2]}` : null; });
  if (!r || typeof r.valor !== "string") return null; const [numero, total] = r.valor.split("/").map(Number); return { numero, total, origem: r.origem };
}
export function extrairDadosBoleto(pdf: Buffer): DadosBoletoExtraidos {
  const { texto: text, qualidade } = extrairTextoPdf(pdf), line = findLine(text), banco = identificarInstituicao(text, line), get = (labels: string[], v: (z: string) => string | number | null) => context(text, labels, v);
  const pag = get(["Pagador", "Nome do Pagador"], textValue);
  const cpfCandidate = get(["CPF do Pagador", "CPF"], v => digits(v, 11, 11));
  const cpfValido = cpfCandidate?.valor && typeof cpfCandidate.valor === "string" && validarCpf(cpfCandidate.valor) ? cpfCandidate : null;
  const nosso = get(["Nosso Número", "Nosso Numero"], v => digits(v, 3, 30));
  const doc = get(["Número do Documento", "Numero do Documento", "Nº do Documento"], v => digits(v, 1, 30));
  const ext = get(["Identificador Externo", "Referência Adicional", "Referencia Adicional"], textValue);
  const valor = get(["Valor do Documento", "Valor Cobrado", "Valor a Pagar", "Total"], money);
  const venc = get(["Vencimento", "Data de Vencimento", "Venc.", "Pagar até"], date);
  const ben = get(["Beneficiário", "Beneficiario"], textValue);
  const cpfBen = get(["CNPJ/CPF", "CPF/CNPJ", "CNPJ"], v => digits(v, 11, 14));
  const parcela = parcelaContextual(text), bar = findBar(text, line), missing = qualidade.suficiente ? "nao_encontrado_no_texto" : "texto_insuficiente";
  const origem: Record<string, CampoExtraido> = {
    nome_pagador: field(pag, missing), cpf_pagador: cpfValido ? { ...field(cpfValido, missing), motivo: "encontrado" } : { valor: null, origem: cpfCandidate?.origem ?? null, confianca: null, motivo: cpfCandidate ? "campo_invalido" : missing },
    nosso_numero: field(nosso, missing), numero_documento: field(doc, missing), identificador_externo: field(ext, missing), valor: field(valor, missing), vencimento: field(venc, missing), nome_beneficiario: field(ben, missing), cpf_cnpj_beneficiario: field(cpfBen, missing),
    instituicao_financeira: { valor: banco.nome, origem: banco.origem, confianca: banco.nome ? banco.confianca >= 80 ? "alta" : "media" : null, motivo: banco.nome ? "encontrado" : missing },
    linha_digitavel: { valor: line, origem: line ? "sequência numérica validada estruturalmente" : null, confianca: line ? "alta" : null, motivo: line ? "encontrado" : missing },
    codigo_barras: { valor: bar, origem: bar ? "código de barras com 44 dígitos" : null, confianca: bar ? "media" : null, motivo: bar ? "encontrado" : missing },
    parcela: parcela ? { valor: `${parcela.numero}/${parcela.total}`, origem: parcela.origem, confianca: "alta", motivo: "encontrado" } : { valor: null, origem: null, confianca: null, motivo: missing },
  };
  return {
    instituicao_financeira: banco.nome, codigo_banco: banco.codigo, confianca_banco: banco.confianca, metodo_identificacao_banco: banco.origem,
    nome_beneficiario: typeof ben?.valor === "string" ? ben.valor : null, cpf_cnpj_beneficiario: typeof cpfBen?.valor === "string" ? cpfBen.valor : null,
    nome_pagador: typeof pag?.valor === "string" ? pag.valor : null, cpf_pagador: typeof cpfValido?.valor === "string" ? cpfValido.valor : null,
    nosso_numero: typeof nosso?.valor === "string" ? nosso.valor : null, numero_documento: typeof doc?.valor === "string" ? doc.valor : null, identificador_externo: typeof ext?.valor === "string" ? ext.valor : null,
    linha_digitavel: line, codigo_barras: bar, valor: typeof valor?.valor === "number" ? valor.valor : null, vencimento: typeof venc?.valor === "string" ? venc.valor : null,
    numero_parcela: parcela?.numero ?? null, total_parcelas: parcela?.total ?? null, texto_extraido: text, qualidade_extracao: qualidade, dados_origem: origem,
  };
}
export function normalizarNome(v: string | null | undefined) { return normalizarTexto(String(v ?? "")).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export function normalizarCpf(v: string | null | undefined) { return somenteDigitos(v); }
