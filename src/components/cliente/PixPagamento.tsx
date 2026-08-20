"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, QrCode, Check, HeartHandshake, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatarMoeda } from "@/lib/utils";

interface DescontoPix {
  /** Percentual configurado pelo admin (ex.: 10, 15). */
  percentual: number;
  /** Quanto a cliente economiza pagando agora via PIX. */
  economia: number;
  /** Valor final já com o desconto aplicado sobre os encargos. */
  valorComDesconto: number;
}

interface PixPagamentoProps {
  pixChave: string | null;
  pixQrCodeUrl: string | null;
  /** Presente apenas quando há desconto configurado e a parcela está em atraso. */
  desconto?: DescontoPix | null;
}

/** Card com a chave PIX (copiável) e o QR Code cadastrados pelo admin, para a cliente pagar suas parcelas. */
export function PixPagamento({ pixChave, pixQrCodeUrl, desconto }: PixPagamentoProps) {
  const [copiado, setCopiado] = useState(false);

  if (!pixChave && !pixQrCodeUrl) return null;

  async function copiarChave() {
    if (!pixChave) return;
    try {
      await navigator.clipboard.writeText(pixChave);
      setCopiado(true);
      toast.success("Chave PIX copiada! 💛");
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  const temDesconto = !!desconto && desconto.percentual > 0;

  return (
    <Card className="relative overflow-hidden border-gold/25 bg-gradient-to-br from-blush/40 via-white to-cream p-5 shadow-soft sm:p-6">
      {/* glow decorativo */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-rose/10 blur-2xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-gold/10 shadow-sm">
            <HeartHandshake className="h-5 w-5 text-gold" />
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold text-burgundy sm:text-lg">
              Vamos deixar isso em dia juntas 💛
            </h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-clay/65">
              Escaneie o QR Code ou copie a chave abaixo. Assim que pagar, é só anexar o
              comprovante na parcela — nossa equipe confirma em até 24h, sem burocracia.
            </p>
          </div>
        </div>

        {temDesconto && (
          <div className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success/8 px-4 py-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success/15">
              <Sparkles className="h-4 w-4 text-success" />
            </span>
            <div className="text-sm leading-snug">
              <p className="font-semibold text-success">
                {desconto!.percentual}% de desconto nos encargos pagando via PIX hoje
              </p>
              <p className="text-clay/60">
                Você economiza <strong className="text-success">{formatarMoeda(desconto!.economia)}</strong> — total
                atualizado: <strong className="text-burgundy">{formatarMoeda(desconto!.valorComDesconto)}</strong>
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          {pixChave && (
            <button
              onClick={copiarChave}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-rose/20 bg-white/95 px-4 py-3 text-sm font-medium text-burgundy shadow-sm transition hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-card sm:w-auto"
            >
              <span className="max-w-[220px] truncate text-left">{pixChave}</span>
              {copiado ? (
                <Check className="h-4 w-4 flex-none text-success" />
              ) : (
                <Copy className="h-4 w-4 flex-none text-rose" />
              )}
            </button>
          )}

          {pixQrCodeUrl && (
            <div className="flex flex-none justify-center">
              <img
                src={pixQrCodeUrl}
                alt="QR Code para pagamento via PIX"
                className="h-32 w-32 rounded-2xl border border-rose/15 bg-white object-contain p-2 shadow-card sm:h-36 sm:w-36"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-clay/45">
          <QrCode className="h-3.5 w-3.5" />
          Pagamento processado diretamente na sua conta — a Sra. Luck não guarda dados bancários.
        </div>
      </div>
    </Card>
  );
}
