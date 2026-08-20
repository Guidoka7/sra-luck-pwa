"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, WalletCards } from "lucide-react";
import { cn, formatarMoeda, nomeMes } from "@/lib/utils";

type MesResumo = {
  ano: number;
  mes: number;
  comprometido: number;
  clientes: number;
};

function addMonths(ano: number, mes: number, delta: number) {
  const d = new Date(ano, mes - 1 + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function ResumoOrcamentoMensal({
  ano,
  mes,
  onSelecionarMes,
}: {
  ano: number;
  mes: number;
  onSelecionarMes: (ano: number, mes: number) => void;
}) {
  const [resumos, setResumos] = useState<MesResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      const meses = Array.from({ length: 6 }, (_, i) => addMonths(ano, mes, i));

      const respostas = await Promise.all(
        meses.map(async (m) => {
          try {
            const res = await fetch(
              `/api/admin/liberacao-inteligente?ano=${m.ano}&mes=${m.mes}`
            );
            if (!res.ok) return null;
            const data = await res.json();
            const dias = data.calendario?.dias ?? [];
            const ocupados = dias.filter((d: any) => d.estado === "vermelho" && d.ocupante);

            return {
              ano: m.ano,
              mes: m.mes,
              comprometido: ocupados.reduce(
                (total: number, d: any) => total + Number(d.ocupante?.valor ?? 0),
                0
              ),
              clientes: ocupados.length,
            } satisfies MesResumo;
          } catch {
            return null;
          }
        })
      );

      if (ativo) {
        setResumos(respostas.filter(Boolean) as MesResumo[]);
        setCarregando(false);
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [ano, mes]);

  const totalProximosMeses = useMemo(
    () => resumos.reduce((total, item) => total + item.comprometido, 0),
    [resumos]
  );

  const maiorValor = useMemo(
    () => Math.max(...resumos.map((item) => item.comprometido), 0),
    [resumos]
  );

  return (
    <section className="rounded-2xl border border-rose/10 bg-white/90 p-5 shadow-card dark:bg-white/[0.035] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-label text-rose">
            <WalletCards className="h-3.5 w-3.5 shrink-0" />
            Orçamento das próximas liberações
          </p>
          <p className="mt-1 text-xs leading-relaxed text-clay/50">
            Clique em um mês para abrir a agenda correspondente.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-gold/15 bg-gold/5 px-4 py-3 text-right sm:min-w-[180px]">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-clay/45">Total previsto</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-burgundy">
            {formatarMoeda(totalProximosMeses)}
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[176px] animate-pulse rounded-xl bg-blush/40 dark:bg-white/[0.035]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resumos.map((item) => {
            const selecionado = item.ano === ano && item.mes === mes;
            const percentual = maiorValor > 0 ? Math.min((item.comprometido / maiorValor) * 100, 100) : 0;

            return (
              <button
                type="button"
                key={`${item.ano}-${item.mes}`}
                onClick={() => onSelecionarMes(item.ano, item.mes)}
                className={cn(
                  "group flex min-h-[176px] w-full flex-col rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/30",
                  selecionado
                    ? "border-burgundy/25 bg-blush/55 ring-1 ring-burgundy/10 dark:bg-rose/[0.08]"
                    : "border-rose/10 bg-cream/50 hover:border-rose/20 hover:bg-blush/25 dark:bg-white/[0.018] dark:hover:bg-white/[0.035]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight text-burgundy">{nomeMes(item.mes)}</p>
                    <p className="mt-1.5 text-sm leading-tight text-clay/50">
                      {item.clientes} {item.clientes === 1 ? "liberação" : "liberações"}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-clay/30 transition-transform group-hover:translate-x-0.5 group-hover:text-rose" />
                </div>

                <div className="mt-auto pt-6">
                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold leading-none tracking-tight text-burgundy tabular-nums sm:text-xl">
                        {formatarMoeda(item.comprometido)}
                      </p>
                      <p className="mt-2 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-clay/45">Valor previsto</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-clay/40">
                      {item.comprometido > 0 ? `${Math.round(percentual)}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-clay/10 dark:bg-white/[0.07]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-rose via-rose to-gold transition-[width] duration-500"
                      style={{ width: `${percentual}%`, minWidth: item.comprometido > 0 ? "8px" : "0px" }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
