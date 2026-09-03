import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.from("importacoes_boletos").select(`*,cliente:clientes!importacoes_boletos_cliente_id_fkey(id,nome_completo,cpf,telefone,email),cliente_sugerido:clientes!importacoes_boletos_cliente_sugerido_id_fkey(id,nome_completo,cpf,telefone,email),cliente_vinculado:clientes!importacoes_boletos_cliente_vinculado_id_fkey(id,nome_completo,cpf,telefone,email),carnes(id,cliente_id,instituicao_financeira,identificador_externo,quantidade_parcelas,valor_parcela,valor_total,status),boletos(id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto)`).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  const ids = Array.isArray(data.analise_detalhada?.candidatos) ? data.analise_detalhada.candidatos.map((c: any) => c.id).filter(Boolean) : [];
  let candidatos: any[] = [];
  if (ids.length) {
    const result = await supabase.from("boletos").select("id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto,cliente:clientes!boletos_cliente_id_fkey(id,nome_completo,cpf,telefone),carnes(id,identificador_externo,instituicao_financeira,quantidade_parcelas)").in("id", ids);
    if (result.error) return NextResponse.json({ erro: result.error.message }, { status: 500 });
    const porId = new Map((result.data ?? []).map((c: any) => [c.id, c]));
    candidatos = data.analise_detalhada.candidatos.map((meta: any) => ({ ...porId.get(meta.id), pontuacao: meta.pontuacao, percentual: meta.percentual, motivos: meta.motivos })).filter((c: any) => c.id);
  }
  return NextResponse.json({ importacao: data, candidatos });
}
