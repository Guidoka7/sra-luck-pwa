"use client";
import { fetchInstant, refreshInstant, writeInstantCache, getInstantCache } from "@/lib/instantCache";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  X,
  UserRound,
  Search,
  Trash2,
  History,
  Receipt,
  Stethoscope,
  LayoutGrid,
  List,
  IdCard,
  CalendarDays,
  Phone,
  Mail,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { formatarCpf } from "@/lib/cpf";
import { formatarMoeda, mascararMoedaInput, desmascararMoeda } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { SkeletonCards } from "@/components/ui/Skeleton";
import type { Cliente, LogAlteracao, QuantidadeParcelas, StatusCirurgia, StatusFinanceiro } from "@/types/database";
import {
  PERCENTUAL_MINIMO_AGENDAR,
  QUANTIDADE_PARCELAS_OPCOES,
  STATUS_CIRURGIA_LABEL,
  STATUS_FINANCEIRO_LABEL,
  TAXA_ADMINISTRATIVA_PADRAO,
} from "@/types/database";

const STATUS_FINANCEIRO_ESTILO: Record<StatusFinanceiro, string> = {
  pago: "bg-success/10 text-success",
  a_pagar: "bg-alert/10 text-alert",
  parcial: "bg-gold/15 text-gold",
};

// Status financeiro REAL da cliente: calculado a partir da % de parcelas
// pagas (boletos), não do campo manual. O campo manual só é usado como
// fallback pra clientes que ainda não tiveram boletos gerados.
function statusPagamento(c: Cliente): { chave: StatusFinanceiro; label: string; estilo: string } {
  const p = c.porcentagem_pagamento;
  if (p === null || p === undefined) {
    return {
      chave: c.status_financeiro,
      label: STATUS_FINANCEIRO_LABEL[c.status_financeiro],
      estilo: STATUS_FINANCEIRO_ESTILO[c.status_financeiro],
    };
  }
  // Prefixo "N · " com a quantidade de parcelas já pagas, antes do %.
  const prefixo = c.parcelas_pagas !== null && c.parcelas_pagas !== undefined ? `${c.parcelas_pagas} · ` : "";
  if (p >= 100) {
    return { chave: "pago", label: "Quitado", estilo: STATUS_FINANCEIRO_ESTILO.pago };
  }
  if (p <= 0) {
    return { chave: "a_pagar", label: "1ª parcela", estilo: STATUS_FINANCEIRO_ESTILO.a_pagar };
  }
  // Atingiu o % mínimo de parcelas pagas pro plano dela: mesmo sem estar
  // quitada, já libera a agenda cirúrgica — por isso já entra no verde
  // de "pago", igual à cliente 100% quitada.
  const percentualMinimo = PERCENTUAL_MINIMO_AGENDAR[c.quantidade_parcelas ?? 12];
  if (p >= percentualMinimo) {
    return { chave: "pago", label: `${prefixo}${p}% pago`, estilo: STATUS_FINANCEIRO_ESTILO.pago };
  }
  return { chave: "parcial", label: `${prefixo}${p}% pago`, estilo: STATUS_FINANCEIRO_ESTILO.parcial };
}

const STATUS_CIRURGIA_ESTILO: Record<StatusCirurgia, string> = {
  nao_agendada: "bg-clay/10 text-clay/60",
  agendada: "bg-rose/15 text-burgundy",
  realizada: "bg-success/10 text-success",
  cancelada: "bg-alert/10 text-alert",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionada, setClienteSelecionada] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebouncedValue(busca, 200);
  const [filtroFinanceiro, setFiltroFinanceiro] = useState<string>("todos");
  const [filtroCirurgia, setFiltroCirurgia] = useState<string>("todos");
  const [visualizacao, setVisualizacao] = useState<"cards" | "lista">("lista");

  async function carregar(force = false) {
    const url = "/api/admin/clientes";
    const cached = !force ? getInstantCache<{ clientes?: Cliente[] }>(url) : null;
    if (cached) { setClientes(cached.clientes ?? []); setCarregando(false); } else setCarregando(true);
    setErroCarregar(null);
    try {
      const data = force ? await refreshInstant<{ clientes?: Cliente[] }>(url) : await fetchInstant<{ clientes?: Cliente[] }>(url);
      setClientes(data.clientes ?? []);
    } catch (err: any) {
      if (!cached) { setErroCarregar(err?.message ?? "Falha de rede ao carregar clientes."); setClientes([]); }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const clientesFiltradas = useMemo(() => {
    const termo = buscaAtrasada.trim().toLowerCase();
    return clientes.filter((c) => {
      const bateBusca =
        !termo ||
        c.nome_completo.toLowerCase().includes(termo) ||
        c.cpf.includes(termo.replace(/\D/g, "")) ||
        (c.medico ?? "").toLowerCase().includes(termo) ||
        (c.hospital ?? "").toLowerCase().includes(termo) ||
        (c.consultora ?? "").toLowerCase().includes(termo);
      const bateFinanceiro = filtroFinanceiro === "todos" || statusPagamento(c).chave === filtroFinanceiro;
      const bateCirurgia = filtroCirurgia === "todos" || c.status_cirurgia === filtroCirurgia;
      return bateBusca && bateFinanceiro && bateCirurgia;
    });
  }, [clientes, buscaAtrasada, filtroFinanceiro, filtroCirurgia]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-burgundy">Clientes</h1>
          <p className="text-sm text-clay/50">Cadastre e acompanhe o perfil completo de cada cliente.</p>
        </div>
        <Button onClick={() => setModalAberto(true)}>
          <Plus className="h-4 w-4" /> Nova cliente
        </Button>
      </div>

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-clay/30" />
          <Input
            placeholder="Buscar por nome, CPF, médico, hospital ou consultora…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroFinanceiro} onChange={(e) => setFiltroFinanceiro(e.target.value)} className="w-auto">
          <option value="todos">Financeiro: todos</option>
          {Object.entries(STATUS_FINANCEIRO_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </Select>
        <Select value={filtroCirurgia} onChange={(e) => setFiltroCirurgia(e.target.value)} className="w-auto">
          <option value="todos">Processo: todos</option>
          {Object.entries(STATUS_CIRURGIA_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1 rounded-full border border-rose/15 bg-cream p-1">
          <button
            type="button"
            onClick={() => setVisualizacao("cards")}
            aria-label="Ver em cards"
            aria-pressed={visualizacao === "cards"}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              visualizacao === "cards" ? "bg-burgundy text-cream" : "text-clay/50 hover:text-burgundy"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao("lista")}
            aria-label="Ver em lista"
            aria-pressed={visualizacao === "lista"}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              visualizacao === "lista" ? "bg-burgundy text-cream" : "text-clay/50 hover:text-burgundy"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </Card>

      {carregando ? (
        <SkeletonCards count={6} />
      ) : erroCarregar ? (
        <Card className="flex flex-col items-center gap-3 border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm font-medium text-red-700">Não foi possível carregar as clientes</p>
          <p className="text-xs text-red-600">{erroCarregar}</p>
          <button
            onClick={() => carregar()}
            className="mt-1 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Tentar de novo
          </button>
        </Card>
      ) : clientesFiltradas.length === 0 ? (
        <Card className="p-12 text-center text-sm text-clay/40">
          {clientes.length === 0 ? "Nenhuma cliente cadastrada ainda." : "Nenhuma cliente encontrada com esses filtros."}
        </Card>
      ) : visualizacao === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltradas.map((c, i) => (
            <Card
              key={c.id}
              onClick={() => setClienteSelecionada(c)}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              className="flex cursor-pointer flex-col gap-3 p-6 opacity-0 transition-transform duration-200 hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blush p-2.5 text-burgundy">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-burgundy">{c.nome_completo}</p>
                  <p className="text-xs text-clay/40">{formatarCpf(c.cpf)}</p>
                </div>
              </div>

              {(c.procedimento || c.medico || c.hospital) && (
                <div className="flex items-start gap-2 rounded-2xl bg-blush/40 p-3 text-xs text-clay/70">
                  <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" />
                  <div className="space-y-0.5">
                    {c.procedimento && <p className="font-medium text-clay">{c.procedimento}</p>}
                    {c.medico && <p>Dr(a). {c.medico}</p>}
                    {c.hospital && <p>{c.hospital}</p>}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${statusPagamento(c).estilo}`}>
                  {statusPagamento(c).label}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs ${STATUS_CIRURGIA_ESTILO[c.status_cirurgia]}`}>
                  {STATUS_CIRURGIA_LABEL[c.status_cirurgia]}
                </span>
                {!c.ativo && (
                  <span className="rounded-full bg-clay/10 px-3 py-1 text-xs text-clay/50">Inativa</span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-rose/10 pt-3">
                <span className="text-xs uppercase tracking-label text-rose">Contrato</span>
                <span className="text-xl font-semibold text-burgundy">
                  {formatarMoeda(c.valor_contrato)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-rose/10 text-left text-[10.5px] uppercase tracking-[0.12em] text-clay/40">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Financeiro</th>
                  <th className="px-5 py-3 font-medium">Procedimento</th>
                  <th className="px-5 py-3 font-medium">Telefone</th>
                  <th className="px-5 py-3 text-right font-medium">Contrato</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltradas.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setClienteSelecionada(c)}
                    className="cursor-pointer border-b border-rose/5 transition-colors last:border-b-0 hover:bg-blush/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush text-burgundy">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-burgundy">{c.nome_completo}</p>
                          <p className="text-xs text-clay/40">{formatarCpf(c.cpf)}</p>
                        </div>
                        {!c.ativo && (
                          <span className="shrink-0 rounded-full bg-clay/10 px-2.5 py-0.5 text-[11px] text-clay/50">Inativa</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs ${statusPagamento(c).estilo}`}>
                        {statusPagamento(c).label}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-[220px] truncate text-clay/60">{c.procedimento || "—"}</td>
                    <td className="px-5 py-4 text-clay/60">{c.telefone || "—"}</td>
                    <td className="px-5 py-4 text-right font-semibold text-burgundy">
                      {formatarMoeda(c.valor_contrato)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modalAberto && (
        <ModalCliente
          cliente={null}
          onClose={() => setModalAberto(false)}
          onSalvo={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}

      {clienteSelecionada && (
        <ModalCliente
          cliente={clienteSelecionada}
          onClose={() => setClienteSelecionada(null)}
          onSalvo={() => {
            setClienteSelecionada(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

interface FormState {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  email: string;

  procedimento: string;
  medico: string;
  hospital: string;
  consultora: string;
  valorContrato: string;
  taxaAdministrativaPercentual: string;
  statusCirurgia: StatusCirurgia;
  statusFinanceiro: StatusFinanceiro;
  ativo: boolean;
  observacoes: string;
}

// Agrupa campos do formulário compacto em seções com título, pra dar
// hierarquia visual sem precisar de abas separadas.
function SecaoFormulario({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-label text-rose">{titulo}</p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// Campo compacto com ícone, usado no formulário enxuto de cadastro rápido.
function CampoComIcone({
  icone: Icone,
  id,
  label,
  children,
}: {
  icone: ComponentType<{ className?: string }>;
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 flex items-center gap-1.5">
        <Icone className="h-3 w-3 text-rose" /> {label}
      </Label>
      {children}
    </div>
  );
}

function estadoInicial(cliente: Cliente | null): FormState {
  if (!cliente) {
    return {
      nomeCompleto: "",
      cpf: "",
      dataNascimento: "",
      telefone: "",
      email: "",

      procedimento: "",
      medico: "",
      hospital: "",
      consultora: "",
      valorContrato: "",
      taxaAdministrativaPercentual: "",
      statusCirurgia: "nao_agendada",
      statusFinanceiro: "a_pagar",
      ativo: true,
      observacoes: "",
    };
  }
  return {
    nomeCompleto: cliente.nome_completo,
    cpf: formatarCpf(cliente.cpf),
    dataNascimento: cliente.data_nascimento,
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",

    procedimento: cliente.procedimento ?? "",
    medico: cliente.medico ?? "",
    hospital: cliente.hospital ?? "",
    consultora: cliente.consultora ?? "",
    valorContrato: cliente.valor_contrato
      ? cliente.valor_contrato.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
    taxaAdministrativaPercentual: cliente.taxa_administrativa_percentual
      ? String(cliente.taxa_administrativa_percentual).replace(".", ",")
      : "",
    statusCirurgia: cliente.status_cirurgia,
    statusFinanceiro: cliente.status_financeiro,
    ativo: cliente.ativo,
    observacoes: cliente.observacoes_internas ?? "",
  };
}

function ModalCliente({
  cliente,
  onClose,
  onSalvo,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const editando = !!cliente;
  const [form, setForm] = useState<FormState>(estadoInicial(cliente));
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [historico, setHistorico] = useState<LogAlteracao[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  // Depois que uma cliente nova é cadastrada, o modal não fecha na hora —
  // ele passa pra essa "etapa 2" com o mesmo card de boletos usado na
  // edição, pra já dar a opção de gerar parcelas/boletos de cara.
  const [clienteCriada, setClienteCriada] = useState<Cliente | null>(null);

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function carregarHistorico() {
    if (!cliente) return;
    setCarregandoHistorico(true);
    const res = await fetch(`/api/admin/clientes/${cliente.id}`);
    const data = await res.json();
    setHistorico(data.historico ?? []);
    setCarregandoHistorico(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const payload = {
      nomeCompleto: form.nomeCompleto,
      cpf: form.cpf,
      dataNascimento: form.dataNascimento,
      telefone: form.telefone,
      email: form.email,

      procedimento: form.procedimento,
      medico: form.medico,
      hospital: form.hospital,
      consultora: form.consultora,
      valorContrato: desmascararMoeda(form.valorContrato),
      taxaAdministrativaPercentual:
        form.taxaAdministrativaPercentual !== ""
          ? Number(form.taxaAdministrativaPercentual.replace(",", "."))
          : undefined,
      statusCirurgia: form.statusCirurgia,
      statusFinanceiro: form.statusFinanceiro,
      ativo: form.ativo,
      observacoes: form.observacoes,
    };

    const res = await fetch(
      editando ? `/api/admin/clientes/${cliente!.id}` : "/api/admin/clientes",
      {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    setSalvando(false);
    if (!res.ok) {
      toast.error(data.erro ?? "Não foi possível salvar a cliente.");
      return;
    }
    if (editando) {
      toast.success("Cadastro atualizado.");
      onSalvo();
      return;
    }
    // Cadastro novo: em vez de fechar o modal, avança pra etapa de
    // parcelamento/boletos, já com a cliente recém-criada.
    toast.success("Cliente cadastrada com sucesso.");
    setClienteCriada(data.cliente);
  }

  async function excluir() {
    if (!cliente) return;
    setExcluindo(true);
    const res = await fetch(`/api/admin/clientes/${cliente.id}`, { method: "DELETE" });
    setExcluindo(false);
    if (!res.ok) {
      toast.error("Não foi possível remover a cliente.");
      return;
    }
    toast.success("Cliente removida.");
    onSalvo();
  }

  // Etapa 2 do cadastro novo: cliente já foi criada, agora oferece a opção
  // de gerar as parcelas e anexar os boletos direto, sem precisar abrir o
  // cadastro de novo depois.
  if (!editando && clienteCriada) {
    return (
      <Portal>
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-burgundy-dark/40 px-3 py-6 backdrop-blur-sm animate-fadeIn sm:px-6 sm:py-8">
          <Card className="max-h-[92vh] w-full max-w-md overflow-y-auto p-0 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-rose/10 bg-gradient-to-br from-blush/60 to-blush/20 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-cream shadow-card">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-heading text-lg leading-tight text-burgundy">
                    {clienteCriada.nome_completo}
                  </h2>
                  <p className="text-xs text-clay/45">Cliente cadastrada · defina o parcelamento agora</p>
                </div>
              </div>
              <button onClick={onSalvo} className="text-clay/40 transition-colors hover:text-burgundy">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 pt-0">
              <SecaoBoletos cliente={clienteCriada} />

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="ghost" className="flex-1" onClick={onSalvo}>
                  Gerar depois
                </Button>
                <Button type="button" className="flex-1" onClick={onSalvo}>
                  Concluir cadastro
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Portal>
    );
  }

  // Cadastro novo: formulário enxuto, só com o essencial, preenchido de
  // uma vez só — sem precisar voltar depois pra completar em outro lugar.
  // Médico/hospital/consultora/status ficam com valores padrão e só
  // aparecem depois, quando a cliente for editada.
  if (!editando) {
    return (
      <Portal>
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-burgundy-dark/40 px-3 py-6 backdrop-blur-sm animate-fadeIn sm:px-6 sm:py-8">
          <Card className="w-full max-w-md overflow-hidden p-0 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-rose/10 bg-gradient-to-br from-blush/60 to-blush/20 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy text-cream shadow-card">
                  <UserRound className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-heading text-lg leading-tight text-burgundy">Nova cliente</h2>
                  <p className="text-xs text-clay/45">Cadastro completo em uma única etapa</p>
                </div>
              </div>
              <button onClick={onClose} className="text-clay/40 transition-colors hover:text-burgundy">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvar} className="p-6">
              <SecaoFormulario titulo="Dados pessoais">
                <div className="sm:col-span-2">
                  <CampoComIcone icone={UserRound} id="nome" label="Nome completo">
                    <Input
                      id="nome"
                      value={form.nomeCompleto}
                      onChange={(e) => set("nomeCompleto", e.target.value)}
                      placeholder="Nome completo da cliente"
                      required
                    />
                  </CampoComIcone>
                </div>

                <CampoComIcone icone={IdCard} id="cpf" label="CPF">
                  <Input
                    id="cpf"
                    value={form.cpf}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    onChange={(e) => set("cpf", formatarCpf(e.target.value))}
                    required
                  />
                </CampoComIcone>

                <CampoComIcone icone={CalendarDays} id="nascimento" label="Nascimento">
                  <Input
                    id="nascimento"
                    type="date"
                    value={form.dataNascimento}
                    onChange={(e) => set("dataNascimento", e.target.value)}
                    required
                  />
                </CampoComIcone>

                <CampoComIcone icone={Phone} id="telefone" label="Telefone">
                  <Input
                    id="telefone"
                    value={form.telefone}
                    placeholder="(00) 00000-0000"
                    onChange={(e) => set("telefone", e.target.value)}
                  />
                </CampoComIcone>

                <CampoComIcone icone={Mail} id="email" label="E-mail">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    placeholder="cliente@email.com"
                    onChange={(e) => set("email", e.target.value)}
                  />
                </CampoComIcone>
              </SecaoFormulario>

              <SecaoFormulario titulo="Procedimento e contrato" className="mt-5">
                <div className="sm:col-span-2">
                  <CampoComIcone icone={Stethoscope} id="procedimento" label="Procedimento">
                    <Input
                      id="procedimento"
                      value={form.procedimento}
                      placeholder="Ex.: Mastopexia com prótese"
                      onChange={(e) => set("procedimento", e.target.value)}
                    />
                  </CampoComIcone>
                </div>

                <div className="sm:col-span-2">
                  <CampoComIcone icone={Wallet} id="valor" label="Valor da carta de crédito">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-clay/40">
                        R$
                      </span>
                      <Input
                        id="valor"
                        inputMode="decimal"
                        value={form.valorContrato}
                        placeholder="0,00"
                        onChange={(e) => set("valorContrato", mascararMoedaInput(e.target.value))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </CampoComIcone>
                </div>
              </SecaoFormulario>

              <Button type="submit" loading={salvando} className="mt-6 w-full">
                Cadastrar e continuar
              </Button>
              <p className="mt-3 text-center text-[0.68rem] leading-relaxed text-clay/40">
                Na próxima etapa você já pode gerar as parcelas e os boletos. Médico, hospital,
                consultora e status do processo ficam disponíveis depois, ao editar o cadastro.
              </p>
            </form>
          </Card>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-burgundy-dark/40 px-3 py-6 backdrop-blur-sm animate-fadeIn sm:px-6 sm:py-8">
        <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 animate-scaleIn sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl text-burgundy">
            {form.nomeCompleto || "Editar cliente"}
          </h2>
          <button onClick={onClose} className="text-clay/40 hover:text-burgundy">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={salvar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" value={form.nomeCompleto} onChange={(e) => set("nomeCompleto", e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={form.cpf}
              maxLength={14}
              disabled={editando}
              onChange={(e) => set("cpf", formatarCpf(e.target.value))}
              required
            />
          </div>
          <div>
            <Label htmlFor="nascimento">Data de nascimento</Label>
            <Input
              id="nascimento"
              type="date"
              value={form.dataNascimento}
              disabled={editando}
              onChange={(e) => set("dataNascimento", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div className="sm:col-span-2 border-t border-rose/10 pt-4">
            <p className="mb-3 text-xs uppercase tracking-label text-rose">Procedimento</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="procedimento">Procedimento</Label>
            <Input id="procedimento" value={form.procedimento} onChange={(e) => set("procedimento", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="medico">Médico</Label>
            <Input id="medico" value={form.medico} onChange={(e) => set("medico", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hospital">Hospital</Label>
            <Input id="hospital" value={form.hospital} onChange={(e) => set("hospital", e.target.value)} />
          </div>

          <div className="sm:col-span-2 border-t border-rose/10 pt-4">
            <p className="mb-3 text-xs uppercase tracking-label text-rose">Acompanhamento</p>
          </div>
          <div>
            <Label htmlFor="consultora">Consultora</Label>
            <Input id="consultora" value={form.consultora} onChange={(e) => set("consultora", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="statusCirurgia">Status do processo</Label>
            <Select
              id="statusCirurgia"
              value={form.statusCirurgia}
              onChange={(e) => set("statusCirurgia", e.target.value as StatusCirurgia)}
            >
              {Object.entries(STATUS_CIRURGIA_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2 border-t border-rose/10 pt-4">
            <p className="mb-3 text-xs uppercase tracking-label text-rose">Financeiro</p>
          </div>
          <div>
            <Label htmlFor="valor">Valor do contrato (R$)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-clay/40">
                R$
              </span>
              <Input
                id="valor"
                inputMode="decimal"
                value={form.valorContrato}
                onChange={(e) => set("valorContrato", mascararMoedaInput(e.target.value))}
                placeholder="0,00"
                className="pl-10"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="statusFinanceiro">Status financeiro</Label>
            <Select
              id="statusFinanceiro"
              value={form.statusFinanceiro}
              onChange={(e) => set("statusFinanceiro", e.target.value as StatusFinanceiro)}
            >
              {Object.entries(STATUS_FINANCEIRO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="taxaAdministrativa">Taxa administrativa (%)</Label>
            <div className="relative">
              <Input
                id="taxaAdministrativa"
                inputMode="decimal"
                value={form.taxaAdministrativaPercentual}
                onChange={(e) => set("taxaAdministrativaPercentual", e.target.value)}
                placeholder="0,00"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-clay/40">
                %
              </span>
            </div>
            {editando && cliente && (
              <p className="mt-1 text-[0.65rem] leading-relaxed text-clay/40">
                Custo total atual: {formatarMoeda(cliente.custo_total ?? cliente.valor_contrato)}. Alterar a
                taxa aqui não recalcula parcelas já geradas — edite o valor de cada boleto em Pagamentos
                se precisar ajustá-las.
              </p>
            )}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => set("ativo", e.target.checked)}
              className="h-4 w-4 rounded border-rose/40 text-rose focus:ring-rose/30"
            />
            <Label htmlFor="ativo" className="mb-0">Cliente ativa</Label>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações internas sobre a cliente…"
            />
          </div>

          <Button type="submit" loading={salvando} className="sm:col-span-2 mt-2">
            Salvar alterações
          </Button>
        </form>

        <SecaoBoletos cliente={cliente!} />

        {editando && (
          <div className="mt-6 border-t border-rose/10 pt-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMostrarHistorico((v) => !v);
                  if (!mostrarHistorico && historico.length === 0) carregarHistorico();
                }}
                className="flex items-center gap-2 text-sm text-burgundy/70 hover:text-burgundy"
              >
                <History className="h-4 w-4" /> Histórico de alterações
              </button>
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                className="flex items-center gap-2 text-sm text-alert/80 hover:text-alert"
              >
                <Trash2 className="h-4 w-4" /> Remover cliente
              </button>
            </div>

            {mostrarHistorico && (
              <div className="mt-4 max-h-56 space-y-3 overflow-y-auto rounded-2xl bg-blush/30 p-4">
                {carregandoHistorico ? (
                  <p className="text-xs text-clay/40">Carregando histórico…</p>
                ) : historico.length === 0 ? (
                  <p className="text-xs text-clay/40">Nenhuma alteração registrada ainda.</p>
                ) : (
                  historico.map((log) => (
                    <div key={log.id} className="text-xs text-clay/70">
                      <p className="text-[0.65rem] uppercase tracking-label text-rose">
                        {new Date(log.created_at).toLocaleString("pt-BR")} · {log.usuario}
                      </p>
                      {log.acao === "editou_cliente" && Array.isArray((log.detalhes as any)?.alteracoes) ? (
                        <ul className="mt-1 list-disc pl-4">
                          {(log.detalhes as any).alteracoes.map((alt: any, i: number) => (
                            <li key={i}>
                              <span className="font-medium text-clay">{alt.campo}:</span>{" "}
                              {String(alt.de ?? "—")} → {String(alt.para ?? "—")}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1">{log.acao.replaceAll("_", " ")}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {confirmarExclusao && (
              <div className="mt-4 rounded-2xl border border-alert/20 bg-alert/5 p-4">
                <p className="mb-3 text-sm text-clay">
                  Tem certeza que deseja remover <strong>{cliente!.nome_completo}</strong>? Essa ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <Button variant="danger" loading={excluindo} onClick={excluir}>
                    Sim, remover
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmarExclusao(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      </div>
    </Portal>
  );
}

interface ResumoBoletos {
  boletos: Array<{ id: string; status: string }>;
  porcentagemPagamento: number;
  podeAgendar: boolean;
  agendaLiberada: boolean;
  statusRevisaoFinanceira: "pendente" | "aprovada" | "recusada" | null;
}

function SecaoBoletos({ cliente }: { cliente: Cliente }) {
  const [resumo, setResumo] = useState<ResumoBoletos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<QuantidadeParcelas>(
    cliente.quantidade_parcelas ?? 12
  );
  const [taxaPercentual, setTaxaPercentual] = useState<string>(
    String(TAXA_ADMINISTRATIVA_PADRAO[cliente.quantidade_parcelas ?? 12])
  );
  const [taxaEditadaManualmente, setTaxaEditadaManualmente] = useState(false);
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");
  const [gerando, setGerando] = useState(false);
  const [arquivoCarne, setArquivoCarne] = useState<File | null>(null);
  const [enviandoCarne, setEnviandoCarne] = useState(false);

  function mudarParcelas(valor: QuantidadeParcelas) {
    setQuantidadeParcelas(valor);
    // Se o admin ainda não mexeu manualmente na taxa, atualiza pro padrão
    // da tabela comercial correspondente ao novo nº de parcelas.
    if (!taxaEditadaManualmente) {
      setTaxaPercentual(String(TAXA_ADMINISTRATIVA_PADRAO[valor]));
    }
  }

  const taxaNumero = Number(taxaPercentual.replace(",", ".")) || 0;
  const custoTotalPrevisto = cliente.valor_contrato * (1 + taxaNumero / 100);
  const valorParcelaPrevisto = quantidadeParcelas > 0 ? custoTotalPrevisto / quantidadeParcelas : 0;
  const lucroPrevisto = custoTotalPrevisto - cliente.valor_contrato;

  async function carregar() {
    setCarregando(true);
    const res = await fetch(`/api/admin/clientes/${cliente.id}/boletos`);
    const data = await res.json();
    setResumo(res.ok ? data : null);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  async function gerarBoletos() {
    setGerando(true);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}/boletos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidadeParcelas,
          taxaPercentual: taxaNumero,
          primeiroVencimento: primeiroVencimento || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.erro ?? "Não foi possível gerar os boletos.");
        return;
      }
      toast.success("Boletos gerados com sucesso.");
      carregar();
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  async function enviarCarne() {
    if (!arquivoCarne) {
      toast.error("Selecione o PDF do carnê primeiro.");
      return;
    }
    setEnviandoCarne(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivoCarne);
      const res = await fetch(`/api/admin/clientes/${cliente.id}/boletos/carne`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.erro ?? "Não foi possível processar o carnê.");
        return;
      }
      toast.success(`Carnê anexado: ${data.parcelas_atualizadas} parcela(s) atualizada(s).`);
      setArquivoCarne(null);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setEnviandoCarne(false);
    }
  }

  const temBoletos = (resumo?.boletos.length ?? 0) > 0;

  return (
    <div className="mt-6 border-t border-rose/10 pt-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-burgundy/80">
        <Receipt className="h-4 w-4" /> Boletos e progresso de pagamento
      </p>

      {carregando ? (
        <p className="text-xs text-clay/40">Carregando…</p>
      ) : temBoletos ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-blush/30 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-clay/60">Progresso de pagamento</span>
              <span className="font-semibold text-burgundy">{resumo!.porcentagemPagamento}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-clay/15">
              <div
                className={`h-full rounded-full ${resumo!.agendaLiberada ? "bg-success" : resumo!.statusRevisaoFinanceira === "recusada" ? "bg-alert" : "bg-gold"}`}
                style={{ width: `${Math.min(resumo!.porcentagemPagamento, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-clay/50">
              {resumo!.agendaLiberada
                ? "Agenda liberada para essa cliente."
                : resumo!.statusRevisaoFinanceira === "pendente"
                ? "% atingido — aguardando revisão financeira (até 72h)."
                : resumo!.statusRevisaoFinanceira === "recusada"
                ? "Revisão financeira recusada — verifique divergências com a cliente."
                : "Agenda ainda bloqueada."}
            </p>
            {resumo!.statusRevisaoFinanceira === "pendente" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await fetch(`/api/admin/clientes/${cliente.id}/revisao-financeira`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ decisao: "aprovada" }),
                    });
                    if (res.ok) {
                      toast.success("Agenda liberada para a cliente.");
                      carregar();
                    } else {
                      toast.error("Não foi possível confirmar.");
                    }
                  }}
                >
                  Confirmar liberação
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="!text-alert"
                  onClick={async () => {
                    const motivo = window.prompt("Descreva a divergência encontrada (opcional):");
                    if (motivo === null) return;
                    const res = await fetch(`/api/admin/clientes/${cliente.id}/revisao-financeira`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ decisao: "recusada", observacao: motivo || undefined }),
                    });
                    if (res.ok) {
                      toast.success("Revisão recusada.");
                      carregar();
                    } else {
                      toast.error("Não foi possível recusar.");
                    }
                  }}
                >
                  Recusar
                </Button>
              </div>
            )}
          </div>
          <Link
            href={`/admin/pagamentos?cliente_id=${cliente.id}`}
            className="inline-flex items-center gap-2 text-sm text-burgundy/70 hover:text-burgundy"
          >
            <Receipt className="h-4 w-4" /> Ver todos os boletos dessa cliente
          </Link>

          <div className="rounded-2xl bg-blush/30 p-4">
            <p className="mb-2 text-xs font-medium text-burgundy/80">Anexar carnê completo (PDF)</p>
            <p className="mb-3 text-xs text-clay/55">
              Envie o PDF do carnê inteiro do banco (uma página por parcela, em ordem).
              O sistema corta automaticamente e associa cada página à parcela correspondente —
              a cliente poderá visualizar o boleto de cada parcela no app.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setArquivoCarne(e.target.files?.[0] || null)}
                className="flex-1 text-xs text-clay/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-burgundy hover:file:bg-bloom/60"
              />
              <Button type="button" size="sm" loading={enviandoCarne} onClick={enviarCarne} disabled={!arquivoCarne}>
                Enviar carnê
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-blush/30 p-4">
          <p className="text-xs text-clay/55">
            Nenhum boleto gerado ainda. Defina o parcelamento e a taxa administrativa pra
            criar as parcelas automaticamente, com base no valor liberado à cliente
            ({formatarMoeda(cliente.valor_contrato)}).
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="quantidadeParcelas" className="mb-1">Nº de parcelas</Label>
              <Select
                id="quantidadeParcelas"
                value={quantidadeParcelas}
                onChange={(e) => mudarParcelas(Number(e.target.value) as QuantidadeParcelas)}
              >
                {QUANTIDADE_PARCELAS_OPCOES.map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="taxaPercentual" className="mb-1">Taxa administrativa (%)</Label>
              <Input
                id="taxaPercentual"
                inputMode="decimal"
                value={taxaPercentual}
                onChange={(e) => {
                  setTaxaEditadaManualmente(true);
                  setTaxaPercentual(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="primeiroVencimento" className="mb-1">1º vencimento</Label>
              <Input
                id="primeiroVencimento"
                type="date"
                value={primeiroVencimento}
                onChange={(e) => setPrimeiroVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/60 p-3 text-center text-[0.7rem] sm:gap-3 sm:text-xs">
            <div>
              <p className="text-clay/45">Custo total</p>
              <p className="mt-0.5 font-semibold text-burgundy">{formatarMoeda(custoTotalPrevisto)}</p>
            </div>
            <div>
              <p className="text-clay/45">Parcela ({quantidadeParcelas}x)</p>
              <p className="mt-0.5 font-semibold text-burgundy">{formatarMoeda(valorParcelaPrevisto)}</p>
            </div>
            <div>
              <p className="text-clay/45">Lucro (taxa adm.)</p>
              <p className="mt-0.5 font-semibold text-success">{formatarMoeda(lucroPrevisto)}</p>
            </div>
          </div>

          <Button type="button" size="sm" loading={gerando} onClick={gerarBoletos}>
            Gerar boletos
          </Button>
        </div>
      )}
    </div>
  );
}
