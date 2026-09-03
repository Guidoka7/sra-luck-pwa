import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const texto = (v: unknown) => String(v ?? "").trim();

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const url = new URL(req.url);
  const status = texto(url.searchParams.get("status"));
  const banco = texto(url.searchParams.get("banco"));
  const confianca = texto(url.searchParams.get("confianca"));
  const busca = texto(url.searchParams.get("busca"));

  let query = supabase.from("importacoes_boletos").select(`id,arquivo_nome,cliente_id,carne_id,boleto_id,cliente_sugerido_id,carne_sugerido_id,boleto_sugerido_id,cliente_vinculado_id,carne_vinculado_id,boleto_vinculado_id,instituicao_financeira,nosso_numero,numero_documento,identificador_externo,nome_pagador_extraido,cpf_pagador_extraido,valor_extraido,vencimento_extraido,numero_parcela,pontuacao_confianca,nivel_confianca,status_vinculacao,status,analise_detalhada,created_at,updated_at,clientes(id,nome_completo,cpf,telefone),carnes(id,identificador_externo,instituicao_financeira,quantidade_parcelas),boletos(id,numero_parcela,total_parcelas,valor,data_vencimento,status)`).order("created_at", { ascending: false }).limit(300);
  if (status) query = query.eq("status_vinculacao", status);
  if (banco) query = query.eq("instituicao_financeira", banco);
  if (confianca) query = query.eq("nivel_confianca", confianca);
  if (busca) query = query.or(`nome_pagador_extraido.ilike.%${busca}%,cpf_pagador_extraido.ilike.%${busca}%,nosso_numero.ilike.%${busca}%,identificador_externo.ilike.%${busca}%,arquivo_nome.ilike.%${busca}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const importacoes = (data ?? []).map((item: any) => ({ ...item, valor_extraido: item.valor_extraido === null ? null : Number(item.valor_extraido), percentual_confianca: item.pontuacao_confianca === null ? null : Math.min(100, Number(item.pontuacao_confianca)) }));
  const indicadores = {
    totalPendente: importacoes.filter((i: any) => i.status_vinculacao !== "vinculado" && i.status_vinculacao !== "ignorado").length,
    alta: importacoes.filter((i: any) => i.nivel_confianca === "alta" && i.status_vinculacao !== "vinculado").length,
    media: importacoes.filter((i: any) => i.nivel_confianca === "media").length,
    baixa: importacoes.filter((i: any) => i.nivel_confianca === "baixa" || !i.nivel_confianca).length,
  };
  return NextResponse.json({ importacoes, indicadores, bancos: ["BRB", "Sicredi", "Santander", "Banco do Brasil", "Efí / Gerencianet", "Outro"] });
}
