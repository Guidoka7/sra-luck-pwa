// Shell administrativo do protótipo Sra. Luck.
// O Financeiro é o módulo principal; operações financeiras ficam concentradas em /admin/financeiro.

import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, Wallet, Settings, Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/agenda", label: "Agenda", icon: Calendar, disabled: true },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, highlight: true },
  { to: "/admin/config", label: "Configurações", icon: Settings, disabled: true },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside data-testid="admin-sidebar" className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 group" data-testid="brand-link">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500 grid place-items-center font-semibold">SL</div>
            <div className="text-left"><div className="text-sm font-semibold leading-tight">Sra. Luck</div><div className="text-[11px] text-slate-400">Painel administrativo</div></div>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return <div key={item.to} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 cursor-not-allowed select-none" title="Módulo ainda não integrado ao frontend financeiro">
                <Icon className="w-4 h-4" /><span className="text-sm">{item.label}</span><span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600">em breve</span>
              </div>;
            }
            return <NavLink key={item.to} to={item.to} end={item.end} data-testid={`nav-${item.label.toLowerCase()}`} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}>
              <Icon className="w-4 h-4" /><span>{item.label}</span>{item.highlight && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">central</span>}
            </NavLink>;
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">v0.2 · Central Financeira</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 gap-4">
          <div className="relative flex-1 max-w-xl"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Buscar cliente, contrato, parcela…" className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-900" data-testid="header-search" /></div>
          <Button variant="ghost" size="icon" data-testid="notifications-btn"><Bell className="w-4 h-4" /></Button>
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200"><Avatar className="w-8 h-8"><AvatarFallback className="bg-slate-900 text-white text-xs">AD</AvatarFallback></Avatar><div className="text-sm leading-tight"><div className="font-medium text-slate-900">Admin</div><div className="text-[11px] text-slate-500">Sra. Luck</div></div></div>
        </header>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
