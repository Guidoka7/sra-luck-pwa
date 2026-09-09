import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase.from("carnes").select(`id, cliente_id, instituicao_financeira, identificador_externo, data_geracao, quantidade_parcelas, valor_parcela, valor_total, status, created_at, updated_at, clientes ( id, nome_completo, cpf, telefone, email ), boletos ( id, numero_parcela, total_parcelas, valor, data_vencimento, status, identificador_externo, origem_boleto, data_pagamento, observacoes )`).eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Carnê não encontrado." }, { status: 404 });

  const boletos = Array.isArray((data as any).boletos) ? (data as any).boletos : [];
  const totalPago = boletos.filter((b: any) => b.status === "pago").reduce((s: number, b: any) => s + Number(b.valor ?? 0), 0);
  const parcelasPagas = boletos.filter((b: any) => b.status === "pago").length;
  return NextResponse.json({ carne: { ...data, valor_parcela: Number((data as any).valor_parcela), valor_total: Number((data as any).valor_total), boletos }, resumo: { valor_total: Number((data as any).valor_total), total_pago: totalPago, total_pendente: Math.max(0, Number((data as any).valor_total) - totalPago), quantidade_parcelas: Number((data as any).quantidade_parcelas), parcelas_pagas: parcelasPagas, parcelas_pendentes: Math.max(0, Number((data as any).quantidade_parcelas) - parcelasPagas) } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const allowed: Record<string, unknown> = {};
  if (typeof body?.status === "string" && ["ativo", "concluido"].includes(body.status)) allowed.status = body.status;
  if (typeof body?.observacao === "string") allowed.updated_at = new Date().toISOString();
  if (Object.keys(allowed).length === 0) return NextResponse.json({ erro: "Nenhuma alteração válida informada." }, { status: 400 });
  const { data, error } = await supabase.from("carnes").update(allowed).eq("id", params.id).select("id, status, updated_at").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ carne: data });
}
