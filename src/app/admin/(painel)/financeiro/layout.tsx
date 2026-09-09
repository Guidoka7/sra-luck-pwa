"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, History, LayoutGrid, Percent, Plug, Receipt, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/financeiro", label: "Visão geral", icon: LayoutGrid, exact: true },
  { href: "/admin/financeiro/contas-receber", label: "Contas a receber", icon: Receipt },
  { href: "/admin/financeiro/clientes", label: "Clientes", icon: Users },
  { href: "/admin/financeiro/recebimentos", label: "Recebimentos", icon: ArrowDownToLine },
  { href: "/admin/financeiro/comissoes", label: "Comissões", icon: Percent },
  { href: "/admin/financeiro/integracoes", label: "Integrações", icon: Plug },
  { href: "/admin/financeiro/historico", label: "Histórico", icon: History },
];

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-full">
      <div className="mb-5 overflow-hidden rounded-2xl border border-rose/10 bg-cream shadow-soft">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy">
              <Wallet className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose">Financeiro</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-burgundy sm:text-2xl">Centro Financeiro</h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-clay/50">Gestão de contas a receber, recebimentos, clientes financeiros, comissões, integrações e histórico em uma única experiência.</p>
            </div>
          </div>
          <nav className="mt-5 -mb-px flex gap-1 overflow-x-auto" aria-label="Navegação financeira">
            {TABS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[11px] font-semibold transition-colors sm:px-4", active ? "border-burgundy text-burgundy" : "border-transparent text-clay/45 hover:border-burgundy/20 hover:text-burgundy")}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
