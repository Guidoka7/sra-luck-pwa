import { validarCpf, somenteDigitos } from "@/lib/pdf/boletos";

type Parcela = {
  nosso_numero: string | null;
  linha_digitavel: string | null;
  valor: number | null;
  vencimento: string | null;
};

function normalizarValor(v: string) {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dataIso(v: string) {
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function nomeComCpf(texto: string) {
  const re = /(?:PAGADOR\s*)?([A-ZÀ-Ú][A-ZÀ-Ú '\-]{5,80}?)\s*[-–]\s*((?:\d[.\s-]?){11})/gi;
  for (const m of texto.matchAll(re)) {
    const cpf = somenteDigitos(m[2]);
    if (validarCpf(cpf)) {
      const nome = m[1].replace(/\b(PAGADOR|CPF)\b/gi, "").trim();
      if (nome.split(/\s+/).length >= 2) return { nome, cpf };
    }
  }
  return { nome: null, cpf: null };
}

function parcelasDoTexto(texto: string): Parcela[] {
  const linhas = texto.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const parcelas: Parcela[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const janela = linhas.slice(Math.max(0, i - 6), Math.min(linhas.length, i + 8)).join(" ");
    const nosso = janela.match(/\b\d{1,3}\/\d{4,12}(?:-\d)?\b/);
    const datas = [...janela.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)].map(x => x[0]);
    const valores = [...janela.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map(x => normalizarValor(x[1])).filter((x): x is number => x !== null);
    const linha = janela.match(/(?:\d[ .-]?){47,48}/g)?.map(x => somenteDigitos(x)).find(x => x.length === 47 || x.length === 48) ?? null;
    if (!nosso && !linha) continue;
    const item: Parcela = {
      nosso_numero: nosso?.[0] ?? null,
      linha_digitavel: linha,
      vencimento: datas.length ? dataIso(datas.find(d => d !== "18/06/2026") ?? datas[0]) : null,
      valor: valores.find(v => v > 0) ?? null,
    };
    const chave = JSON.stringify(item);
    if (!parcelas.some(p => JSON.stringify(p) === chave)) parcelas.push(item);
  }
  return parcelas;
}

export function complementarLeituraCarne(texto: string, atual: any) {
  const cliente = nomeComCpf(texto);
  const parcelas = parcelasDoTexto(texto);
  const principal = parcelas.find(p => p.nosso_numero || p.linha_digitavel || p.vencimento) ?? null;

  const valoresGlobais = [...texto.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g)]
    .map(x => normalizarValor(x[1])).filter((x): x is number => x !== null);
  const datasGlobais = [...texto.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)]
    .map(x => dataIso(x[0])).filter(Boolean);

  return {
    ...atual,
    nome_pagador: atual.nome_pagador ?? cliente.nome,
    cpf_pagador: atual.cpf_pagador ?? cliente.cpf,
    nosso_numero: atual.nosso_numero ?? principal?.nosso_numero ?? null,
    linha_digitavel: atual.linha_digitavel ?? principal?.linha_digitavel ?? null,
    valor: atual.valor ?? principal?.valor ?? valoresGlobais.find(v => v > 0) ?? null,
    vencimento: atual.vencimento ?? principal?.vencimento ?? datasGlobais[0] ?? null,
    total_parcelas: atual.total_parcelas ?? (parcelas.length || null),
    quantidade_parcelas_detectadas: Math.max(Number(atual.quantidade_parcelas_detectadas ?? 0), parcelas.length),
    tipo_documento: parcelas.length > 1 ? "carne" : atual.tipo_documento,
    parcelas_extraidas: parcelas.length ? parcelas : atual.parcelas_extraidas,
  };
}
