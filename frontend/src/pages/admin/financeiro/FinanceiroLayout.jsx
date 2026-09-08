// Layout do módulo Financeiro — sub-navegação profissional.
// Rota: /admin/financeiro/*

import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Wallet,
  LayoutGrid,
  Receipt,
  Users,
  ArrowDownToLine,
  Percent,
  Plug,
  History,
} from "lucide-react";

const TABS = [
  { to: "/admin/financeiro", label: "Visão geral", icon: LayoutGrid, end: true },
  { to: "/admin/financeiro/contas-receber", label: "Contas a receber", icon: Receipt },
  { to: "/admin/financeiro/clientes", label: "Clientes", icon: Users },
  { to: "/admin/financeiro/recebimentos", label: "Recebimentos", icon: ArrowDownToLine },
  { to: "/admin/financeiro/comissoes", label: "Comissões", icon: Percent },
  { to: "/admin/financeiro/integracoes", label: "Integrações", icon: Plug },
  { to: "/admin/financeiro/historico", label: "Histórico", icon: History },
];

export default function FinanceiroLayout() {
  const location = useLocation();
  const activeTab = TABS.find((t) => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)));

  return (
    <div className="min-h-full">
      {/* Cabeçalho do módulo */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Wallet className="w-4 h-4" />
                <span>Financeiro</span>
              </div>
              <h1
                className="text-2xl font-semibold text-slate-900 tracking-tight"
                data-testid="financeiro-title"
              >
                Centro Financeiro
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Gestão completa de contas a receber, recebimentos, clientes financeiros, comissões e
                integrações. Preparado para Conta Azul, Mercado Pago e webhooks bancários.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                Dados temporários · aguardando backend
              </span>
            </div>
          </div>

          {/* Sub-nav */}
          <div className="mt-6 -mb-px flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab?.to === t.to;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  data-testid={`fin-tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}
