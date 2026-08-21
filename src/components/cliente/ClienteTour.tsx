"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CalendarDays, Check, CreditCard, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sra-luck-cliente-tour-v1";

type Step = { id: string; title: string; text: string; icon: React.ElementType; target?: () => HTMLElement | null };

function encontrarPorTexto(texto: string, seletor = "button") {
  return Array.from(document.querySelectorAll<HTMLElement>(seletor)).find((el) => (el.textContent || "").trim().toLowerCase().includes(texto.toLowerCase())) ?? null;
}

export function ClienteTour() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pronto, setPronto] = useState(false);

  const steps = useMemo<Step[]>(() => [
    { id: "inicio", title: "Bem-vinda à sua jornada 💕", text: "Vamos te mostrar rapidamente onde encontrar as informações mais importantes. É rápido e você pode sair a qualquer momento.", icon: Sparkles },
    { id: "agenda", title: "Minha Agenda", text: "Aqui você acompanha as etapas da sua jornada e, quando estiver liberada, escolhe a data para assinatura dos termos.", icon: CalendarDays, target: () => encontrarPorTexto("Minha Agenda") },
    { id: "pagamentos", title: "Meus Boletos", text: "Nesta aba você acompanha suas parcelas, pagamentos, comprovantes e as opções disponíveis para cada pagamento.", icon: CreditCard, target: () => encontrarPorTexto("Meus Boletos") },
    { id: "notificacoes", title: "Fique por dentro", text: "Ative as notificações para receber avisos importantes sobre pagamentos, agenda e novas etapas da sua jornada.", icon: Bell, target: () => { const buttons = Array.from(document.querySelectorAll<HTMLElement>("button")); return buttons.find((el) => el.querySelector("svg") && !(el.textContent || "").trim()) ?? null; } },
  ], []);

  function encerrar() { localStorage.setItem(STORAGE_KEY, "concluido"); setAberto(false); }
  function pular() { localStorage.setItem(STORAGE_KEY, "pulado"); setAberto(false); }

  useEffect(() => {
    if (pathname !== "/agenda") return;
    try { if (localStorage.getItem(STORAGE_KEY)) return; } catch (_) {}
    const timer = window.setTimeout(() => { setPronto(true); setAberto(true); }, 900);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!aberto || !pronto) return;
    const atualizar = () => { const target = steps[indice]?.target?.(); setRect(target ? target.getBoundingClientRect() : null); };
    atualizar(); window.addEventListener("resize", atualizar); window.addEventListener("scroll", atualizar, true);
    const timer = window.setTimeout(atualizar, 80);
    return () => { clearTimeout(timer); window.removeEventListener("resize", atualizar); window.removeEventListener("scroll", atualizar, true); };
  }, [aberto, indice, pronto, steps]);

  if (pathname !== "/agenda" || !aberto) return null;
  const step = steps[indice]; const Icon = step.icon; const ultimo = indice === steps.length - 1;
  const tooltipStyle = rect ? { left: Math.max(16, Math.min(window.innerWidth - 336, rect.left + rect.width / 2 - 160)), top: rect.bottom + 14 } : { left: 16, right: 16, top: "50%", transform: "translateY(-50%)" };

  return <AnimatePresence>
    <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#241317]/45 backdrop-blur-[2px]" />
      {rect && <motion.div className="pointer-events-none absolute rounded-2xl border-2 border-gold shadow-[0_0_0_9999px_rgba(36,19,23,0.45),0_0_28px_rgba(201,161,90,0.4)]" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <motion.section className="absolute w-[min(320px,calc(100vw-32px))] rounded-3xl border border-gold/20 bg-white p-5 shadow-[0_30px_90px_-30px_rgba(42,15,22,.55)] dark:bg-[#202225]" style={tooltipStyle} initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .24, ease: [0.22,1,0.36,1] }}>
        <button type="button" onClick={pular} aria-label="Fechar tour" className="absolute right-3 top-3 rounded-full p-2 text-clay/35 transition-colors hover:bg-blush hover:text-burgundy"><X className="h-4 w-4" /></button>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-burgundy"><Icon className="h-5 w-5" /></div>
        <h2 className="pr-5 font-heading text-lg font-semibold text-burgundy dark:text-[#F4D9DC]">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-clay/65 dark:text-[#D8D0D2]/70">{step.text}</p>
        <div className="mt-5 flex items-center justify-between gap-3"><span className="text-[.62rem] font-bold uppercase tracking-[.14em] text-clay/35">{indice + 1} de {steps.length}</span><div className="flex gap-2"><button type="button" onClick={pular} className="rounded-full px-3 py-2 text-xs font-semibold text-clay/45 transition-colors hover:bg-blush hover:text-burgundy">Agora não</button><button type="button" onClick={() => ultimo ? encerrar() : setIndice((v) => v + 1)} className="inline-flex items-center gap-2 rounded-full bg-burgundy px-4 py-2.5 text-xs font-bold text-cream shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98]">{ultimo ? <><Check className="h-3.5 w-3.5" /> Começar</> : <>Próximo <ArrowRight className="h-3.5 w-3.5" /></>}</button></div></div>
      </motion.section>
    </motion.div>
  </AnimatePresence>;
}
