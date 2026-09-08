// Utilitários de formatação para o módulo Financeiro
// Padrão brasileiro: R$ e dd/mm/aaaa

export const formatCurrency = (value) => {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatCurrencyCompact = (value) => {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return formatCurrency(n);
};

export const formatDateBR = (isoOrDate) => {
  if (!isoOrDate) return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

export const formatDateTimeBR = (isoOrDate) => {
  if (!isoOrDate) return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateBR(d)} ${hh}:${mi}`;
};

export const formatCPF = (cpf) => {
  if (!cpf) return "—";
  const digits = String(cpf).replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatPhoneBR = (phone) => {
  if (!phone) return "—";
  const d = String(phone).replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
};

export const daysBetween = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return Math.floor((db - da) / (1000 * 60 * 60 * 24));
};

export const isOverdue = (parcela, referenceDate = new Date()) => {
  if (!parcela) return false;
  if (parcela.status === "recebido" || parcela.status === "cancelado") return false;
  return new Date(parcela.vencimento) < new Date(referenceDate.toDateString());
};
