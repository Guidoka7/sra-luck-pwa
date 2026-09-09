"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2, CheckCircle2, KeyRound, MessageSquareQuote, Pencil, Plus, Save, ShieldCheck, Trash2, UserCog, XCircle } from "lucide-react";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

type Cargo = "vendedora" | "sdr" | "financeiro";
type Colaborador = { id: string; auth_user_id: string; nome: string; email: string; cargo: Cargo; ativo: boolean; permissoes: string[] };
type Agendamento = { id: string; sdr_id: string | null; comparecimento_status: string | null; datas: { data?: string } | null; clientes: { nome_completo?: string } | null };
type Mensagem = { id: string; cargo: Cargo | null; titulo: string; mensagem: string; programada_para: string | null; ativo: boolean };

const cargoLabel: Record<Cargo, string> = { vendedora: "Vendedora", sdr: "SDR", financeiro: "Financeiro" };

export default function ColaboradoresAdminPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState<Cargo>("vendedora");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [cargoMensagem, setCargoMensagem] = useState<Cargo | "">("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    const [equipeRes, agendaRes, mensagensRes] = await Promise.all([
      fetch("/api/admin/colaboradores", { cache: "no-store" }),
      fetch("/api/admin/agendamentos/comparecimentos", { cache: "no-store" }),
      fetch("/api/admin/mensagens-motivacionais", { cache: "no-store" }),
    ]);
    const equipe = await equipeRes.json().catch(() => ({}));
    if (!equipeRes.ok) toast.error(equipe.erro ?? "Não foi possível carregar colaboradores.");
    else setColaboradores(equipe.colaboradores ?? []);
    if (agendaRes.ok) setAgendamentos((await agendaRes.json()).agendamentos ?? []);
    if (mensagensRes.ok) setMensagens((await mensagensRes.json()).mensagens ?? []);
    setCarregando(false);
  }

  useEffect(() => { void carregar(); }, []);

  async function criarPerfil(event: React.FormEvent) {
    event.preventDefault();
    if (senha !== confirmarSenha) return toast.error("As senhas não conferem.");
    setSalvando(true);
    const response = await fetch("/api/admin/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, cargo, senha, confirmarSenha }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(data.erro ?? "Não foi possível criar o colaborador.");
    } else {
      toast.success("Colaborador criado com acesso ativo.");
      setNome(""); setEmail(""); setCargo("vendedora"); setSenha(""); setConfirmarSenha("");
      await carregar();
    }
    setSalvando(false);
  }

  async function editarColaborador(colaborador: Colaborador) {
    const novoNome = window.prompt("Nome completo", colaborador.nome);
    if (novoNome === null) return;
    const novoCargo = window.prompt("Cargo: vendedora, sdr ou financeiro", colaborador.cargo)?.toLowerCase().trim();
    if (novoCargo === undefined) return;
    if (!["vendedora", "sdr", "financeiro"].includes(novoCargo)) return toast.error("Cargo inválido.");
    const response = await fetch(`/api/admin/colaboradores/${colaborador.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome, cargo: novoCargo }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível editar o colaborador.");
    else { toast.success("Colaborador atualizado."); await carregar(); }
  }

  async function redefinirSenha(colaborador: Colaborador) {
    const novaSenha = window.prompt(`Nova senha para ${colaborador.nome} (mínimo 8 caracteres)`);
    if (novaSenha === null) return;
    if (novaSenha.length < 8) return toast.error("A nova senha deve ter pelo menos 8 caracteres.");
    const confirmar = window.prompt("Confirme a nova senha");
    if (confirmar !== novaSenha) return toast.error("As senhas não conferem.");
    const response = await fetch(`/api/admin/colaboradores/${colaborador.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: novaSenha }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível redefinir a senha.");
    else toast.success("Senha redefinida com sucesso.");
  }

  async function alternar(colaborador: Colaborador) {
    const acao = colaborador.ativo ? "desativar" : "reativar";
    if (!window.confirm(`Deseja ${acao} o acesso de ${colaborador.nome}?`)) return;
    const response = await fetch(`/api/admin/colaboradores/${colaborador.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !colaborador.ativo }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível atualizar o acesso.");
    else { toast.success(colaborador.ativo ? "Acesso desativado." : "Acesso reativado."); await carregar(); }
  }

  async function excluirColaborador(colaborador: Colaborador) {
    const confirmacao = window.prompt(`ATENÇÃO: a exclusão é permanente e remove também a conta de login de ${colaborador.nome}. Digite EXCLUIR para confirmar.`);
    if (confirmacao !== "EXCLUIR") return;
    const response = await fetch(`/api/admin/colaboradores/${colaborador.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível excluir o colaborador.");
    else { toast.success("Colaborador excluído permanentemente."); await carregar(); }
  }

  async function salvarMeta(colaborador: Colaborador) {
    const meta = window.prompt(`Meta mínima mensal para ${colaborador.nome}`, "0");
    if (meta === null) return;
    const percentual = colaborador.cargo === "financeiro" ? window.prompt("Percentual de comissão (não calcula a comissão enquanto a fórmula não for aprovada)", "") : null;
    const response = await fetch(`/api/admin/colaboradores/${colaborador.id}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metaMinima: Number(meta), percentualComissao: percentual === "" ? null : percentual }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível salvar a meta."); else toast.success("Meta do período atualizada.");
  }

  async function registrarComparecimento(id: string, status: "compareceu" | "nao_compareceu") {
    const response = await fetch(`/api/admin/agendamentos/${id}/comparecimento`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível registrar o comparecimento."); else { toast.success(status === "compareceu" ? "Comparecimento registrado e comissão processada." : "Não comparecimento registrado sem comissão."); await carregar(); }
  }

  async function criarMensagem(event: React.FormEvent) {
    event.preventDefault(); setSalvando(true);
    const response = await fetch("/api/admin/mensagens-motivacionais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, mensagem, cargo: cargoMensagem }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(data.erro ?? "Não foi possível salvar a mensagem."); else { toast.success("Mensagem motivacional criada."); setTitulo(""); setMensagem(""); await carregar(); }
    setSalvando(false);
  }

  return (
    <div data-testid="admin-colaboradores-page" className="space-y-5 pb-8">
      <PageHeader eyebrow="Gestão" title="Colaboradores" description="Crie e administre os acessos do time sem precisar cadastrar usuários manualmente no Supabase Auth." actions={<span data-testid="admin-colaboradores-permission-note" className="inline-flex items-center gap-1.5 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 text-[0.58rem] font-semibold text-success"><ShieldCheck className="h-3.5 w-3.5" /> Cadastro automático de acesso</span>} />

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Panel className="p-5">
          <SectionHeading title="Cadastrar colaborador" description="O sistema cria a conta no Supabase Auth e vincula o perfil automaticamente." />
          <form data-testid="admin-colaborador-create-form" onSubmit={criarPerfil} className="space-y-3">
            <div><Label htmlFor="colaborador-nome">Nome completo</Label><Input data-testid="admin-colaborador-name" id="colaborador-nome" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome completo da colaboradora" required /></div>
            <div><Label htmlFor="colaborador-email">E-mail</Label><Input data-testid="admin-colaborador-email" id="colaborador-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="colaboradora@empresa.com" required /></div>
            <div><Label htmlFor="colaborador-cargo">Cargo</Label><select data-testid="admin-colaborador-role" id="colaborador-cargo" value={cargo} onChange={(event) => setCargo(event.target.value as Cargo)} className="h-10 w-full rounded-lg border border-burgundy/10 bg-white/75 px-3 text-sm text-clay outline-none focus:border-gold/60"><option value="vendedora">Vendedora</option><option value="sdr">SDR</option><option value="financeiro">Financeiro</option></select></div>
            <div><Label htmlFor="colaborador-senha">Senha inicial</Label><Input data-testid="admin-colaborador-password" id="colaborador-senha" type="password" minLength={8} value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Mínimo de 8 caracteres" required /></div>
            <div><Label htmlFor="colaborador-confirmar-senha">Confirmar senha</Label><Input data-testid="admin-colaborador-password-confirm" id="colaborador-confirmar-senha" type="password" minLength={8} value={confirmarSenha} onChange={(event) => setConfirmarSenha(event.target.value)} placeholder="Repita a senha inicial" required /></div>
            <p className="text-[0.65rem] leading-5 text-clay/50">O acesso é criado como <strong>ativo</strong> por padrão. Depois você poderá editar o cargo, redefinir a senha ou desativar o acesso sem perder o histórico.</p>
            <Button data-testid="admin-colaborador-create-submit" type="submit" loading={salvando} className="w-full"><Plus className="h-3.5 w-3.5" /> Criar colaborador</Button>
          </form>
        </Panel>

        <Panel className="p-5">
          <SectionHeading title="Equipe" description="Gerencie cargo, senha e status de acesso de cada colaborador." />
          {carregando ? <p data-testid="admin-colaboradores-loading" className="text-sm text-clay/50">Carregando equipe…</p> : colaboradores.length === 0 ? <p data-testid="admin-colaboradores-empty" className="rounded-xl bg-blush/35 p-5 text-sm text-clay/55">Nenhum colaborador cadastrado na base ainda.</p> : <div className="space-y-2">{colaboradores.map((item) => <div data-testid={`admin-colaborador-${item.id}`} key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-rose/8 bg-white/55 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy"><UserCog className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-burgundy">{item.nome}</p><p className="truncate text-[0.62rem] text-clay/45">{item.email} · {cargoLabel[item.cargo]}</p></div><StatusPill tone={item.ativo ? "success" : "alert"}>{item.ativo ? "Ativo" : "Inativo"}</StatusPill><button data-testid={`admin-colaborador-edit-${item.id}`} onClick={() => void editarColaborador(item)} className="rounded-lg p-2 text-burgundy/55 hover:bg-burgundy/5" title="Editar colaborador"><Pencil className="h-4 w-4" /></button><button data-testid={`admin-colaborador-password-${item.id}`} onClick={() => void redefinirSenha(item)} className="rounded-lg p-2 text-gold hover:bg-gold/10" title="Redefinir senha"><KeyRound className="h-4 w-4" /></button><button data-testid={`admin-colaborador-meta-${item.id}`} onClick={() => void salvarMeta(item)} className="rounded-lg p-2 text-gold hover:bg-gold/10" title="Configurar meta"><TargetIcon /></button><button data-testid={`admin-colaborador-toggle-${item.id}`} onClick={() => void alternar(item)} className="rounded-lg p-2 text-clay/45 hover:bg-blush" title={item.ativo ? "Desativar acesso" : "Reativar acesso"}>{item.ativo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</button><button data-testid={`admin-colaborador-delete-${item.id}`} onClick={() => void excluirColaborador(item)} className="rounded-lg p-2 text-alert/65 hover:bg-alert/10" title="Excluir permanentemente"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel className="p-5"><SectionHeading title="Comparecimentos" description="Evento controlado pelo Administrativo. Compareceu gera R$10 para a SDR; ausência não gera comissão." />{agendamentos.length === 0 ? <p data-testid="admin-attendance-empty" className="rounded-xl bg-blush/35 p-5 text-sm text-clay/55">Nenhum agendamento confirmado disponível para registrar.</p> : <div className="space-y-2">{agendamentos.map((item) => <div data-testid={`admin-attendance-${item.id}`} key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-rose/8 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose/10 text-rose"><CalendarCheck2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-burgundy">{item.clientes?.nome_completo ?? "Cliente"}</p><p className="text-[0.62rem] text-clay/45">{item.datas?.data?.split("-").reverse().join("/") ?? "Data não informada"}</p></div><StatusPill tone={item.comparecimento_status === "compareceu" ? "success" : item.comparecimento_status === "nao_compareceu" ? "alert" : "gold"}>{item.comparecimento_status === "compareceu" ? "Compareceu" : item.comparecimento_status === "nao_compareceu" ? "Não compareceu" : "Pendente"}</StatusPill><button data-testid={`admin-attendance-present-${item.id}`} disabled={item.comparecimento_status === "compareceu"} onClick={() => void registrarComparecimento(item.id, "compareceu")} className="rounded-lg bg-success/10 p-2 text-success disabled:opacity-30" title="Registrar comparecimento"><CheckCircle2 className="h-4 w-4" /></button><button data-testid={`admin-attendance-absent-${item.id}`} disabled={item.comparecimento_status === "nao_compareceu"} onClick={() => void registrarComparecimento(item.id, "nao_compareceu")} className="rounded-lg bg-alert/10 p-2 text-alert disabled:opacity-30" title="Registrar ausência"><XCircle className="h-4 w-4" /></button></div>)}</div>}</Panel>
        <Panel className="p-5"><SectionHeading title="Mensagem motivacional" description="Crie mensagens por setor; o histórico fica pronto para programação." /><form data-testid="admin-motivational-message-form" onSubmit={criarMensagem} className="space-y-3"><div><Label htmlFor="mensagem-titulo">Título</Label><Input data-testid="admin-motivational-title" id="mensagem-titulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Evolução do dia" required /></div><div><Label htmlFor="mensagem-cargo">Setor</Label><select data-testid="admin-motivational-role" id="mensagem-cargo" value={cargoMensagem} onChange={(event) => setCargoMensagem(event.target.value as Cargo | "")} className="h-10 w-full rounded-lg border border-burgundy/10 bg-white/75 px-3 text-sm text-clay outline-none focus:border-gold/60"><option value="">Todos os colaboradores</option><option value="vendedora">Vendedora</option><option value="sdr">SDR</option><option value="financeiro">Financeiro</option></select></div><Textarea data-testid="admin-motivational-body" value={mensagem} onChange={(event) => setMensagem(event.target.value)} placeholder="Escreva uma mensagem profissional e conectada ao desempenho real." required /><Button data-testid="admin-motivational-submit" type="submit" loading={salvando}><Save className="h-3.5 w-3.5" /> Salvar mensagem</Button></form><div className="mt-5 space-y-2 border-t border-rose/8 pt-4">{mensagens.length === 0 ? <p data-testid="admin-motivational-empty" className="text-xs text-clay/50">Nenhuma mensagem cadastrada.</p> : mensagens.slice(0, 4).map((item) => <div data-testid={`admin-motivational-${item.id}`} key={item.id} className="rounded-xl bg-blush/30 p-3"><div className="flex items-center gap-2"><MessageSquareQuote className="h-3.5 w-3.5 text-gold" /><p className="text-xs font-semibold text-burgundy">{item.titulo}</p></div><p className="mt-1 text-[0.65rem] leading-5 text-clay/55">{item.mensagem}</p></div>)}</div></Panel>
      </div>
    </div>
  );
}

function TargetIcon() {
  return <span className="text-xs font-bold">⚑</span>;
}
