import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

function texto(...valores: unknown[]) { const valor = valores.find((v) => typeof v === "string" && v.trim()); return valor ? String(valor).trim() : null; }
function numero(...valores: unknown[]) {
  const valor = valores.find((v) => v !== null && v !== undefined && v !== "");
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const bruto = String(valor).trim().replace(/\s/g, "");
  const normalizado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

function normalizarVenda(payload: Record<string, any>) {
  const dados = payload.data ?? payload.deal ?? payload.opportunity ?? payload;
  const status = texto(payload.event, payload.event_type, payload.type, dados.status, dados.stage_name)?.toLowerCase() ?? "";
  const concluida = ["won", "won_deal", "deal_won", "closed_won", "ganho", "venda_concluida", "closed won"].some((s) => status.includes(s)) || payload.sale_completed === true || payload.completed === true;
  if (!concluida) return null;

  const id = texto(dados.id, dados.deal_id, dados.opportunity_id, payload.id, payload.external_id);
  if (!id) throw new Error("ID externo do RD Station não informado.");
  return {
    rd_station_id: id,
    nome_completo: texto(dados.name, dados.full_name, dados.contact?.name, dados.person?.name, dados.customer?.name) ?? "",
    cpf: texto(dados.cpf, dados.contact?.cpf, dados.person?.cpf, dados.customer?.cpf),
    telefone: texto(dados.phone, dados.mobile_phone, dados.contact?.phone, dados.customer?.phone),
    email: texto(dados.email, dados.contact?.email, dados.person?.email, dados.customer?.email),
    data_venda: texto(dados.won_at, dados.closed_at, dados.sale_date, payload.timestamp) ?? new Date().toISOString(),
    vendedora_responsavel: texto(dados.owner_name, dados.seller_name, dados.salesperson, dados.owner?.name, dados.user?.name),
    valor_contrato: numero(dados.amount, dados.value, dados.deal_value, dados.contract_value) ?? 0,
    quantidade_parcelas: numero(dados.installments, dados.installment_count, dados.quantity_installments),
    valor_parcela: numero(dados.installment_value, dados.monthly_payment, dados.parcela),
    taxa_administrativa: numero(dados.administrative_fee, dados.admin_fee, dados.taxa_administrativa),
    tipo_venda: texto(dados.sale_type, dados.deal_type, dados.tipo_venda),
    origem_venda: texto(dados.source, dados.origin, dados.lead_source) ?? "RD Station",
    payload_original: payload,
  };
}

export async function POST(req: Request) {
  const secret = process.env.RD_STATION_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ erro: "Webhook RD Station não configurado neste ambiente." }, { status: 503 });
  if (req.headers.get("x-rd-station-secret") !== secret) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") return NextResponse.json({ erro: "Payload inválido." }, { status: 400 });
  try {
    const venda = normalizarVenda(payload as Record<string, any>);
    if (!venda) return NextResponse.json({ ok: true, ignorado: true, motivo: "Evento não representa venda concluída." });
    if (!venda.nome_completo) return NextResponse.json({ erro: "Nome da cliente não encontrado no payload." }, { status: 400 });
    const service = createServiceSupabaseClient();
    const { data, error } = await service.from("novas_vendas").upsert(venda, { onConflict: "rd_station_id" }).select("id, rd_station_id, status").single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, novaVendaId: data.id, rdStationId: data.rd_station_id, status: data.status });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Falha ao processar webhook." }, { status: 400 });
  }
}
