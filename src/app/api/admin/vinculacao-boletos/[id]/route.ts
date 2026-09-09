import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const boletoSelect = "id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto,cliente:clientes!boletos_cliente_id_fkey(id,nome_completo,cpf,telefone),carne:carnes!boletos_carne_id_fkey(id,identificador_externo,instituicao_financeira,quantidade_parcelas,status)";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("importacoes_boletos")
    .select(`*,cliente:clientes!importacoes_boletos_cliente_id_fkey(id,nome_completo,cpf,telefone,email),cliente_sugerido:clientes!importacoes_boletos_cliente_sugerido_id_fkey(id,nome_completo,cpf,telefone,email),cliente_vinculado:clientes!importacoes_boletos_cliente_vinculado_id_fkey(id,nome_completo,cpf,telefone,email),carne:carnes!importacoes_boletos_carne_id_fkey(id,cliente_id,instituicao_financeira,identificador_externo,quantidade_parcelas,valor_parcela,valor_total,status),boleto:boletos!importacoes_boletos_boleto_id_fkey(id,cliente_id,carne_id,numero_parcela,total_parcelas,valor,data_vencimento,status,instituicao_financeira,identificador_externo,origem_boleto)`)
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Importação não encontrada." }, { status: 404 });

  const ids = Array.isArray(data.analise_detalhada?.candidatos)
    ? data.analise_detalhada.candidatos.map((c: any) => c.id).filter(Boolean)
    : [];
  let candidatos: any[] = [];
  if (ids.length) {
    const result = await supabase.from("boletos").select(boletoSelect).in("id", ids);
    if (result.error) return NextResponse.json({ erro: result.error.message }, { status: 500 });
    const porId = new Map((result.data ?? []).map((c: any) => [c.id, c]));
    candidatos = data.analise_detalhada.candidatos
      .map((meta: any) => ({ ...porId.get(meta.id), pontuacao: meta.pontuacao, percentual: meta.percentual, motivos: meta.motivos }))
      .filter((c: any) => c.id);
  }

  const clienteId = data.cliente_vinculado_id ?? data.cliente_sugerido_id ?? data.cliente_id ?? null;
  let carnes_disponiveis: any[] = [];
  let boletos_disponiveis: any[] = [];
  let boletos_legados: any[] = [];

  if (clienteId) {
    const [carnesResult, boletosResult] = await Promise.all([
      supabase.from("carnes").select("id,cliente_id,instituicao_financeira,identificador_externo,quantidade_parcelas,valor_parcela,valor_total,status,data_geracao").eq("cliente_id", clienteId).order("data_geracao", { ascending: false }),
      supabase.from("boletos").select(boletoSelect).eq("cliente_id", clienteId).order("numero_parcela", { ascending: true }),
    ]);
    if (carnesResult.error) return NextResponse.json({ erro: carnesResult.error.message }, { status: 500 });
    if (boletosResult.error) return NextResponse.json({ erro: boletosResult.error.message }, { status: 500 });
    carnes_disponiveis = carnesResult.data ?? [];
    boletos_disponiveis = (boletosResult.data ?? []).filter((b: any) => b.carne_id);
    boletos_legados = (boletosResult.data ?? []).filter((b: any) => !b.carne_id);
  }

  return NextResponse.json({
    importacao: data,
    candidatos,
    carnes_disponiveis,
    boletos_disponiveis,
    boletos_legados,
  });
}
