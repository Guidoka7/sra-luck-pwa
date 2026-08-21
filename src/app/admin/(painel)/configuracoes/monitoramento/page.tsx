"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Globe2, Smartphone, Monitor, RefreshCw, ShieldCheck, X, CheckCircle2, Ban, Users, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/ExecutiveUI";

interface Item {
  cliente_id: string;
  device_key: string | null;
  device_type: string | null;
  display_mode: string | null;
  is_pwa_installed: boolean;
  notification_permission: string;
  push_active: boolean;
  first_access_at: string | null;
  last_access_at: string | null;
  pwa_installed_at?: string | null;
  notifications_activated_at?: string | null;
  cliente: { id: string; nome_completo: string; cpf: string; ativo: boolean };
}

type Filtro = "clientesMonitoradas" | "pwaInstalado" | "pwaNaoInstalado" | "notificacoesAtivas" | "notificacoesNaoAtivadas" | "notificacoesBloqueadas" | "acessoWeb";

const card = "rounded-2xl border border-burgundy/10 bg-white/75 p-4 shadow-[0_14px_45px_-32px_rgba(88,25,38,.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]";

function dataHora(value: string | null) {
  if (!value) return "Ainda não registrado";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function IconDevice({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function corresponde(item: Item, filtro: Filtro) {
  if (filtro === "clientesMonitoradas") return true;
  if (filtro === "pwaInstalado") return item.is_pwa_installed;
  if (filtro === "pwaNaoInstalado") return !item.is_pwa_installed;
  if (filtro === "notificacoesAtivas") return item.notification_permission === "granted" && item.push_active;
  if (filtro === "notificacoesBloqueadas") return item.notification_permission === "denied";
  if (filtro === "notificacoesNaoAtivadas") return !(item.notification_permission === "granted" && item.push_active);
  if (filtro === "acessoWeb") return item.display_mode === "browser";
  return true;
}

const nomesFiltro: Record<Filtro, string> = {
  clientesMonitoradas: "Todas as clientes monitoradas",
  pwaInstalado: "Clientes que instalaram o PWA",
  pwaNaoInstalado: "Clientes que ainda não instalaram o PWA",
  notificacoesAtivas: "Clientes com notificações ativas",
  notificacoesNaoAtivadas: "Clientes sem notificações ativas",
  notificacoesBloqueadas: "Clientes que bloquearam notificações",
  acessoWeb: "Clientes acessando pelo navegador",
};

export default function MonitoramentoPage() {
  const [dados, setDados] = useState<{ dispositivos: Item[]; resumo: Item[]; metricas: Record<string, number> } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro | null>(null);

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
  const filtrados = useMemo(() => filtro ? rows.filter((item) => corresponde(item, filtro)) : [], [rows, filtro]);

  const metricas: { key: Filtro; icon: typeof Activity; label: string; value: number; helper: string }[] = [
    { key: "clientesMonitoradas", icon: Users, label: "Clientes monitoradas", value: dados?.metricas.clientesMonitoradas ?? 0, helper: "base ativa" },
    { key: "acessoWeb", icon: Globe2, label: "Acesso Web", value: dados?.metricas.acessoWeb ?? 0, helper: "último acesso no navegador" },
    { key: "pwaInstalado", icon: Smartphone, label: "PWA instalado", value: dados?.metricas.pwaInstalado ?? 0, helper: "instalaram o aplicativo" },
    { key: "pwaNaoInstalado", icon: Smartphone, label: "PWA não instalado", value: dados?.metricas.pwaNaoInstalado ?? 0, helper: "ainda não instalaram" },
    { key: "notificacoesAtivas", icon: Bell, label: "Notificações ativas", value: dados?.metricas.notificacoesAtivas ?? 0, helper: "podem receber avisos" },
    { key: "notificacoesNaoAtivadas", icon: Bell, label: "Notificações não ativas", value: dados?.metricas.notificacoesNaoAtivadas ?? 0, helper: "ainda não estão ativas" },
    { key: "notificacoesBloqueadas", icon: ShieldCheck, label: "Notificações bloqueadas", value: dados?.metricas.notificacoesBloqueadas ?? 0, helper: "permissão negada" },
  ];

  return (
    <div className="space-y-4 pb-8">
      <PageHeader eyebrow="Configurações · Aplicativo" title="Monitoramento de acesso" description="Acompanhe como cada cliente está acessando o sistema, a instalação do PWA e as notificações." actions={<button onClick={carregar} className="inline-flex items-center gap-2 rounded-xl border border-burgundy/10 bg-white/70 px-3 py-2 text-xs font-semibold text-burgundy transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-[.98] dark:border-white/10 dark:bg-white/[0.04] dark:text-pearl"><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</button>} />

      {carregando && !dados ? <div className="text-sm text-clay/50">Carregando monitoramento...</div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricas.map(({ key, icon: Icon, label, value, helper }) => (
            <button key={key} type="button" onClick={() => setFiltro(key)} className={`${card} group text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-burgundy/20 hover:shadow-[0_18px_50px_-34px_rgba(88,25,38,.65)] active:scale-[.99]`}>
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy dark:bg-white/[0.07] dark:text-rose"><Icon className="h-4 w-4" /></span><div><p className="text-[10px] uppercase tracking-[.16em] text-clay/40 dark:text-pearl/30">{label}</p><p className="mt-0.5 text-xl font-semibold text-burgundy dark:text-pearl">{value}</p></div></div><ChevronRight className="h-4 w-4 text-clay/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-burgundy/50" /></div>
              <p className="mt-3 pl-12 text-[10px] text-clay/40 dark:text-pearl/30">{helper} · tocar para ver</p>
            </button>
          ))}
        </div>

        <section className={card}>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-burgundy dark:text-pearl">Clientes e dispositivos</h2><p className="text-xs text-clay/45 dark:text-pearl/35">Agora a lista considera também clientes que ainda não possuem nenhum acesso registrado.</p></div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b border-burgundy/8 text-[10px] uppercase tracking-wider text-clay/40 dark:border-white/8 dark:text-pearl/30"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Acesso</th><th className="px-3 py-2">PWA</th><th className="px-3 py-2">Notificações</th><th className="px-3 py-2">Primeiro acesso</th><th className="px-3 py-2">Último acesso</th></tr></thead><tbody>{rows.map((item) => <tr key={item.cliente_id} className="border-b border-burgundy/5 dark:border-white/5"><td className="px-3 py-3"><p className="font-semibold text-burgundy dark:text-pearl">{item.cliente?.nome_completo ?? "Cliente"}</p><p className="text-[10px] text-clay/40">{item.cliente?.cpf ?? ""}</p></td><td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-blush/70 px-2 py-1 text-[10px] font-semibold text-burgundy dark:bg-white/8 dark:text-pearl"><IconDevice type={item.device_type} /> {item.display_mode === "standalone" ? "PWA" : item.display_mode === "browser" ? "Web" : "Sem acesso"}</span></td><td className="px-3 py-3">{item.is_pwa_installed ? <span className="inline-flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Instalado</span> : <span className="text-clay/45">Não instalado</span>}</td><td className="px-3 py-3">{item.push_active && item.notification_permission === "granted" ? <span className="font-semibold text-success">Ativas</span> : item.notification_permission === "denied" ? <span className="inline-flex items-center gap-1 font-semibold text-alert"><Ban className="h-3.5 w-3.5" /> Bloqueadas</span> : <span className="text-clay/45">Não ativadas</span>}</td><td className="px-3 py-3 text-clay/55 dark:text-pearl/45">{dataHora(item.first_access_at)}</td><td className="px-3 py-3 font-medium text-burgundy/75 dark:text-pearl/65">{dataHora(item.last_access_at)}</td></tr>)}</tbody></table>
          </div>
          {!rows.length && <p className="py-8 text-center text-sm text-clay/45">Nenhuma cliente ativa encontrada.</p>}
        </section>
      </>}

      {filtro && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-burgundy/20 p-3 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setFiltro(null); }}>
          <div className="flex max-h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-cream/95 shadow-[0_30px_100px_-40px_rgba(55,15,25,.6)] animate-fadeUp dark:border-white/10 dark:bg-[#21171a]/95">
            <div className="flex items-start justify-between gap-4 border-b border-burgundy/8 px-5 py-4 dark:border-white/8"><div><p className="text-[10px] uppercase tracking-[.18em] text-rose">Monitoramento detalhado</p><h2 className="mt-1 font-heading text-xl text-burgundy dark:text-pearl">{nomesFiltro[filtro]}</h2><p className="mt-1 text-xs text-clay/45 dark:text-pearl/35">Total: <strong className="text-burgundy dark:text-pearl">{filtrados.length}</strong></p></div><button type="button" aria-label="Fechar" onClick={() => setFiltro(null)} className="rounded-full p-2 text-clay/50 transition hover:bg-burgundy/6 hover:text-burgundy"><X className="h-5 w-5" /></button></div>
            <div className="overflow-y-auto p-3 sm:p-4">
              {filtrados.length ? <div className="space-y-2">{filtrados.map((item) => <div key={item.cliente_id} className="flex items-center justify-between gap-3 rounded-2xl border border-burgundy/8 bg-white/60 px-4 py-3 dark:border-white/8 dark:bg-white/[0.04]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-burgundy dark:text-pearl">{item.cliente.nome_completo}</p><p className="mt-0.5 text-[10px] text-clay/40">{item.cliente.cpf} · {item.display_mode === "standalone" ? "PWA" : item.display_mode === "browser" ? "Web" : "Sem acesso registrado"}</p></div><div className="shrink-0 text-right text-[10px]">{item.is_pwa_installed && <p className="font-semibold text-success">PWA instalado</p>}{item.notification_permission === "granted" && item.push_active ? <p className="font-semibold text-success">Notificações ativas</p> : item.notification_permission === "denied" ? <p className="font-semibold text-alert">Notificações bloqueadas</p> : <p className="text-clay/40">Notificações não ativas</p>}</div></div>)}</div> : <div className="rounded-2xl border border-dashed border-burgundy/10 px-5 py-10 text-center text-sm text-clay/45">Nenhuma cliente encontrada neste grupo.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
