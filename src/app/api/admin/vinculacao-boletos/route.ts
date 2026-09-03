import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const texto = (v: unknown) => String(v ?? "").trim();

function estadoCentral(item: any) {
  if (item.status_vinculacao === "vinculado" || item.boleto_vinculado_id) return "vinculado";
  if (item.status_vinculacao === "aguardando_confirmacao") return "aguardando_confirmacao";
  if (item.status_vinculacao === "aguardando_vinculacao") return "sem_correspondencia";
  if (item.status === "erro") return "erro";
  return "analise_pendente";
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const url = new URL(req.url);
  const status = texto(url.searchParams.get("status"));
  const banco = texto(url.searchParams.get("banco"));
  const confianca = texto(url.searchParams.get("confianca"));
  const busca = texto(url.searchParams.get("busca"));

  let query = supabase.from("importacoes_boletos").select(`id,arquivo_nome,cliente_id,carne_id,boleto_id,cliente_sugerido_id,carne_sugerido_id,boleto_sugerido_id,cliente_vinculado_id,carne_vinculado_id,boleto_vinculado_id,instituicao_financeira,nosso_numero,numero_documento,identificador_externo,nome_pagador_extraido,cpf_pagador_extraido,valor_extraido,vencimento_extraido,numero_parcela,pontuacao_confianca,nivel_confianca,status_vinculacao,status,analise_detalhada,dados_extraidos,erro_detalhes,created_at,updated_at,cliente:clientes!importacoes_boletos_cliente_id_fkey(id,nome_completo,cpf,telefone),cliente_sugerido:clientes!importacoes_boletos_cliente_sugerido_id_fkey(id,nome_completo,cpf,telefone),cliente_vinculado:clientes!importacoes_boletos_cliente_vinculado_id_fkey(id,nome_completo,cpf,telefone),carne:carnes!importacoes_boletos_carne_id_fkey(id,identificador_externo,instituicao_financeira,quantidade_parcelas),boleto:boletos!importacoes_boletos_boleto_id_fkey(id,numero_parcela,total_parcelas,valor,data_vencimento,status)`).order("created_at", { ascending: false }).limit(300);
  if (status === "vinculado") query = query.eq("status_vinculacao", "vinculado");
  else if (status === "aguardando_confirmacao") query = query.eq("status_vinculacao", "aguardando_confirmacao");
  else if (status === "sem_correspondencia") query = query.eq("status_vinculacao", "aguardando_vinculacao");
  else if (status === "erro") query = query.eq("status", "erro");
  else if (status === "analise_pendente") query = query.eq("status_vinculacao", "pendente");
  if (banco) query = query.eq("instituicao_financeira", banco);
  if (confianca) query = query.eq("nivel_confianca", confianca);
  if (busca) query = query.or(`nome_pagador_extraido.ilike.%${busca}%,cpf_pagador_extraido.ilike.%${busca}%,nosso_numero.ilike.%${busca}%,identificador_externo.ilike.%${busca}%,arquivo_nome.ilike.%${busca}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const importacoes = (data ?? []).map((item: any) => {
    const qualidade = item.dados_extraidos?.qualidade_extracao ?? null;
    const diagnostico = {
      pdf_texto_suficiente: qualidade?.suficiente ?? null,
      caracteres: qualidade?.caracteres ?? null,
      linhas: qualidade?.linhas ?? null,
      palavras: qualidade?.palavras ?? null,
      numeros: qualidade?.numeros ?? null,
      motivo_texto: qualidade?.motivo ?? null,
      campos: item.dados_extraidos?.dados_origem ?? null,
      erro: item.erro_detalhes ?? null,
    };
    return {
      ...item,
      estado_central: estadoCentral(item),
      valor_extraido: item.valor_extraido === null ? null : Number(item.valor_extraido),
      percentual_confianca: item.pontuacao_confianca === null ? null : Math.min(100, Number(item.pontuacao_confianca)),
      diagnostico,
    };
  });
  const indicadores = {
    totalPendente: importacoes.filter((i: any) => ["analise_pendente", "aguardando_confirmacao", "sem_correspondencia"].includes(i.estado_central)).length,
    alta: importacoes.filter((i: any) => i.nivel_confianca === "alta" && i.estado_central !== "vinculado").length,
    media: importacoes.filter((i: any) => i.nivel_confianca === "media" && i.estado_central !== "vinculado").length,
    baixa: importacoes.filter((i: any) => (i.nivel_confianca === "baixa" || i.nivel_confianca === "sem_correspondencia" || !i.nivel_confianca) && i.estado_central !== "vinculado").length,
    vinculados: importacoes.filter((i: any) => i.estado_central === "vinculado").length,
    erros: importacoes.filter((i: any) => i.estado_central === "erro").length,
  };
  return NextResponse.json({ importacoes, indicadores, bancos: ["BRB", "Sicredi", "Santander", "Banco do Brasil", "Efí / Gerencianet", "Outro"] });
}
