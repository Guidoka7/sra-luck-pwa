import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data, error } = await supabase.from("importacoes_boletos").select(`*,clientes(id,nome_completo,cpf,telefone,email),carnes(id,cliente_id,instituicao_financeira,identificador_externo,quantidade_parcelas,valor_parcela,valor_total,status),boletos(id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto)`).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });
  return NextResponse.json({ importacao: data });
}
