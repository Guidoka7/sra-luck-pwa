"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatarDataLonga } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function CelebracaoData({
  data,
  nome,
  onFechar,
}: {
  data: string;
  nome: string;
  onFechar: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-burgundy-dark/90 px-6 backdrop-blur-sm pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* pétalas flutuantes */}
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-2.5 w-2.5 rounded-full bg-gold/70"
            style={{ left: `${(i * 37) % 100}%`, top: "-5%" }}
            animate={{ y: ["0vh", "110vh"], opacity: [0, 1, 0] }}
            transition={{
              duration: 5 + (i % 4),
              repeat: Infinity,
              delay: i * 0.4,
              ease: "linear",
            }}
          />
        ))}

        <motion.div
          className="relative z-10 flex max-w-lg flex-col items-center rounded-[32px] border border-white/12 bg-white/8 px-8 py-10 text-center backdrop-blur-xl"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-xs tracking-label uppercase text-gold">
            {nome}, sua assinatura tem uma data
          </span>
          <h2 className="mt-4 text-4xl font-semibold leading-tight text-cream sm:text-6xl">
            {formatarDataLonga(data)}
          </h2>
          <p className="mt-6 max-w-md text-balance text-lg leading-8 text-cream/84">
            Nesse encontro você assinará os termos cirúrgicos e sua data de
            cirurgia será definida e informada a você. A partir de hoje, cada
            dia te aproxima da sua melhor versão. Estamos com você até lá.
          </p>
          <Button variant="secondary" className="mt-10" onClick={onFechar}>
            Ver minha agenda
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
