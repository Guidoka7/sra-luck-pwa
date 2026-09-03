export type NivelConfianca = "alta" | "media" | "baixa";

export type CandidatoBoleto = {
  id: string;
  cliente_id: string;
  carne_id: string | null;
  numero_parcela: number | null;
  total_parcelas: number | null;
  valor: number | string | null;
  data_vencimento: string | null;
  status: string | null;
  instituicao_financeira: string | null;
  identificador_externo: string | null;
  origem_boleto: string | null;
  clientes?: { id: string; nome_completo: string | null; cpf: string | null; telefone: string | null } | null;
  carnes?: { id: string; identificador_externo: string | null; instituicao_financeira: string | null; quantidade_parcelas: number | null } | null;
};

export type AnaliseCandidato = CandidatoBoleto & {
  pontuacao: number;
  percentual: number;
  motivos: { tipo: "positivo" | "alerta"; texto: string; pontos?: number }[];
};

export type DadosImportacao = {
  cpf_pagador_extraido: string | null;
  nome_pagador_extraido: string | null;
  nosso_numero: string | null;
  identificador_externo: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  valor_extraido: number | string | null;
  vencimento_extraido: string | null;
  numero_parcela: number | null;
  instituicao_financeira: string | null;
};

export function normalizarTexto(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizarDocumento(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function distanciaLevenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let anterior = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const atual = row[j];
      row[j] = a[i - 1] === b[j - 1] ? anterior : Math.min(anterior + 1, row[j - 1] + 1, atual + 1);
      anterior = atual;
    }
  }
  return row[b.length];
}

function nomeSemelhante(a: string, b: string) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const inter = [...tokensA].filter((token) => tokensB.has(token)).length;
  const uniao = new Set([...tokensA, ...tokensB]).size;
  const jaccard = uniao ? inter / uniao : 0;
  const distancia = distanciaLevenshtein(na, nb);
  const similaridade = Math.max(jaccard, 1 - distancia / Math.max(na.length, nb.length));
  return similaridade >= 0.84;
}

function dinheiro(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizarInstituicao(value: unknown) {
  return normalizarTexto(value).replace("EFÍ", "EFI");
}

export function pontuarCandidato(dados: DadosImportacao, candidato: CandidatoBoleto) {
  let pontuacao = 0;
  const motivos: AnaliseCandidato["motivos"] = [];
  const cpfPdf = normalizarDocumento(dados.cpf_pagador_extraido);
  const cpfCliente = normalizarDocumento(candidato.clientes?.cpf);
  const nomePdf = normalizarTexto(dados.nome_pagador_extraido);
  const nomeCliente = normalizarTexto(candidato.clientes?.nome_completo);
  const idPdf = normalizarTexto(dados.identificador_externo);
  const idBoleto = normalizarTexto(candidato.identificador_externo);
  const nossoPdf = normalizarTexto(dados.nosso_numero);
  const valorPdf = dinheiro(dados.valor_extraido);
  const valorBoleto = dinheiro(candidato.valor);

  if (cpfPdf && cpfCliente && cpfPdf === cpfCliente) { pontuacao += 50; motivos.push({ tipo: "positivo", texto: "CPF exato da cliente", pontos: 50 }); }
  if (idPdf && idBoleto && idPdf === idBoleto) { pontuacao += 50; motivos.push({ tipo: "positivo", texto: "Identificador externo exato", pontos: 50 }); }
  if (nossoPdf && idBoleto && nossoPdf === idBoleto) { pontuacao += 50; motivos.push({ tipo: "positivo", texto: "Nosso número coincide com o identificador do boleto", pontos: 50 }); }

  // Linha digitável/código de barras não possuem colunas próprias no modelo atual de boletos.
  // Não pontuamos por esses campos para evitar qualquer inferência indevida.
  if (cpfPdf && cpfCliente && cpfPdf === cpfCliente) { pontuacao += 25; motivos.push({ tipo: "positivo", texto: "Cliente identificada pelo CPF", pontos: 25 }); }
  if (valorPdf !== null && valorBoleto !== null && Math.abs(valorPdf - valorBoleto) < 0.011) { pontuacao += 20; motivos.push({ tipo: "positivo", texto: "Valor exato/compatível", pontos: 20 }); }
  if (dados.vencimento_extraido && candidato.data_vencimento && dados.vencimento_extraido === candidato.data_vencimento) { pontuacao += 20; motivos.push({ tipo: "positivo", texto: "Vencimento exato", pontos: 20 }); }
  if (normalizarInstituicao(dados.instituicao_financeira) && normalizarInstituicao(dados.instituicao_financeira) === normalizarInstituicao(candidato.instituicao_financeira)) { pontuacao += 15; motivos.push({ tipo: "positivo", texto: "Instituição financeira compatível", pontos: 15 }); }
  if (candidato.carne_id) { pontuacao += 15; motivos.push({ tipo: "positivo", texto: "Carnê compatível com o boleto existente", pontos: 15 }); }
  if (nomePdf && nomeCliente && nomeSemelhante(nomePdf, nomeCliente)) { pontuacao += 10; motivos.push({ tipo: "positivo", texto: nomePdf === nomeCliente ? "Nome exato" : "Nome semelhante", pontos: 10 }); }
  if (dados.numero_parcela !== null && candidato.numero_parcela !== null && Number(dados.numero_parcela) === Number(candidato.numero_parcela)) { pontuacao += 10; motivos.push({ tipo: "positivo", texto: "Número da parcela coincide", pontos: 10 }); }

  if (cpfPdf && cpfCliente && cpfPdf !== cpfCliente) motivos.push({ tipo: "alerta", texto: "CPF do PDF diverge da cliente candidata" });
  if (valorPdf !== null && valorBoleto !== null && Math.abs(valorPdf - valorBoleto) > 0.011) motivos.push({ tipo: "alerta", texto: "Valor diferente do boleto candidato" });
  if (dados.vencimento_extraido && candidato.data_vencimento && dados.vencimento_extraido !== candidato.data_vencimento) motivos.push({ tipo: "alerta", texto: "Vencimento diferente do boleto candidato" });

  return { ...candidato, pontuacao, percentual: Math.min(100, pontuacao), motivos };
}

export function classificarConfianca(pontuacao: number): NivelConfianca {
  if (pontuacao >= 80) return "alta";
  if (pontuacao >= 50) return "media";
  return "baixa";
}
