import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extrairDadosBoletoComFallback } from "@/lib/pdf/interpretador-ia";
import { complementarLeituraCarne } from "@/lib/pdf/complementar-carne";

function historicoItem(acao:string, usuario:string, detalhes:Record<string,unknown>={}) {
  return { em:new Date().toISOString(), usuario, acao, detalhes };
}

export async function POST(_req:Request,{params}:{params:{id:string}}){
  const supabase=createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({erro:"Não autenticado."},{status:401});

  const {data:atual,error:buscaErro}=await supabase
    .from("importacoes_boletos").select("*").eq("id",params.id).maybeSingle();
  if(buscaErro)return NextResponse.json({erro:buscaErro.message},{status:500});
  if(!atual)return NextResponse.json({erro:"Importação não encontrada."},{status:404});
  if(!atual.arquivo_storage_path){
    return NextResponse.json({
      erro:"Este PDF foi importado antes do armazenamento de originais e não pode ser reprocessado automaticamente. Reimporte o arquivo original para permitir análise visual."
    },{status:409});
  }

  const {data:arquivo,error:downloadErro}=await supabase.storage
    .from("boletos-pdf").download(atual.arquivo_storage_path);
  if(downloadErro||!arquivo)return NextResponse.json({erro:downloadErro?.message||"PDF original não encontrado no Storage."},{status:404});

  try{
    const buffer=Buffer.from(await arquivo.arrayBuffer());
    const leitura=await extrairDadosBoletoComFallback(buffer);
    const dados=complementarLeituraCarne(leitura.dados.texto_extraido,leitura.dados);
    const historicoAtual=Array.isArray(atual.historico)?atual.historico:[];
    const historico=[...historicoAtual,historicoItem("PDF reprocessado",user.id,{
      motor_leitura:leitura.motor,
      aviso_interpretador:leitura.erroIA,
      campos_extraidos:Object.entries(dados).filter(([k,v])=>k!=="texto_extraido"&&k!=="dados_origem"&&v!==null&&v!==undefined&&v!=="").map(([k])=>k)
    })];

    const {data,error}=await supabase.from("importacoes_boletos").update({
      instituicao_financeira:dados.instituicao_financeira,
      nosso_numero:dados.nosso_numero,
      numero_documento:dados.numero_documento,
      identificador_externo:dados.identificador_externo,
      linha_digitavel:dados.linha_digitavel,
      codigo_barras:dados.codigo_barras,
      nome_pagador_extraido:dados.nome_pagador,
      cpf_pagador_extraido:dados.cpf_pagador,
      valor_extraido:dados.valor,
      vencimento_extraido:dados.vencimento,
      numero_parcela:dados.numero_parcela,
      dados_extraidos:{...dados,motor_leitura:leitura.motor,aviso_interpretador:leitura.erroIA,reprocessado_em:new Date().toISOString()},
      status:"aguardando_vinculacao",
      historico
    }).eq("id",params.id).select("*").single();
    if(error)return NextResponse.json({erro:error.message},{status:500});
    return NextResponse.json({importacao:data,motor:leitura.motor,aviso:leitura.erroIA});
  }catch(e){
    const erro=e instanceof Error?e.message:"Falha ao reprocessar PDF.";
    return NextResponse.json({erro},{status:422});
  }
}
