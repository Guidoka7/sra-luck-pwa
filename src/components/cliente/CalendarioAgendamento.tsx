"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface DataDisponivel {
  id: string;
  data: string; // YYYY-MM-DD
  vagasRestantes: number;
}

interface CalendarioAgendamentoProps {
  datas: DataDisponivel[];
  onConfirmar: (dataId: string) => void;
  confirmando: boolean;
  bloqueado?: boolean;
}

// Horários de conversa oferecidos em cada dia liberado pela equipe.
// A disponibilidade é por dia (ver `datas`); os horários abaixo dão à
// cliente a sensação de escolher um encontro exato dentro do dia escolhido.
const HORARIOS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

function parseDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

type EstadoDia = "disponivel" | "lotado" | "passado";

export function CalendarioAgendamento({
  datas,
  onConfirmar,
  confirmando,
  bloqueado = false,
}: CalendarioAgendamentoProps) {
  const hoje = startOfDay(new Date());

  // Abre o calendário direto no mês da primeira data disponível (em vez do
  // mês corrente), para a cliente não precisar navegar até achar uma vaga.
  // Calculado apenas uma vez, na montagem — a navegação por setas continua
  // livre para frente e para trás a partir daí.
  const [mesAtual, setMesAtual] = useState(() => {
    const hojeStr = format(hoje, "yyyy-MM-dd");
    const futuras = datas.map((d) => d.data).filter((data) => data >= hojeStr).sort();
    return futuras[0] ? startOfMonth(parseDataLocal(futuras[0])) : startOfMonth(hoje);
  });
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);

  const porData = useMemo(() => {
    const mapa = new Map<string, DataDisponivel>();
    for (const d of datas) mapa.set(d.data, d);
    return mapa;
  }, [datas]);

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesAtual]);

  function estadoDoDia(dia: Date): EstadoDia {
    if (isBefore(dia, hoje)) return "passado";
    const chave = format(dia, "yyyy-MM-dd");
    const entrada = porData.get(chave);
    // Qualquer data sem vaga aberta aparece como lotada — não há distinção
    // entre "indisponível" e "lotada" para a cliente.
    if (!entrada) return "lotado";
    return entrada.vagasRestantes > 0 ? "disponivel" : "lotado";
  }

  function mudarMes(delta: 1 | -1) {
    setDirecao(delta);
    setMesAtual((atual) => (delta === 1 ? addMonths(atual, 1) : subMonths(atual, 1)));
  }

  function selecionarDia(dia: Date, estado: EstadoDia) {
    if (estado !== "disponivel") return;
    const chave = format(dia, "yyyy-MM-dd");
    setDiaSelecionado(chave === diaSelecionado ? null : chave);
    setHorarioSelecionado(null);
  }

  const entradaSelecionada = diaSelecionado ? porData.get(diaSelecionado) : null;

  return (
    <div className="relative">
      <div className={bloqueado ? "pointer-events-none select-none blur-[2px]" : ""}>
      {/* Cabeçalho de navegação do mês */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy/70 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          <motion.h3
            key={format(mesAtual, "yyyy-MM")}
            initial={{ opacity: 0, y: direcao === 1 ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direcao === 1 ? -8 : 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-sm font-semibold capitalize text-burgundy"
          >
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </motion.h3>
        </AnimatePresence>

        <button
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
          className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy/70 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <span key={d} className="text-[0.58rem] font-semibold uppercase tracking-label text-rose/80">
            {d}
          </span>
        ))}
      </div>

      {/* Grade do mês */}
      <AnimatePresence mode="wait">
        <motion.div
          key={format(mesAtual, "yyyy-MM")}
          initial={{ opacity: 0, x: direcao === 1 ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direcao === 1 ? -16 : 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto grid max-w-[22rem] grid-cols-7 gap-1 sm:max-w-[24rem] sm:gap-1.5"
        >
          {dias.map((dia, i) => {
            const noMes = isSameMonth(dia, mesAtual);
            const estado = estadoDoDia(dia);
            const chave = format(dia, "yyyy-MM-dd");
            const selecionado = chave === diaSelecionado;
            const ehHoje = isToday(dia);

            return (
              <button
                key={dia.toISOString()}
                onClick={() => selecionarDia(dia, estado)}
                disabled={estado !== "disponivel"}
                title={estado === "lotado" ? "Agenda lotada" : undefined}
                style={{ animationDelay: `${i * 8}ms` }}
                className={cn(
                  "group relative aspect-square animate-fadeIn rounded-xl border text-[0.78rem] transition-all duration-200",
                  !noMes && "opacity-0 pointer-events-none",
                  estado === "passado" && "border-transparent text-clay/20",
                  estado === "lotado" &&
                    "cursor-not-allowed border-transparent bg-alert/[0.06] text-alert/45 line-through decoration-alert/30",
                  estado === "disponivel" &&
                    !selecionado &&
                    "border-success/35 bg-success/10 font-medium text-success shadow-sm hover:-translate-y-0.5 hover:border-success/55 hover:bg-success/20 hover:shadow-card cursor-pointer",
                  selecionado &&
                    "animate-popIn border-2 border-gold bg-burgundy font-semibold text-cream shadow-soft cursor-pointer"
                )}
              >
                <span
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-0.5",
                    ehHoje && !selecionado && "ring-2 ring-rose/60 ring-inset rounded-xl"
                  )}
                >
                  <span className={cn(ehHoje && !selecionado && "text-rose font-bold")}>
                    {format(dia, "d")}
                  </span>
                </span>

                {estado === "lotado" && (
                  <span className="pointer-events-none absolute -top-1.5 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-burgundy-dark px-2 py-1 text-[0.6rem] font-medium normal-case text-cream shadow-soft group-hover:block">
                    Agenda lotada
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-rose/10 pt-4 text-[0.65rem] text-clay/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-success/40 bg-success/15" /> Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-alert/40" /> Agenda lotada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full ring-2 ring-rose/60" /> Hoje
        </span>
      </div>

      {/* Horários do dia selecionado */}
      <AnimatePresence>
        {diaSelecionado && entradaSelecionada && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 border-t border-rose/10 pt-4">
              <p className="mb-3 flex items-center justify-center gap-2 text-center text-xs text-clay/60">
                <Clock3 className="h-3.5 w-3.5 text-rose" />
                Horários disponíveis para assinatura dos termos em{" "}
                <span className="font-heading font-semibold text-burgundy">
                  {format(parseDataLocal(diaSelecionado), "d 'de' MMMM", { locale: ptBR })}
                </span>
              </p>

              <div className="mx-auto grid max-w-sm grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
                {HORARIOS.map((h, i) => {
                  const selecionado = h === horarioSelecionado;
                  return (
                    <button
                      key={h}
                      onClick={() => setHorarioSelecionado(h)}
                      style={{ animationDelay: `${i * 25}ms` }}
                      className={cn(
                        "animate-fadeUp rounded-lg border px-2.5 py-2 text-xs font-medium transition-all duration-200",
                        selecionado
                          ? "border-burgundy bg-burgundy text-cream shadow-card"
                          : "border-rose/20 bg-white text-clay/70 hover:-translate-y-0.5 hover:border-rose hover:text-burgundy hover:shadow-sm"
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {horarioSelecionado && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 flex flex-col items-center gap-2.5 rounded-xl bg-blush/50 p-4 text-center"
                  >
                    <p className="text-xs text-clay/70">
                      Você selecionou{" "}
                      <span className="font-heading font-semibold text-burgundy">
                        {format(parseDataLocal(diaSelecionado), "d 'de' MMMM", { locale: ptBR })}
                      </span>{" "}
                      às{" "}
                      <span className="font-heading font-semibold text-burgundy">
                        {horarioSelecionado}
                      </span>
                    </p>
                    <Button
                      onClick={() => onConfirmar(entradaSelecionada.id)}
                      loading={confirmando}
                      className="w-full sm:w-auto"
                    >
                      <Sparkles className="h-4 w-4" />
                      Confirmar data da assinatura
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {datas.every((d) => d.vagasRestantes <= 0) && datas.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-clay/45">
          <Lock className="h-3.5 w-3.5" /> Todas as datas deste período estão com agenda lotada.
        </p>
      )}
      </div>

      {bloqueado && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/35 px-5 text-center backdrop-blur-[1px]">
          <div className="max-w-xs rounded-2xl border border-gold/30 bg-white/95 p-5 shadow-card">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
              <Lock className="h-5 w-5 text-gold" />
            </span>
            <p className="font-heading font-semibold text-burgundy">Agenda indisponível por enquanto</p>
            <p className="mt-2 text-sm leading-relaxed text-clay/65">
              Quando seus pagamentos atingirem a porcentagem necessária, você poderá escolher sua data para a assinatura dos termos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
