import { extrairDadosBoleto, type DadosBoletoExtraidos } from "./boletos";

export type MotorLeitura = "gemini" | "local";

const PROMPT = `Você é um extrator de dados de boletos bancários brasileiros. Analise o PDF enviado visualmente e extraia SOMENTE dados que estejam efetivamente visíveis no documento. Não invente nem deduza campos ausentes.

Responda EXCLUSIVAMENTE JSON válido, sem markdown:
{
  "instituicao_financeira": string|null,
  "codigo_banco": string|null,
  "nome_pagador": string|null,
  "cpf_pagador": string|null,
  "nosso_numero": string|null,
  "numero_documento": string|null,
  "identificador_externo": string|null,
  "linha_digitavel": string|null,
  "codigo_barras": string|null,
  "valor": number|null,
  "vencimento": "YYYY-MM-DD"|null,
  "numero_parcela": number|null,
  "total_parcelas": number|null,
  "texto_visivel_relevante": string|null
}

Regras:
- Preserve apenas números realmente legíveis.
- Para CPF, use 11 dígitos.
- Linha digitável deve ter 47 ou 48 dígitos, sem espaços.
- Código de barras deve ter 44 dígitos, sem espaços.
- Valor é número decimal brasileiro convertido para ponto.
- Vencimento deve ser data real no formato YYYY-MM-DD.
- Se houver dúvida, retorne null.`;

function limparJson(texto: string) {
  const semBloco = texto.replace(/^\s*\`\`\`(?:json)?/i, "").replace(/\`\`\`\s*$/i, "").trim();
  const inicio = semBloco.indexOf("{");
  const fim = semBloco.lastIndexOf("}");
  return inicio >= 0 && fim > inicio ? semBloco.slice(inicio, fim + 1) : semBloco;
}

function digitos(v: unknown) { return String(v ?? "").replace(/\D/g, ""); }

function normalizarResultadoIA(valor: any, fallback: DadosBoletoExtraidos): DadosBoletoExtraidos {
  const linha = digitos(valor?.linha_digitavel);
  const barras = digitos(valor?.codigo_barras);
  const cpf = digitos(valor?.cpf_pagador);
  const data = typeof valor?.vencimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor.vencimento) ? valor.vencimento : null;
  const numero = Number(valor?.valor);
  return {
    ...fallback,
    instituicao_financeira: typeof valor?.instituicao_financeira === "string" && valor.instituicao_financeira.trim() ? valor.instituicao_financeira.trim() : fallback.instituicao_financeira,
    codigo_banco: /^\d{3}$/.test(digitos(valor?.codigo_banco)) ? digitos(valor.codigo_banco) : fallback.codigo_banco,
    nome_pagador: typeof valor?.nome_pagador === "string" && valor.nome_pagador.trim() ? valor.nome_pagador.trim() : fallback.nome_pagador,
    cpf_pagador: cpf.length === 11 ? cpf : fallback.cpf_pagador,
    nosso_numero: typeof valor?.nosso_numero === "string" && valor.nosso_numero.trim() ? valor.nosso_numero.trim() : fallback.nosso_numero,
    numero_documento: typeof valor?.numero_documento === "string" && valor.numero_documento.trim() ? valor.numero_documento.trim() : fallback.numero_documento,
    identificador_externo: typeof valor?.identificador_externo === "string" && valor.identificador_externo.trim() ? valor.identificador_externo.trim() : fallback.identificador_externo,
    linha_digitavel: (linha.length === 47 || linha.length === 48) ? linha : fallback.linha_digitavel,
    codigo_barras: barras.length === 44 ? barras : fallback.codigo_barras,
    valor: Number.isFinite(numero) && numero > 0 ? numero : fallback.valor,
    vencimento: data ?? fallback.vencimento,
    numero_parcela: Number.isInteger(Number(valor?.numero_parcela)) && Number(valor.numero_parcela) > 0 ? Number(valor.numero_parcela) : fallback.numero_parcela,
    total_parcelas: Number.isInteger(Number(valor?.total_parcelas)) && Number(valor.total_parcelas) > 0 ? Number(valor.total_parcelas) : fallback.total_parcelas,
    texto_extraido: fallback.texto_extraido || (typeof valor?.texto_visivel_relevante === "string" ? valor.texto_visivel_relevante : ""),
    dados_origem: {
      ...(fallback.dados_origem ?? {}),
      motor_ia: { valor: "Gemini", origem: "análise visual do PDF", confianca: "alta", motivo: "encontrado" }
    }
  };
}

export async function extrairDadosBoletoComFallback(pdf: Buffer): Promise<{ dados: DadosBoletoExtraidos; motor: MotorLeitura; erroIA: string | null }> {
  let local: DadosBoletoExtraidos | null = null;
  let erroLocal: string | null = null;
  try { local = extrairDadosBoleto(pdf); } catch (e) { erroLocal = e instanceof Error ? e.message : "Falha no parser local"; }

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    if (local) return { dados: local, motor: "local", erroIA: "GEMINI_API_KEY não configurada; usado parser local." };
    throw new Error(erroLocal ?? "PDF não pôde ser interpretado e a integração Gemini não está configurada.");
  }

  try {
    const modelo = process.env.GEMINI_PDF_MODEL || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(chave)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const resposta = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: PROMPT },
          { inline_data: { mime_type: "application/pdf", data: pdf.toString("base64") } }
        ] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" }
      })
    });
    clearTimeout(timer);
    if (!resposta.ok) throw new Error(`Gemini HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 500)}`);
    const json: any = await resposta.json();
    const texto = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    const ia = JSON.parse(limparJson(texto));
    const fallback = local ?? {
      instituicao_financeira: null, codigo_banco: null, nome_beneficiario: null, cpf_cnpj_beneficiario: null,
      nome_pagador: null, cpf_pagador: null, nosso_numero: null, numero_documento: null, identificador_externo: null,
      linha_digitavel: null, codigo_barras: null, valor: null, vencimento: null, numero_parcela: null, total_parcelas: null,
      texto_extraido: "", dados_origem: {}
    };
    return { dados: normalizarResultadoIA(ia, fallback), motor: "gemini", erroIA: null };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha desconhecida no Gemini";
    if (local) return { dados: local, motor: "local", erroIA: erro };
    throw new Error(`Falha no Gemini e não houve fallback local utilizável: ${erro}`);
  }
}