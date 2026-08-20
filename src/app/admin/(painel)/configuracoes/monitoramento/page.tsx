"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Globe2, Smartphone, Tablet, Monitor, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/ExecutiveUI";

interface Item {
  cliente_id: string;
  device_key: string;
  device_type: string;
  display_mode: string;
  is_pwa_installed: boolean;
  notification_permission: string;
  push_active: boolean;
  first_access_at: string;
  last_access_at: string;
  pwa_installed_at?: string | null;
  notifications_activated_at?: string | null;
  cliente?: { id: string; nome_completo: string; cpf: string; ativo: boolean } | null;
}

const card = "rounded-2xl border border-burgundy/10 bg-white/75 p-4 shadow-[0_14px_45px_-32px_rgba(88,25,38,.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]";

function dataHora(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function IconDevice({ type }: { type: string }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function MonitoramentoPage() {
  const [dados, setDados] = useState<{ dispositivos: Item[]; resumo: Item[]; metricas: Record<string, number> } | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/admin/monitoramento-app", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setDados(await res.json());
    } finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  const rows = useMemo(() => dados?.resumo ?? [], [dados]);

  return (
    <div className="space-y-4 pb-8">
      <PageHeader eyebrow="Configurações · Aplicativo" title="Monitoramento de acesso" description="Acompanhe como cada cliente está acessando o sistema, a instalação do PWA e as notificações." actions={<button onClick={carregar} className="inline-flex items-center gap-2 rounded-xl border border-burgundy/10 bg-white/70 px-3 py-2 text-xs font-semibold text-burgundy dark:border-white/10 dark:bg-white/[0.04] dark:text-pearl"><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</button>} />

      {carregando && !dados ? <div className="text-sm text-clay/50">Carregando monitoramento...</div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [Activity, "Clientes monitoradas", dados?.metricas.clientesMonitoradas ?? 0],
            [Globe2, "Acesso Web", dados?.metricas.acessoWeb ?? 0],
            [Smartphone, "PWA instalado", dados?.metricas.pwaInstalado ?? 0],
            [Bell, "Notificações ativas", dados?.metricas.notificacoesAtivas ?? 0],
            [ShieldCheck, "Notificações bloqueadas", dados?.metricas.notificacoesBloqueadas ?? 0],
          ].map(([Icon, label, value]) => <div key={String(label)} className={card}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy dark:bg-white/[0.07] dark:text-rose"><Icon className="h-4 w-4" /></span><div><p className="text-[10px] uppercase tracking-[.16em] text-clay/40 dark:text-pearl/30">{label}</p><p className="mt-0.5 text-xl font-semibold text-burgundy dark:text-pearl">{value as number}</p></div></div></div>)}
        </div>

        <section className={card}>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-burgundy dark:text-pearl">Clientes e dispositivos</h2><p className="text-xs text-clay/45 dark:text-pearl/35">O último acesso de cada cliente é usado no resumo.</p></div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b border-burgundy/8 text-[10px] uppercase tracking-wider text-clay/40 dark:border-white/8 dark:text-pearl/30"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Acesso</th><th className="px-3 py-2">PWA</th><th className="px-3 py-2">Notificações</th><th className="px-3 py-2">Primeiro acesso</th><th className="px-3 py-2">Último acesso</th></tr></thead><tbody>{rows.map((item) => <tr key={`${item.cliente_id}-${item.device_key}`} className="border-b border-burgundy/5 dark:border-white/5"><td className="px-3 py-3"><p className="font-semibold text-burgundy dark:text-pearl">{item.cliente?.nome_completo ?? "Cliente"}</p><p className="text-[10px] text-clay/40">{item.cliente?.cpf ?? ""}</p></td><td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-blush/70 px-2 py-1 text-[10px] font-semibold text-burgundy dark:bg-white/8 dark:text-pearl"><IconDevice type={item.device_type} /> {item.display_mode === "standalone" ? "PWA" : "Web"}</span></td><td className="px-3 py-3">{item.is_pwa_installed ? <span className="font-semibold text-success">Instalado</span> : <span className="text-clay/45">Não instalado</span>}</td><td className="px-3 py-3">{item.push_active && item.notification_permission === "granted" ? <span className="font-semibold text-success">Ativas</span> : item.notification_permission === "denied" ? <span className="font-semibold text-alert">Bloqueadas</span> : <span className="text-clay/45">Não ativadas</span>}</td><td className="px-3 py-3 text-clay/55 dark:text-pearl/45">{dataHora(item.first_access_at)}</td><td className="px-3 py-3 font-medium text-burgundy/75 dark:text-pearl/65">{dataHora(item.last_access_at)}</td></tr>)}</tbody></table>
          </div>
          {!rows.length && <p className="py-8 text-center text-sm text-clay/45">Nenhum acesso foi registrado ainda. A cliente precisa entrar na área /agenda após a atualização.</p>}
        </section>
      </>}
    </div>
  );
}
