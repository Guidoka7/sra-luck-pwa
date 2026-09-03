import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { classificarConfianca, normalizarDocumento, normalizarTexto, pontuarCandidato, type CandidatoBoleto, type DadosImportacao } from "@/lib/vinculacao-boletos";

function historicoItem(acao:string,usuario:string,detalhes:Record<string,unknown>={}){return{em:new Date().toISOString(),usuario,acao,detalhes};}
async function autenticar(){const supabase=createServerSupabaseClient();const{data:{user}}=await supabase.auth.getUser();return{supabase,user};}

async function carregarCandidatos(supabase:any,dados:DadosImportacao){
  let clientes:any[]=[];
  const cpf=normalizarDocumento(dados.cpf_pagador_extraido);
  if(cpf){
    const variantes=[cpf];
    if(cpf.length===11)variantes.push(`${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`);
    const{data,error}=await supabase.from("clientes").select("id,nome_completo,cpf,telefone").or(variantes.map(v=>`cpf.eq.${v}`).join(",")).limit(20);
    if(error)throw new Error(error.message);clientes=data??[];
  }
  if(!clientes.length&&dados.nome_pagador_extraido){
    const nome=normalizarTexto(dados.nome_pagador_extraido),primeiro=nome.split(" ").find(v=>v.length>=3);
    if(primeiro){const{data,error}=await supabase.from("clientes").select("id,nome_completo,cpf,telefone").ilike("nome_completo",`%${primeiro}%`).limit(100);if(error)throw new Error(error.message);clientes=data??[];}
  }
  if(!clientes.length)return{clientes:[],carnes:[],boletos:[]};
  const clienteIds=clientes.map(c=>c.id);
  const{data:carnes,error:ce}=await supabase.from("carnes").select("id,cliente_id,identificador_externo,instituicao_financeira,quantidade_parcelas,valor_parcela,valor_total").in("cliente_id",clienteIds).limit(500);
  if(ce)throw new Error(ce.message);
  if(!carnes?.length)return{clientes,carnes:[],boletos:[]};
  const carneIds=carnes.map((c:any)=>c.id);
  const{data:boletos,error:be}=await supabase.from("boletos").select("id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto,clientes(id,nome_completo,cpf,telefone),carnes(id,identificador_externo,instituicao_financeira,quantidade_parcelas,valor_parcela,valor_total)").in("carne_id",carneIds).limit(1000);
  if(be)throw new Error(be.message);
  return{clientes,carnes,boletos:(boletos??[]) as CandidatoBoleto[]};
}

export async function POST(_req:Request,{params}:{params:{id:string}}){
  const{supabase,user}=await autenticar();if(!user)return NextResponse.json({erro:"Não autenticado."},{status:401});
  const{data:importacao,error:ie}=await supabase.from("importacoes_boletos").select("*").eq("id",params.id).maybeSingle();
  if(ie)return NextResponse.json({erro:ie.message},{status:500});if(!importacao)return NextResponse.json({erro:"Importação não encontrada."},{status:404});
  const dados:DadosImportacao={cpf_pagador_extraido:importacao.cpf_pagador_extraido,nome_pagador_extraido:importacao.nome_pagador_extraido,nosso_numero:importacao.nosso_numero,identificador_externo:importacao.identificador_externo,linha_digitavel:importacao.linha_digitavel,codigo_barras:importacao.codigo_barras,valor_extraido:importacao.valor_extraido,vencimento_extraido:importacao.vencimento_extraido,numero_parcela:importacao.numero_parcela,instituicao_financeira:importacao.instituicao_financeira};
  const{clientes,carnes,boletos}=await carregarCandidatos(supabase,dados);
  const analisados=boletos.map(c=>pontuarCandidato(dados,c)).sort((a,b)=>b.pontuacao-a.pontuacao);
  const principal=analisados[0]??null;
  const nivel=principal?classificarConfianca(principal.pontuacao):"baixa";
  const unica=principal?analisados.filter(c=>c.pontuacao===principal.pontuacao).length===1:false;
  const status=principal&&principal.pontuacao>=85&&unica?"aguardando_confirmacao":"analisado";
  const analise={executada_em:new Date().toISOString(),fluxo:"cliente → carnê → boleto",regras:"Cliente: CPF + nome + identificador; Carnê: instituição + identificador + parcelas + valor; Boleto: nosso número + identificador + valor + vencimento + parcela + instituição",clientes_encontradas:clientes.length,carnes_encontrados:carnes.length,candidatos:analisados.slice(0,10).map(c=>({id:c.id,cliente_id:c.cliente_id,carne_id:c.carne_id,pontuacao:c.pontuacao,percentual:c.percentual,pontuacao_cliente:c.pontuacao_cliente,pontuacao_carne:c.pontuacao_carne,pontuacao_boleto:c.pontuacao_boleto,motivos:c.motivos})),quantidade_candidatos:analisados.length};
  const historicoAtual=Array.isArray(importacao.historico)?importacao.historico:[];
  const historico=[...historicoAtual,historicoItem("Análise inteligente executada",user.id,{pontuacao:principal?.pontuacao??0,nivel,candidatos:analisados.length,cliente_sugerida:principal?.cliente_id??null,carne_sugerido:principal?.carne_id??null,boleto_sugerido:principal?.id??null,fluxo:"cliente → carnê → boleto"})];
  const{data,error}=await supabase.from("importacoes_boletos").update({cliente_sugerido_id:principal?.cliente_id??null,carne_sugerido_id:principal?.carne_id??null,boleto_sugerido_id:principal?.id??null,pontuacao_confianca:principal?.pontuacao??0,nivel_confianca:nivel,status_vinculacao:status,analise_detalhada:analise,historico}).eq("id",params.id).select("*").single();
  if(error)return NextResponse.json({erro:error.message},{status:500});
  return NextResponse.json({importacao:data,analise:{principal,candidatos:analisados.slice(0,10),nivel,status,clientes,carnes}});
}
