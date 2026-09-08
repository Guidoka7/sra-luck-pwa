// Badges reutilizáveis para status, forma de pagamento e origem.

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_PARCELA,
  STATUS_LABEL,
  FORMA_LABEL,
  ORIGEM_LABEL,
  INTEGRACAO_STATUS,
  INTEGRACAO_STATUS_LABEL,
} from "../types";
import {
  Circle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  XCircle,
  Landmark,
  Wallet,
  CreditCard,
  Receipt,
  Banknote,
  Building2,
  ShieldCheck,
  Hourglass,
} from "lucide-react";

const STATUS_STYLE = {
  [STATUS_PARCELA.pendente]: {
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
    Icon: Clock,
  },
  [STATUS_PARCELA.recebido]: {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    Icon: CheckCircle2,
  },
  [STATUS_PARCELA.atrasado]: {
    className: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50",
    Icon: AlertTriangle,
  },
  [STATUS_PARCELA.aguardando]: {
    className: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50",
    Icon: Hourglass,
  },
  [STATUS_PARCELA.negociado]: {
    className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50",
    Icon: RefreshCw,
  },
  [STATUS_PARCELA.cancelado]: {
    className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100",
    Icon: XCircle,
  },
};

export const StatusBadge = ({ status, testId }) => {
  const s = STATUS_STYLE[status] || { className: "bg-slate-100 text-slate-600 border-slate-200", Icon: Circle };
  const Icon = s.Icon;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-medium ${s.className}`}
      data-testid={testId || `status-badge-${status}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {STATUS_LABEL[status] || status}
    </Badge>
  );
};

const FORMA_ICON = {
  boleto: Receipt,
  pix: Banknote,
  cartao_credito: CreditCard,
  comprovante_manual: ShieldCheck,
  dinheiro: Wallet,
};

export const FormaPagamentoBadge = ({ forma }) => {
  const Icon = FORMA_ICON[forma] || Wallet;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      {FORMA_LABEL[forma] || "—"}
    </span>
  );
};

const ORIGEM_STYLE = {
  conta_azul: { className: "bg-blue-50 text-blue-700 border-blue-200", Icon: Building2 },
  mercado_pago: { className: "bg-yellow-50 text-yellow-800 border-yellow-200", Icon: Wallet },
  banco: { className: "bg-teal-50 text-teal-700 border-teal-200", Icon: Landmark },
  manual: { className: "bg-slate-50 text-slate-700 border-slate-200", Icon: ShieldCheck },
};

export const OrigemBadge = ({ origem }) => {
  const s = ORIGEM_STYLE[origem] || ORIGEM_STYLE.manual;
  const Icon = s.Icon;
  return (
    <Badge variant="outline" className={`gap-1.5 font-normal ${s.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {ORIGEM_LABEL[origem] || "—"}
    </Badge>
  );
};

const INT_STYLE = {
  [INTEGRACAO_STATUS.em_preparacao]: "bg-amber-50 text-amber-700 border-amber-200",
  [INTEGRACAO_STATUS.planejado]: "bg-slate-100 text-slate-600 border-slate-200",
  [INTEGRACAO_STATUS.nao_conectado]: "bg-rose-50 text-rose-700 border-rose-200",
  [INTEGRACAO_STATUS.em_desenvolvimento]: "bg-sky-50 text-sky-700 border-sky-200",
};

export const IntegracaoStatusBadge = ({ status }) => (
  <Badge variant="outline" className={`font-medium ${INT_STYLE[status] || ""}`}>
    {INTEGRACAO_STATUS_LABEL[status] || status}
  </Badge>
);
