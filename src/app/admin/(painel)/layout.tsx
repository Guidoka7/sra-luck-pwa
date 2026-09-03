"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarRange, ChevronRight, CircleUserRound, Cog, LayoutDashboard, Landmark, LineChart, LogOut, Menu, Receipt, Search, ShoppingBag, Users, WalletCards, X } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { fetchInstant } from "@/lib/instantCache";
import { AdminCompactStyles } from "@/components/ui/Card";
import { AdminCompactLists } from "@/components/admin/AdminCompactLists";
import { CalendarioTesteTempo } from "@/components/admin/CalendarioTesteTempo";

const NAV = [
  { href: "/admin/visao-geral", label: "Visão Geral", icon: LayoutDashboard, group: "Operação" },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarRange, group: "Operação" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, group: "Operação" },
  { href: "/admin/novas-vendas", label: "Novas Vendas", icon: ShoppingBag, group: "Operação" },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: Receipt, group: "Financeiro" },
  { href: "/admin/parcelas", label: "Parcelas", icon: WalletCards, group: "Financeiro" },
  { href: "/admin/conciliacao-bancaria", label: "Conciliação Bancária", icon: Landmark, group: "Financeiro" },
  { href: "/admin/relatorios", label: "Relatórios", icon: LineChart, group: "Gestão" },
  { href: "/admin/configuracoes", label: "Configurações", icon: Cog, group: "Gestão" },
];

const API_PREFETCH: Record<string, string> = {
  "/admin/visao-geral": "/api/admin/visao-geral",
  "/admin/clientes": "/api/admin/clientes",
  "/admin/novas-vendas": "/api/admin/novas-vendas",
  "/admin/pagamentos": "/api/admin/boletos?",
  "/admin/configuracoes": "/api/admin/configuracoes",
  "/admin/conciliacao-bancaria": `/api/admin/conciliacao-bancaria?data=${new Date().toISOString().slice(0, 10)}`,
};

const TITLES: Record<string, string> = {
  "/admin/visao-geral": "Visão Geral",
  "/admin/agenda": "Agenda",
  "/admin/clientes": "Clientes",
  "/admin/novas-vendas": "Novas Vendas",
  "/admin/pagamentos": "Pagamentos",
  "/admin/parcelas": "Parcelas",
  "/admin/conciliacao-bancaria": "Conciliação Bancária",
  "/admin/relatorios": "Relatórios",
  "/admin/configuracoes": "Configurações",
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

function pageTitle(pathname: string) {
  const exact = TITLES[pathname];
  if (exact) return exact;
  const item = NAV.find((entry) => pathname.startsWith(entry.href));
  return item?.label ?? "Painel Administrativo";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const titulo = useMemo(() => pageTitle(pathname), [pathname]);

  useEffect(() => setMenuAberto(false), [pathname]);
  useEffect(() => {
    let cancelado = false;
    const iniciar = () => {
      if (cancelado) return;
      NAV.forEach((item, index) => window.setTimeout(() => {
        if (!cancelado) prefetchAdminTab(router, item.href);
      }, index * 180));
    };
    const usaIdleCallback = typeof window.requestIdleCallback === "function";
    const idle = usaIdleCallback ? window.requestIdleCallback(iniciar, { timeout: 1800 }) : window.setTimeout(iniciar, 900);
    return () => {
      cancelado = true;
      if (usaIdleCallback) window.cancelIdleCallback?.(idle as number);
      else window.clearTimeout(idle);
    };
  }, [router]);

  async function sair() {
    const supabase = createClientSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const grupos = Array.from(new Set(NAV.map((item) => item.group)));

  return (
    <div className="admin-shell admin-compact min-h-screen bg-bloom dark:bg-[#0b0a0c]">
      <AdminCompactStyles />
      <AdminCompactLists />
      <CalendarioTesteTempo />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(173,104,107,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(122,38,50,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.92))] dark:bg-[radial-gradient(circle_at_top_left,rgba(157,67,84,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(117,72,45,0.06),transparent_24%)] dark:opacity-100" />
      <div className="relative flex min-h-screen w-full">
        {menuAberto && <button aria-label="Fechar menu" onClick={() => setMenuAberto(false)} className="fixed inset-0 z-40 cursor-default bg-burgundy-dark/24 backdrop-blur-sm animate-fadeIn lg:hidden dark:bg-black/55" />}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-rose/10 bg-white/92 px-4 py-4 text-clay shadow-[0_30px_100px_-40px_rgba(122,38,50,0.28)] backdrop-blur-2xl transition-transform duration-300 ease-out dark:border-white/8 dark:bg-[#151317]/96 dark:text-[#e8dcda] dark:shadow-[0_30px_90px_-28px_rgba(0,0,0,0.72)]",
          "lg:translate-x-0",
          menuAberto ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-rose/10 pb-4 dark:border-white/8">
              <div className="min-w-0 flex-1">
                <Wordmark maxWidth={164} />
                <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.28em] text-burgundy/45 dark:text-[#cda5a2]/58">Sistema empresarial</p>
              </div>
              <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 text-clay/45 hover:bg-blush/70 hover:text-burgundy dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white lg:hidden"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 rounded-xl border border-rose/10 bg-blush/30 px-3 py-2.5 dark:border-white/8 dark:bg-white/5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-burgundy/45 dark:text-white/35">Ambiente</p>
              <div className="mt-1 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(59,122,78,0.10)]" /><span className="text-xs font-medium text-clay/75 dark:text-white/65">Operação administrativa</span></div>
            </div>
            <nav className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {grupos.map((group) => (
                <div key={group}>
                  <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.24em] text-burgundy/38 dark:text-white/35">{group}</p>
                  <div className="space-y-1">
                    {NAV.filter((item) => item.group === group).map((item) => {
                      const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return <Link key={item.href} href={item.href} prefetch onMouseEnter={() => prefetchAdminTab(router, item.href)} onFocus={() => prefetchAdminTab(router, item.href)} className={cn(
                        "group flex items-center gap-3 rounded-xl border px-2.5 py-2.5 transition-all duration-200",
                        ativo ? "border-burgundy/10 bg-burgundy text-pearl shadow-[0_10px_24px_-12px_rgba(122,38,50,0.72)] dark:border-white/10 dark:bg-[#7f3546] dark:text-[#fff7f4]" : "border-transparent text-clay/72 hover:border-rose/8 hover:bg-blush/55 hover:text-burgundy dark:text-[#d5c8c6]/72 dark:hover:border-white/8 dark:hover:bg-white/6 dark:hover:text-[#f3e3df]"
                      )}>
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all", ativo ? "bg-white/15 text-pearl ring-1 ring-white/10" : "bg-blush/65 text-burgundy group-hover:bg-blush dark:bg-white/6 dark:text-[#d9a5a3] dark:group-hover:bg-white/10")}><item.icon className="h-[16px] w-[16px]" strokeWidth={1.8} /></span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em]">{item.label}</span>
                        {ativo && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                      </Link>;
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-4 border-t border-rose/10 pt-3 dark:border-white/8">
              <ThemeToggle />
              <button onClick={sair} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose/12 bg-white/72 px-2.5 py-2.5 text-[13px] font-medium text-burgundy/78 transition-colors hover:bg-blush/70 hover:text-burgundy dark:border-white/8 dark:bg-white/5 dark:text-[#ddcfcc]/76 dark:hover:bg-white/9 dark:hover:text-[#fff5f1]"><LogOut className="h-[16px] w-[16px]" strokeWidth={1.8} /> Sair</button>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1 lg:pl-[272px]">
          <header className="sticky top-0 z-30 border-b border-rose/10 bg-white/82 backdrop-blur-xl dark:border-white/8 dark:bg-[#111013]/90">
            <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 xl:px-8">
              <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu" className="rounded-xl border border-rose/12 bg-white/70 p-2 text-burgundy hover:bg-blush dark:border-white/8 dark:bg-white/5 dark:text-[#f0d9d4] lg:hidden"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="hidden items-center gap-1.5 text-[10px] font-medium text-clay/45 sm:flex"><span>Administração</span><ChevronRight className="h-3 w-3" /><span className="text-burgundy/65">{titulo}</span></div>
                <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-burgundy sm:mt-0.5 sm:text-xl">{titulo}</h1>
              </div>
              <div className={cn("hidden items-center rounded-xl border border-rose/10 bg-white/65 transition-all dark:border-white/8 dark:bg-white/5 md:flex", buscaAberta ? "w-[280px] px-3" : "w-10 px-0")}>
                <button aria-label="Busca global" onClick={() => setBuscaAberta((v) => !v)} className="flex h-9 w-10 shrink-0 items-center justify-center text-clay/50 hover:text-burgundy"><Search className="h-4 w-4" /></button>
                {buscaAberta && <input autoFocus placeholder="Buscar no administrativo..." className="w-full bg-transparent pr-2 text-xs text-clay outline-none placeholder:text-clay/35 dark:text-white/75" />}
              </div>
              <button aria-label="Notificações" className="relative rounded-xl border border-rose/10 bg-white/65 p-2.5 text-clay/55 hover:bg-blush hover:text-burgundy dark:border-white/8 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/8"><Bell className="h-[17px] w-[17px]" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose" /></button>
              <div className="hidden h-8 w-px bg-rose/10 sm:block dark:bg-white/8" />
              <div className="hidden items-center gap-2.5 sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy/8 text-burgundy dark:bg-white/8 dark:text-[#e7c8c4]"><CircleUserRound className="h-[18px] w-[18px]" /></span><div className="hidden xl:block"><p className="text-xs font-semibold text-burgundy">Administrador</p><p className="text-[9px] text-clay/45">Acesso administrativo</p></div></div>
              <div className="sm:hidden"><ThemeToggle compact /></div>
            </div>
            <div className="border-t border-rose/8 bg-burgundy/[0.025] px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-burgundy/45 dark:border-white/5 dark:bg-white/[0.02] dark:text-white/35">🧪 Ambiente de testes · DEVELOP</div>
          </header>
          <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7 2xl:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
