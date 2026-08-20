/**
 * TabBoletos.tsx
 * 
 * Aba de acompanhamento de boletos e progresso de pagamento
 * para a cliente. Integra-se na página /agenda.
 * 
 * Features:
 * - Barra de progresso visual + cores dinâmicas
 * - Lista de parcelas com status individual
 * - Upload de comprovante por boleto
 * - Bloqueio condicional da agenda
 */

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

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_LABEL: Record<StatusBoleto, string> = {
  pago: "Pago",
  nao_pago: "",
  pendente_confirmacao: "Comprovante em Análise",
  rejeitado: "Comprovante Rejeitado",
};

const STATUS_ICON = {
  pago: <CheckCircle className="h-5 w-5 text-success" />,
  nao_pago: <AlertCircle className="h-5 w-5 text-clay/30" />,
  pendente_confirmacao: <Clock className="h-5 w-5 text-gold" />,
  rejeitado: <AlertCircle className="h-5 w-5 text-alert" />,
};

const getProgressoCorClass = (porcentagem: number, necessario: number) => {
  if (porcentagem >= 100) return "bg-success";
  if (porcentagem >= necessario) return "bg-success/70";
  if (porcentagem >= necessario * 0.65) return "bg-gold";
  if (porcentagem >= necessario * 0.4) return "bg-gold/60";
  return "bg-clay/40";
};

const getMensagem = (
  porcentagem: number,
  parcelas_pagas: number,
  total: number,
  necessario: number
) => {
  if (porcentagem >= 100) {
    return "🎉 Parabéns! Você desbloqueou sua agenda cirúrgica!";
  }
  if (porcentagem >= necessario) {
    return `✨ Sua agenda já está liberada (${porcentagem}%)! Faltam apenas ${total - parcelas_pagas} parcelas para quitar o contrato.`;
  }
  if (porcentagem >= necessario * 0.65) {
    return `🎯 Você está em ${porcentagem}%. São necessários ${necessario}% para desbloquear sua agenda.`;
  }
  return `Vamos lá! Você está em ${porcentagem}%. São necessários ${necessario}% para desbloquear sua agenda — envie seus comprovantes para acelerar.`;
};

// ============================================================================
// COMPONENT: Barra de Progresso
// ============================================================================

interface BarraProgressoProps {
  porcentagem: number;
  parcelas_pagas: number;
  total: number;
  necessario: number;
  procedimento?: string | null;
}

function BarraProgresso({
  porcentagem,
  parcelas_pagas,
  total,
  necessario,
  procedimento,
}: BarraProgressoProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-rose/10">
            <Heart className="h-4 w-4 fill-rose text-rose" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold leading-relaxed text-burgundy">
            {procedimento
              ? `Cada parcela aproxima você do seu grande sonho: ${procedimento}.`
              : "Cada parcela aproxima você do seu tão sonhado procedimento."}
          </p>
        </div>
        <span className="text-xl font-bold text-gold">{porcentagem}%</span>
      </div>

      <button
        type="button"
        onClick={() => setDetalhesAbertos((aberto) => !aberto)}
        aria-expanded={detalhesAbertos}
        className="w-full rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-clay/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${porcentagem}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full ${getProgressoCorClass(porcentagem, necessario)} transition-all duration-300`}
          />
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-clay/50">
          Toque na barra para {detalhesAbertos ? "ocultar" : "ver"} o acompanhamento
          {detalhesAbertos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </p>
      </button>

      <AnimatePresence initial={false}>
        {detalhesAbertos && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-clay/10 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-clay/60"><strong className="text-burgundy">{parcelas_pagas}</strong> de <strong>{total}</strong> parcelas pagas</span>
                {porcentagem >= necessario && <span className="text-success">✓ Agenda liberada</span>}
              </div>
              <div className="rounded-lg bg-bloom/50 p-3 text-center text-sm text-burgundy">
                {getMensagem(porcentagem, parcelas_pagas, total, necessario)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// COMPONENT: Modal de Upload
// ============================================================================

interface ModalUploadProps {
  aberto: boolean;
  boletoId: string;
  parcela: number;
  onFechado: () => void;
  onSucesso: () => void;
}

function ModalUploadComprovante({
  aberto,
  boletoId,
  parcela,
  onFechado,
  onSucesso,
}: ModalUploadProps) {
  const [enviando, setEnviando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!arquivo) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      toast.error("Arquivo maior que 5MB não é permitido");
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);

      const res = await fetch(`/api/cliente/boletos/${boletoId}/anexar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.erro || "Erro ao enviar arquivo");
        return;
      }

      toast.success(
        "Comprovante enviado com sucesso! Vamos validar em até 24h." 
      );
      onSucesso();
      onFechado();
    } catch (err) {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
      setArquivo(null);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold text-burgundy">
          Comprovante da Parcela {parcela}
        </h3>

        <div className="mb-4 space-y-3">
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gold/30 p-6 text-center transition hover:border-gold/60">
            <input
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
            />
            <Upload className="mx-auto mb-2 h-8 w-8 text-gold" />
            <p className="text-sm text-clay/60">
              {arquivo ? arquivo.name : "Clique ou arraste o arquivo aqui"}
            </p>
            <p className="mt-1 text-xs text-clay/40">PDF, JPG ou PNG (máx 5MB)</p>
          </label>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onFechado}
            disabled={enviando}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            loading={enviando}
            className="flex-1"
          >
            Enviar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// COMPONENT: Card de Parcela
// ============================================================================

interface CardParcelaProps {
  boleto: Boleto;
  onAnexarClick: () => void;
  onRecarregar: () => void;
  pagamento?: { pixChave: string | null; pixQrCodeUrl: string | null; pixDescontoPercentual?: number };
}

const STATUS_PILL_CLASS: Record<StatusBoleto, string> = {
  pago: "bg-success/12 text-success",
  nao_pago: "bg-clay/10 text-clay/60",
  pendente_confirmacao: "bg-gold/15 text-gold",
  rejeitado: "bg-alert/12 text-alert",
};

function CardParcela({ boleto, onAnexarClick, onRecarregar, pagamento }: CardParcelaProps) {
  const [expandido, setExpandido] = useState(false);
  const [pixAberto, setPixAberto] = useState(false);
  const vencimento = new Date(`${boleto.data_vencimento}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasEmAtraso = Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86_400_000));
  const isVencida = diasEmAtraso > 0 && boleto.status === "nao_pago";
  // 6% a.m. equivale a 0,20% ao dia. A multa é aplicada a cada mês (ou fração) em atraso.
  const juros = boleto.valor * diasEmAtraso * 0.002;
  const multa = boleto.valor * Math.ceil(diasEmAtraso / 30) * 0.02;
  const encargos = juros + multa;
  const valorAtualizado = boleto.valor + encargos;

  // Desconto PIX: incide só sobre os encargos (juros + multa), nunca sobre o
  // valor original da parcela. Configurado pelo admin em /admin/configuracoes.
  const percentualDescontoPix = pagamento?.pixDescontoPercentual ?? 0;
  const temDescontoPix = isVencida && percentualDescontoPix > 0;
  const economiaPix = encargos * (percentualDescontoPix / 100);
  const valorComDescontoPix = valorAtualizado - economiaPix;

  const formatarData = (data: string) => {
    return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
  };

  const bgClass = {
    pago: "bg-success/5 border-success/20",
    nao_pago: isVencida ? "bg-alert/5 border-alert/20" : "border-clay/10 bg-white",
    pendente_confirmacao: "bg-gold/5 border-gold/20",
    rejeitado: "bg-alert/5 border-alert/20",
  }[boleto.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${bgClass} p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card sm:p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-clay/10">
            {STATUS_ICON[boleto.status]}
          </span>
          <div>
            <p className="font-heading text-sm font-semibold text-burgundy sm:text-base">
              Parcela {boleto.numero_parcela}
              <span className="text-clay/40">/{boleto.total_parcelas}</span>
            </p>
            <p className="mt-0.5 text-xs text-clay/55 sm:text-sm">
              Vencimento {formatarData(boleto.data_vencimento)}
            </p>
            {/* A parcela em aberto e ainda não vencida não precisa de selo —
                "Não Pago" soa negativo e a data de vencimento já basta.
                Só mostramos o selo quando há algo relevante: pago,
                em análise, rejeitado ou em atraso. */}
            {(boleto.status !== "nao_pago" || isVencida) && (
              <span
                className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_PILL_CLASS[boleto.status]}`}
              >
                {isVencida
                  ? `${diasEmAtraso} dia${diasEmAtraso === 1 ? "" : "s"} em atraso`
                  : STATUS_LABEL[boleto.status]}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          {isVencida ? (
            <>
              {temDescontoPix ? (
                <>
                  <p className="text-xs text-clay/40 line-through">{formatarMoeda(valorAtualizado)}</p>
                  <p className="font-heading text-lg font-bold text-success">
                    {formatarMoeda(valorComDescontoPix)}
                  </p>
                  <p className="text-[11px] font-medium text-success/80">no PIX hoje</p>
                </>
              ) : (
                <p className="font-heading text-lg font-bold text-burgundy">{formatarMoeda(valorAtualizado)}</p>
              )}
            </>
          ) : (
            <p className="font-heading text-lg font-bold text-burgundy">{formatarMoeda(boleto.valor)}</p>
          )}
        </div>
      </div>

      {/* PIX sempre visível quando a parcela está vencida — não deve depender
          de "Mais detalhes", pois é a ação mais urgente pra cliente nesse momento. */}
      {isVencida && boleto.status === "nao_pago" && pagamento && (pagamento.pixChave || pagamento.pixQrCodeUrl) && (
        <div className="mt-4">
          <Button size="sm" onClick={() => setPixAberto((aberto) => !aberto)} className="w-full gap-2">
            <CircleDollarSign className="h-4 w-4" />
            {temDescontoPix ? `Pagar via PIX com ${percentualDescontoPix}% de desconto` : "Pagar via PIX"}
          </Button>
          <AnimatePresence initial={false}>
            {pixAberto && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-3">
                  <PixPagamento
                    pixChave={pagamento.pixChave}
                    pixQrCodeUrl={pagamento.pixQrCodeUrl}
                    desconto={
                      temDescontoPix
                        ? {
                            percentual: percentualDescontoPix,
                            economia: economiaPix,
                            valorComDesconto: valorComDescontoPix,
                          }
                        : null
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Seção expandida */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 border-t border-clay/20 pt-4"
          >
            {boleto.status === "pago" && boleto.data_pagamento && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                Pago em {formatarData(boleto.data_pagamento)}
              </div>
            )}

            {boleto.status === "pendente_confirmacao" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-gold/10 p-3 text-sm text-gold">
                  <span>⏳ Aguardando validação (até 24h)</span>
                  {boleto.comprovante_url && (
                    <a
                      href={`/api/cliente/boletos/${boleto.id}/comprovante`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gold/20"
                    >
                      <Download className="h-3 w-3" /> Ver comprovante
                    </a>
                  )}
                </div>
                {boleto.boleto_url && (
                  <a
                    href={`/api/cliente/boletos/${boleto.id}/arquivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-clay/20 bg-white px-3 py-2 text-sm font-medium text-burgundy transition hover:bg-bloom/50"
                  >
                    <FileText className="h-4 w-4" /> Visualizar Boleto
                  </a>
                )}
              </div>
            )}

            {boleto.status === "rejeitado" && (
              <div className="space-y-2">
                <p className="text-sm text-alert">❌ Seu comprovante foi rejeitado</p>
                <Button
                  size="sm"
                  onClick={onAnexarClick}
                  className="w-full gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Reenviar Comprovante
                </Button>
              </div>
            )}

            {boleto.status === "nao_pago" && (
              <div className="space-y-3">
                {isVencida && (
                  <div className="rounded-xl bg-alert/8 p-3.5 text-sm text-clay/70">
                    <div className="flex items-center justify-between gap-3 text-burgundy">
                      <span>Valor original</span>
                      <span>{formatarMoeda(boleto.valor)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-burgundy">
                      <span>Valor atualizado</span>
                      <strong>{formatarMoeda(valorAtualizado)}</strong>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-clay/55">
                      Juros: {formatarMoeda(juros)} ({diasEmAtraso} dias · 0,20% ao dia) · Multa: {formatarMoeda(multa)} (2% ao mês).
                    </p>
                    {temDescontoPix && (
                      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-burgundy/10 pt-2.5 text-success">
                        <span className="font-medium">Pagando via PIX hoje ({percentualDescontoPix}% off nos encargos)</span>
                        <strong>{formatarMoeda(valorComDescontoPix)}</strong>
                      </div>
                    )}
                  </div>
                )}
                {boleto.boleto_url && (
                  <a
                    href={`/api/cliente/boletos/${boleto.id}/arquivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-clay/20 bg-white px-3 py-2 text-sm font-medium text-burgundy transition hover:bg-bloom/50"
                  >
                    <FileText className="h-4 w-4" /> Visualizar Boleto
                  </a>
                )}
                <Button size="sm" onClick={onAnexarClick} variant={isVencida ? "ghost" : "primary"} className="w-full gap-2">
                  <Upload className="h-4 w-4" /> Anexar Comprovante
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão expandir */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-clay/60 transition hover:text-burgundy"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${
            expandido ? "rotate-180" : ""
          }`}
        />
        {expandido ? "Menos detalhes" : "Mais detalhes"}
      </button>
    </motion.div>
  );
}

// ============================================================================
// COMPONENT: Tab Boletos (Main)
// ============================================================================

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

  const carregar = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetch("/api/cliente/boletos");
      if (!res.ok) throw new Error("Erro ao carregar");
      const data = await res.json();
      setProgresso(data);
    } catch (err) {
      if (!silencioso) toast.error("Erro ao carregar boletos");
    } finally {
      if (!silencioso) setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // Atualiza sozinho a cada 30s — a confirmação de um comprovante é feita
    // pelo admin em outra sessão, então o status muda sem a cliente saber.
    const intervalo = setInterval(() => carregar(true), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  if (carregando) {
    return <p className="text-center text-clay/50">Carregando boletos...</p>;
  }

  if (!progresso) {
    return (
      <Card className="p-6 text-center">
        <p className="text-clay/60">Não foi possível carregar seus boletos.</p>
        <Button onClick={() => carregar()} variant="ghost" className="mt-2" size="sm">
          Tentar novamente
        </Button>
      </Card>
    );
  }

  const boletoPorAnexar = progresso.boletos.find((b) => b.id === boletoSelecionado);
  const necessario = percentualNecessario(progresso.quantidade_parcelas);
  const boletosPagos = progresso.boletos.filter((boleto) => boleto.status === "pago");
  const boletosEmAberto = progresso.boletos.filter((boleto) => boleto.status !== "pago");
  const totalPago = boletosPagos.reduce((total, boleto) => total + boleto.valor, 0);

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <BarraProgresso
          porcentagem={progresso.porcentagem_pagamento}
          parcelas_pagas={progresso.parcelas_pagas}
          total={progresso.quantidade_parcelas}
          necessario={necessario}
          procedimento={procedimento}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setCarteiraAberta((aberta) => !aberta)}
          aria-expanded={carteiraAberta}
          className="flex w-full items-center justify-between gap-3 p-5 text-left transition hover:bg-bloom/50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10"><WalletCards className="h-5 w-5 text-success" /></span>
            <span>
              <span className="block font-semibold text-burgundy">Parcelas pagas</span>
              <span className="block text-xs text-clay/55">{boletosPagos.length} pagamento{boletosPagos.length === 1 ? "" : "s"} · R$ {totalPago.toFixed(2).replace(".", ",")}</span>
            </span>
          </span>
          {carteiraAberta ? <ChevronUp className="h-5 w-5 text-clay/50" /> : <ChevronDown className="h-5 w-5 text-clay/50" />}
        </button>
        <AnimatePresence initial={false}>
          {carteiraAberta && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-3 border-t border-clay/10 px-5 pb-5 pt-4">
                {boletosPagos.length ? boletosPagos.map((boleto) => (
                  <CardParcela key={boleto.id} boleto={boleto} onAnexarClick={() => {}} onRecarregar={carregar} pagamento={pagamento} />
                )) : <p className="py-2 text-center text-sm text-clay/50">Seus pagamentos confirmados aparecerão aqui.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card className="space-y-3 p-6">
        <div>
          <h2 className="font-semibold text-burgundy">Parcelas em aberto</h2>
          <p className="mt-1 text-sm text-clay/55">Envie o comprovante de cada pagamento para acompanhamento.</p>
        </div>
        <div className="space-y-3">
          {boletosEmAberto.map((boleto) => (
            <CardParcela
              key={boleto.id}
              boleto={boleto}
              onAnexarClick={() => {
                setBoletoSelecionado(boleto.id);
                setModalAberto(true);
              }}
              onRecarregar={carregar}
              pagamento={pagamento}
            />
          ))}
          {boletosEmAberto.length === 0 && <p className="py-2 text-center text-sm text-success">Tudo certo: não há parcelas em aberto.</p>}
        </div>
      </Card>

      {boletoPorAnexar && (
        <ModalUploadComprovante
          aberto={modalAberto}
          boletoId={boletoPorAnexar.id}
          parcela={boletoPorAnexar.numero_parcela}
          onFechado={() => setModalAberto(false)}
          onSucesso={carregar}
        />
      )}
    </div>
  );
}
