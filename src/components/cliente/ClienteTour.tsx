"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CalendarDays, Check, CreditCard, Heart, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sra-luck-cliente-tour-v2";

type Step = { id: string; title: string; text: string; icon: React.ElementType; target?: () => HTMLElement | null };

function porDataTour(valor: string) {
  return document.querySelector<HTMLElement>(`[data-tour="${valor}"]`);
}

export function ClienteTour() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pronto, setPronto] = useState(false);
  const [etapa, setEtapa] = useState<"inicio" | "financeiro" | "agenda" | "cirurgia">("inicio");

  const steps = useMemo<Step[]>(() => {
    const base: Step[] = [
      { id: "boas-vindas", title: "Bem-vinda à sua jornada 💕", text: "Vamos te mostrar, de forma rápida, onde acompanhar cada etapa. Você continuará vendo seu sistema normalmente durante o tour.", icon: Sparkles },
      { id: "jornada", title: "Sua jornada até a cirurgia", text: etapa === "inicio" ? "Aqui você acompanha o andamento do seu contrato e sabe exatamente em qual etapa está." : etapa === "financeiro" ? "Aqui você acompanha a evolução dos pagamentos e quando sua agenda poderá ser liberada." : etapa === "agenda" ? "Sua agenda já está liberada. Aqui você acompanha a etapa de agendamento e a assinatura dos termos." : "Aqui você acompanha as etapas já concluídas e a previsão relacionada à sua cirurgia.", icon: Heart, target: () => porDataTour("jornada") },
    ];

    if (etapa === "inicio" || etapa === "financeiro") {
      base.push({ id: "boletos", title: "Meus Boletos", text: "Nesta aba você acompanha suas parcelas, pagamentos e comprovantes. É por aqui que você envia os comprovantes quando necessário.", icon: CreditCard, target: () => porDataTour("boletos") });
    }
    if (etapa === "agenda") {
      base.push({ id: "agenda", title: "Sua agenda", text: "Quando houver uma data disponível, você pode escolher aqui o dia para comparecer e assinar seus termos.", icon: CalendarDays, target: () => porDataTour("agenda") });
    }
    if (etapa === "cirurgia") {
      base.push({ id: "previsao", title: "Sua previsão financeira", text: "Aqui ficará registrada a previsão de liberação financeira e as informações importantes após a assinatura dos termos.", icon: CalendarDays, target: () => porDataTour("previsao") });
    }
    base.push({ id: "notificacoes", title: "Fique por dentro", text: "Ative as notificações para receber avisos importantes sobre pagamentos, agenda e novas etapas da sua jornada.", icon: Bell, target: () => porDataTour("notificacoes") });
    return base;
  }, [etapa]);

  function encerrar() { try { localStorage.setItem(STORAGE_KEY, "concluido"); } catch (_) {} setAberto(false); }
  function pular() { try { localStorage.setItem(STORAGE_KEY, "pulado"); } catch (_) {} setAberto(false); }

  useEffect(() => {
    if (pathname !== "/agenda") return;
    let timer: number | undefined;
    const iniciar = () => {
      try { if (localStorage.getItem(STORAGE_KEY)) return; } catch (_) {}
      const root = document.querySelector<HTMLElement>("[data-tour-root]");
      setEtapa((root?.dataset.tourStage as typeof etapa | undefined) ?? "inicio");
      setPronto(true);
      timer = window.setTimeout(() => setAberto(true), 700);
    };
    timer = window.setTimeout(iniciar, 250);
    return () => { if (timer) window.clearTimeout(timer); };
  }, [pathname]);

  useEffect(() => {
    if (!aberto || !pronto) return;
    const atualizar = () => {
      const target = steps[indice]?.target?.();
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.setTimeout(() => setRect(target?.getBoundingClientRect() ?? null), 120);
    };
    atualizar();
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    const timer = window.setTimeout(atualizar, 180);
    return () => { clearTimeout(timer); window.removeEventListener("resize", atualizar); window.removeEventListener("scroll", atualizar, true); };
  }, [aberto, indice, pronto, steps]);

  if (pathname !== "/agenda" || !aberto) return null;
  const step = steps[indice]; const Icon = step.icon; const ultimo = indice === steps.length - 1;
  const tooltipStyle = rect ? { left: Math.max(16, Math.min(window.innerWidth - 336, rect.left + rect.width / 2 - 160)), top: Math.min(window.innerHeight - 230, Math.max(16, rect.bottom + 14)) } : { left: 16, right: 16, top: "50%", transform: "translateY(-50%)" };

  return <AnimatePresence>
    <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#241317]/18 backdrop-blur-[1px]" />
      {rect && <motion.div className="pointer-events-none absolute rounded-2xl border-2 border-gold" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .24, ease: [0.22,1,0.36,1] }} style={{ left: rect.left - 7, top: rect.top - 7, width: rect.width + 14, height: rect.height + 14, boxShadow: "0 0 0 9999px rgba(36,19,23,.18), 0 0 0 4px rgba(201,161,90,.10), 0 0 30px rgba(201,161,90,.34)" }} />}
      <motion.section className="absolute w-[min(320px,calc(100vw-32px))] rounded-3xl border border-gold/20 bg-white p-5 shadow-[0_30px_90px_-30px_rgba(42,15,22,.55)] dark:bg-[#202225]" style={tooltipStyle} initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .24, ease: [0.22,1,0.36,1] }}>
        <button type="button" onClick={pular} aria-label="Fechar tour" className="absolute right-3 top-3 rounded-full p-2 text-clay/35 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-95"><X className="h-4 w-4" /></button>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-burgundy"><Icon className="h-5 w-5" /></div>
        <h2 className="pr-5 font-heading text-lg font-semibold text-burgundy dark:text-[#F4D9DC]">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-clay/65 dark:text-[#D8D0D2]/70">{step.text}</p>
        <div className="mt-5 flex items-center justify-between gap-3"><span className="text-[.62rem] font-bold uppercase tracking-[.14em] text-clay/35">{indice + 1} de {steps.length}</span><div className="flex gap-2"><button type="button" onClick={pular} className="rounded-full px-3 py-2 text-xs font-semibold text-clay/45 transition-all duration-200 hover:bg-blush hover:text-burgundy active:scale-95">Agora não</button><button type="button" onClick={() => ultimo ? encerrar() : setIndice((v) => v + 1)} className="inline-flex items-center gap-2 rounded-full bg-burgundy px-4 py-2.5 text-xs font-bold text-cream shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98]">{ultimo ? <><Check className="h-3.5 w-3.5" /> Começar</> : <>Próximo <ArrowRight className="h-3.5 w-3.5" /></>}</button></div></div>
      </motion.section>
    </motion.div>
  </AnimatePresence>;
}
