"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, Cog, LayoutDashboard, LineChart, LogOut, Menu, Receipt, Bell, Users, X } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { fetchInstant } from "@/lib/instantCache";
import { AdminCompactStyles } from "@/components/ui/Card";

const NAV = [
  { href: "/admin/visao-geral", label: "Visão Geral", icon: LayoutDashboard, group: "Operação" },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarRange, group: "Operação" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, group: "Operação" },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: Receipt, group: "Gestão" },
  { href: "/admin/relatorios", label: "Relatórios", icon: LineChart, group: "Gestão" },
  { href: "/admin/notificacoes", label: "Notificações", icon: Bell, group: "Gestão" },
  { href: "/admin/configuracoes", label: "Configurações", icon: Cog, group: "Gestão" },
];

const API_PREFETCH: Record<string, string> = {
  "/admin/visao-geral": "/api/admin/visao-geral",
  "/admin/clientes": "/api/admin/clientes",
  "/admin/pagamentos": "/api/admin/boletos?",
  "/admin/notificacoes": "/api/admin/notificacoes/automacao",
  "/admin/configuracoes": "/api/admin/configuracoes",
};

function prefetchAdminTab(router: ReturnType<typeof useRouter>, href: string) {
  router.prefetch(href);
  const api = API_PREFETCH[href];
  if (api) void fetchInstant(api, undefined, 120_000).catch(() => undefined);
  if (href === "/admin/relatorios") void fetchInstant(`/api/admin/agenda-mensal?ano=${new Date().getFullYear()}`, undefined, 120_000).catch(() => undefined);
  if (href === "/admin/agenda") {
    const now = new Date();
    void fetchInstant(`/api/admin/datas?ano=${now.getFullYear()}&mes=${now.getMonth() + 1}`, undefined, 120_000).catch(() => undefined);
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => setMenuAberto(false), [pathname]);

  useEffect(() => {
    let cancelado = false;
    const iniciar = () => {
      if (cancelado) return;
      NAV.forEach((item, index) => window.setTimeout(() => { if (!cancelado) prefetchAdminTab(router, item.href); }, index * 180));
    };
    const usaIdleCallback = typeof window.requestIdleCallback === "function";
    const idle = usaIdleCallback ? window.requestIdleCallback(iniciar, { timeout: 1800 }) : window.setTimeout(iniciar, 900);
    return () => {
      cancelado = true;
      if (usaIdleCallback) window.cancelIdleCallback?.(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, [router]);

  async function sair() {
    const supabase = createClientSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell admin-compact min-h-screen bg-bloom">
      <AdminCompactStyles />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(173,104,107,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(122,38,50,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.92))]" />
      <div className="relative flex items-center justify-between border-b border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white text-burgundy shadow-card"><LogoMark className="h-5 w-5" /></div><div><span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-burgundy/55">Admin</span><span className="block text-base text-burgundy">Painel Executivo</span></div></div>
        <div className="flex items-center gap-1.5"><ThemeToggle compact /><button onClick={() => setMenuAberto(true)} aria-label="Abrir menu" className="rounded-xl border border-rose/15 bg-white/70 p-2 text-burgundy transition-colors hover:bg-blush"><Menu className="h-5 w-5" /></button></div>
      </div>
      {menuAberto && <div onClick={() => setMenuAberto(false)} className="fixed inset-0 z-40 bg-burgundy-dark/24 backdrop-blur-sm animate-fadeIn lg:hidden" />}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1720px] gap-4 px-3 pb-4 lg:px-4 lg:pt-4">
        <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col rounded-r-2xl border-r border-white/60 bg-white/82 px-4 py-4 text-clay shadow-[0_30px_100px_-40px_rgba(122,38,50,0.28)] backdrop-blur-2xl transition-transform duration-300 ease-out", "lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:translate-x-0 lg:rounded-2xl lg:border lg:border-white/70", menuAberto ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <div>
            <div className="mb-5 flex items-center justify-between"><div className="min-w-0 flex-1"><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-rose/15 bg-blush/45"><LogoMark className="h-5 w-5" /></div><Wordmark maxWidth={175} /><p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-burgundy/45">Painel premium</p></div><button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 text-clay/45 hover:bg-blush/70 hover:text-burgundy lg:hidden"><X className="h-4 w-4" /></button></div>
            <nav className="mt-5 space-y-4">{Array.from(new Set(NAV.map((item) => item.group))).map((group) => <div key={group}><p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.22em] text-burgundy/38">{group}</p><div className="space-y-1">{NAV.filter((item) => item.group === group).map((item) => { const ativo = pathname.startsWith(item.href); return <Link key={item.href} href={item.href} prefetch onMouseEnter={() => prefetchAdminTab(router, item.href)} onFocus={() => prefetchAdminTab(router, item.href)} className={cn("group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200", ativo ? "bg-burgundy text-pearl shadow-soft" : "text-clay/78 hover:bg-white/70 hover:text-burgundy")}><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", ativo ? "bg-white/16 text-pearl" : "bg-blush/60 text-burgundy group-hover:bg-blush")}><item.icon className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.label}</p><p className={cn("truncate text-[10px]", ativo ? "text-pearl/72" : "text-burgundy/40")}>{item.group}</p></div></Link>; })}</div></div>)}</nav>
          </div>
          <div className="space-y-2"><ThemeToggle /><button onClick={sair} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose/12 bg-white/72 px-3 py-2.5 text-sm text-burgundy/78 transition-colors duration-200 hover:bg-blush/70 hover:text-burgundy"><LogOut className="h-3.5 w-3.5" /> Sair</button></div>
        </aside>
        <main className="min-w-0 flex-1 px-0 py-4 lg:py-1">{children}</main>
      </div>
    </div>
  );
}
