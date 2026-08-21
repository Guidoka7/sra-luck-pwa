"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  WalletCards,
  CircleDollarSign,
  Heart,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PixPagamento } from "@/components/cliente/PixPagamento";
import { percentualNecessario, formatarMoeda } from "@/lib/utils";

type StatusBoleto = "nao_pago" | "pago" | "pendente_confirmacao" | "rejeitado";

interface Boleto {
  id: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string;
  status: StatusBoleto;
  data_pagamento: string | null;
  comprovante_url: string | null;
  boleto_url: string | null;
}

interface ProgressoResponse {
  cliente_id: string;
  quantidade_parcelas: number;
  porcentagem_pagamento: number;
  pode_agendar: boolean;
  parcelas_pagas: number;
  parcelas_nao_pagas: number;
  boletos: Boleto[];
}

const STATUS_LABEL: Record<StatusBoleto, string> = {
  pago: "Pago",
  nao_pago: "",
  pendente_confirmacao: "Comprovante em análise",
  rejeitado: "Comprovante rejeitado",
};

const STATUS_ICON = {
  pago: <CheckCircle className="h-5 w-5 text-success" />,
  nao_pago: <AlertCircle className="h-5 w-5 text-clay/30" />,
  pendente_confirmacao: <Clock className="h-5 w-5 text-gold" />,
  rejeitado: <AlertCircle className="h-5 w-5 text-alert" />,
};

const STATUS_PILL_CLASS: Record<StatusBoleto, string> = {
  pago: "bg-success/12 text-success",
  nao_pago: "bg-clay/10 text-clay/60",
  pendente_confirmacao: "bg-gold/15 text-gold",
  rejeitado: "bg-alert/12 text-alert",
};

function getProgressoCorClass(porcentagem: number, necessario: number) {
  if (porcentagem >= 100) return "bg-success";
  if (porcentagem >= necessario) return "bg-success/70";
  if (porcentagem >= necessario * 0.65) return "bg-gold";
  if (porcentagem >= necessario * 0.4) return "bg-gold/60";
  return "bg-clay/40";
}

function getMensagem(porcentagem: number, pagas: number, total: number, necessario: number) {
  if (porcentagem >= 100) return "🎉 Parabéns! Você desbloqueou sua agenda cirúrgica!";
  if (porcentagem >= necessario) return `✨ Sua agenda já está liberada (${porcentagem}%)! Faltam apenas ${total - pagas} parcelas para quitar o contrato.`;
  if (porcentagem >= necessario * 0.65) return `🎯 Você está em ${porcentagem}%. São necessários ${necessario}% para desbloquear sua agenda.`;
  return `Vamos lá! Você está em ${porcentagem}%. São necessários ${necessario}% para desbloquear sua agenda — envie seus comprovantes para acelerar.`;
}

function BarraProgresso({ porcentagem, parcelas_pagas, total, necessario, procedimento }: { porcentagem: number; parcelas_pagas: number; total: number; necessario: number; procedimento?: string | null }) {
  const [aberto, setAberto] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-rose/10"><Heart className="h-4 w-4 fill-rose text-rose" /></span>
          <p className="text-sm font-semibold leading-relaxed text-burgundy">{procedimento ? `Cada parcela aproxima você do seu grande sonho: ${procedimento}.` : "Cada parcela aproxima você do seu tão sonhado procedimento."}</p>
        </div>
        <span className="text-xl font-bold text-gold">{porcentagem}%</span>
      </div>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full rounded-xl text-left">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-clay/20"><motion.div initial={{ width: 0 }} animate={{ width: `${porcentagem}%` }} transition={{ duration: 0.8 }} className={`h-full ${getProgressoCorClass(porcentagem, necessario)}`} /></div>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-clay/50">{aberto ? "Ocultar acompanhamento" : "Ver acompanhamento"}{aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</p>
      </button>
      <AnimatePresence initial={false}>{aberto && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="space-y-3 border-t border-clay/10 pt-3"><div className="flex items-center justify-between text-sm"><span className="text-clay/60"><strong className="text-burgundy">{parcelas_pagas}</strong> de <strong>{total}</strong> parcelas pagas</span>{porcentagem >= necessario && <span className="text-success">✓ Agenda liberada</span>}</div><div className="rounded-lg bg-bloom/50 p-3 text-center text-sm text-burgundy">{getMensagem(porcentagem, parcelas_pagas, total, necessario)}</div></div></motion.div>}</AnimatePresence>
    </motion.div>
  );
}

function ModalUploadComprovante({ aberto, boletoId, parcela, onFechado, onSucesso }: { aberto: boolean; boletoId: string; parcela: number; onFechado: () => void; onSucesso: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  async function handleUpload() {
    if (!arquivo) return toast.error("Selecione um comprovante primeiro.");
    if (arquivo.size > 5 * 1024 * 1024) return toast.error("Arquivo maior que 5MB não é permitido.");
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const res = await fetch(`/api/cliente/boletos/${boletoId}/anexar`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao enviar comprovante.");
      toast.success("Comprovante enviado. Vamos validar em até 24h.");
      onSucesso();
      onFechado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
      setArquivo(null);
    }
  }

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h3 className="font-heading text-lg font-semibold text-burgundy">Comprovante · Parcela {parcela}</h3><button onClick={onFechado} className="text-clay/40">×</button></div>
        <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-gold/30 bg-cream/30 p-5 text-center hover:border-gold/60">
          <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
          <Upload className="mx-auto mb-2 h-7 w-7 text-gold" />
          <p className="text-sm text-clay/60">{arquivo ? arquivo.name : "Selecionar comprovante"}</p>
          <p className="mt-1 text-xs text-clay/40">PDF, JPG ou PNG · máximo 5MB</p>
        </label>
        <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={onFechado} disabled={enviando} className="flex-1">Cancelar</Button><Button onClick={handleUpload} loading={enviando} className="flex-1">Enviar comprovante</Button></div>
      </motion.div>
    </div>
  );
}

interface CardParcelaProps {
  boleto: Boleto;
  onAnexarClick: () => void;
  pagamento?: { pixChave: string | null; pixQrCodeUrl: string | null; pixDescontoPercentual?: number };
}

function CardParcela({ boleto, onAnexarClick, pagamento }: CardParcelaProps) {
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [pixAberto, setPixAberto] = useState(false);
  const vencimento = new Date(`${boleto.data_vencimento}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasEmAtraso = Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86_400_000));
  const isVencida = diasEmAtraso > 0 && boleto.status === "nao_pago";
  const juros = boleto.valor * diasEmAtraso * 0.002;
  const multa = boleto.valor * Math.ceil(diasEmAtraso / 30) * 0.02;
  const encargos = juros + multa;
  const valorAtualizado = boleto.valor + encargos;
  const percentualDescontoPix = pagamento?.pixDescontoPercentual ?? 0;
  const temDescontoPix = isVencida && percentualDescontoPix > 0;
  const economiaPix = encargos * (percentualDescontoPix / 100);
  const valorComDescontoPix = valorAtualizado - economiaPix;

  const formatarData = (data: string) => new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
  const valorHoje = temDescontoPix ? valorComDescontoPix : isVencida ? valorAtualizado : boleto.valor;
  const bgClass = boleto.status === "pago" ? "bg-success/5 border-success/20" : isVencida ? "bg-alert/5 border-alert/20" : boleto.status === "pendente_confirmacao" ? "bg-gold/5 border-gold/20" : boleto.status === "rejeitado" ? "bg-alert/5 border-alert/20" : "bg-white border-clay/10";

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border ${bgClass} p-3.5 shadow-sm sm:p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-clay/10">{STATUS_ICON[boleto.status]}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><p className="font-heading text-sm font-semibold text-burgundy sm:text-base">Parcela {boleto.numero_parcela}<span className="text-clay/40">/{boleto.total_parcelas}</span></p>{boleto.status !== "nao_pago" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL_CLASS[boleto.status]}`}>{STATUS_LABEL[boleto.status]}</span>}</div>
            <p className="mt-0.5 text-xs text-clay/55">Vencimento {formatarData(boleto.data_vencimento)}</p>
            {isVencida && <span className="mt-1 inline-flex rounded-full bg-alert/10 px-2 py-0.5 text-[10px] font-semibold text-alert">{diasEmAtraso} dia{diasEmAtraso === 1 ? "" : "s"} em atraso</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isVencida && <p className="text-[10px] text-clay/40 line-through">{formatarMoeda(boleto.valor)}</p>}
          <p className={`font-heading text-base font-bold sm:text-lg ${isVencida && temDescontoPix ? "text-success" : "text-burgundy"}`}>{formatarMoeda(valorHoje)}</p>
          {isVencida && <p className="text-[10px] text-clay/45">para pagar hoje</p>}
        </div>
      </div>

      {isVencida && (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-alert/5 px-3 py-2 text-[11px] text-clay/60">
          <span>Encargos por {diasEmAtraso} dia{diasEmAtraso === 1 ? "" : "s"}: <strong className="text-burgundy">{formatarMoeda(encargos)}</strong></span>
          {temDescontoPix && <span className="font-semibold text-success">PIX economiza {formatarMoeda(economiaPix)}</span>}
        </div>
      )}

      {boleto.status === "pendente_confirmacao" && boleto.comprovante_url && (
        <a href={`/api/cliente/boletos/${boleto.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="mt-2.5 flex items-center justify-between rounded-xl bg-gold/8 px-3 py-2 text-xs text-gold"><span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Comprovante em análise</span><Download className="h-3.5 w-3.5" /></a>
      )}

      {boleto.status === "rejeitado" && <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-alert/8 px-3 py-2 text-xs text-alert"><span>Comprovante rejeitado</span><button onClick={onAnexarClick} className="font-semibold underline">Reenviar</button></div>}

      {boleto.status === "nao_pago" && (
        <>
          <button type="button" onClick={() => setAcoesAbertas((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-burgundy px-3.5 py-2.5 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:brightness-105">
            <span className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Resolver esta parcela</span>
            {acoesAbertas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence initial={false}>
            {acoesAbertas && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-2 rounded-xl border border-rose/10 bg-white/70 p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {pagamento?.pixChave || pagamento?.pixQrCodeUrl ? <button type="button" onClick={() => setPixAberto((v) => !v)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition ${pixAberto ? "bg-gold/15 text-burgundy" : "bg-cream text-burgundy hover:bg-gold/10"}`}><CircleDollarSign className="h-4 w-4 text-gold" />PIX</button> : <span className="flex flex-col items-center justify-center gap-1 rounded-xl bg-clay/5 px-2 py-2.5 text-[10px] text-clay/30">PIX indisponível</span>}
                    <button type="button" onClick={onAnexarClick} className="flex flex-col items-center gap-1 rounded-xl bg-cream px-2 py-2.5 text-[10px] font-semibold text-burgundy hover:bg-rose/10"><Upload className="h-4 w-4 text-rose" />Comprovante</button>
                    {boleto.boleto_url ? <a href={`/api/cliente/boletos/${boleto.id}/arquivo`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-xl bg-cream px-2 py-2.5 text-[10px] font-semibold text-burgundy hover:bg-rose/10"><FileText className="h-4 w-4 text-rose" />Ver boleto</a> : <span className="flex flex-col items-center justify-center gap-1 rounded-xl bg-clay/5 px-2 py-2.5 text-[10px] text-clay/30">Boleto indisponível</span>}
                  </div>
                  {pixAberto && pagamento && (pagamento.pixChave || pagamento.pixQrCodeUrl) && <div className="mt-2"><PixPagamento pixChave={pagamento.pixChave} pixQrCodeUrl={pagamento.pixQrCodeUrl} desconto={temDescontoPix ? { percentual: percentualDescontoPix, economia: economiaPix, valorComDesconto: valorComDescontoPix } : null} /></div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {boleto.status === "pago" && boleto.data_pagamento && <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-success/8 px-3 py-2 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> Pago em {formatarData(boleto.data_pagamento)}</div>}
    </motion.div>
  );
}

interface TabBoletosProps {
  pagamento?: { pixChave: string | null; pixQrCodeUrl: string | null; pixDescontoPercentual?: number };
  procedimento?: string | null;
}

export function TabBoletos({ pagamento, procedimento }: TabBoletosProps) {
  const [carregando, setCarregando] = useState(true);
  const [progresso, setProgresso] = useState<ProgressoResponse | null>(null);
  const [boletoSelecionado, setBoletoSelecionado] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [carteiraAberta, setCarteiraAberta] = useState(false);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetch("/api/cliente/boletos", { cache: "no-store" });
      if (!res.ok) throw new Error("Erro ao carregar");
      setProgresso(await res.json());
    } catch {
      if (!silencioso) toast.error("Erro ao carregar boletos");
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => carregar(true), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  if (carregando) return <p className="text-center text-clay/50">Carregando boletos...</p>;
  if (!progresso) return <Card className="p-6 text-center"><p className="text-clay/60">Não foi possível carregar seus boletos.</p><Button onClick={() => carregar()} variant="ghost" className="mt-2" size="sm">Tentar novamente</Button></Card>;

  const boletoPorAnexar = progresso.boletos.find((b) => b.id === boletoSelecionado);
  const necessario = percentualNecessario(progresso.quantidade_parcelas);
  const boletosPagos = progresso.boletos.filter((b) => b.status === "pago");
  const boletosEmAberto = progresso.boletos.filter((b) => b.status !== "pago");
  const totalPago = boletosPagos.reduce((total, b) => total + b.valor, 0);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5"><BarraProgresso porcentagem={progresso.porcentagem_pagamento} parcelas_pagas={progresso.parcelas_pagas} total={progresso.quantidade_parcelas} necessario={necessario} procedimento={procedimento} /></Card>

      <Card className="overflow-hidden p-0">
        <button type="button" onClick={() => setCarteiraAberta((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-bloom/50">
          <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10"><WalletCards className="h-4 w-4 text-success" /></span><span><span className="block text-sm font-semibold text-burgundy">Parcelas pagas</span><span className="block text-xs text-clay/55">{boletosPagos.length} pagamento{boletosPagos.length === 1 ? "" : "s"} · {formatarMoeda(totalPago)}</span></span></span>{carteiraAberta ? <ChevronUp className="h-4 w-4 text-clay/50" /> : <ChevronDown className="h-4 w-4 text-clay/50" />}
        </button>
        <AnimatePresence initial={false}>{carteiraAberta && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-2 border-t border-clay/10 px-4 pb-4 pt-3">{boletosPagos.length ? boletosPagos.map((b) => <CardParcela key={b.id} boleto={b} onAnexarClick={() => {}} pagamento={pagamento} />) : <p className="py-2 text-center text-sm text-clay/50">Seus pagamentos confirmados aparecerão aqui.</p>}</div></motion.div>}</AnimatePresence>
      </Card>

      <Card className="space-y-3 p-4 sm:p-5">
        <div><h2 className="font-semibold text-burgundy">Parcelas em aberto</h2><p className="mt-1 text-xs text-clay/55">Escolha como deseja resolver cada parcela. Tudo fica concentrado em um único card.</p></div>
        <div className="space-y-2.5">{boletosEmAberto.map((b) => <CardParcela key={b.id} boleto={b} pagamento={pagamento} onAnexarClick={() => { setBoletoSelecionado(b.id); setModalAberto(true); }} />)}{boletosEmAberto.length === 0 && <p className="py-2 text-center text-sm text-success">Tudo certo: não há parcelas em aberto.</p>}</div>
      </Card>

      {boletoPorAnexar && <ModalUploadComprovante aberto={modalAberto} boletoId={boletoPorAnexar.id} parcela={boletoPorAnexar.numero_parcela} onFechado={() => setModalAberto(false)} onSucesso={() => carregar()} />}
    </div>
  );
}
