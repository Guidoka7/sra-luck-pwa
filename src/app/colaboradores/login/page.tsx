"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/ui/Logo";

export default function LoginColaboradoresPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setErro("A autenticação corporativa ainda não está configurada neste ambiente.");
      setCarregando(false);
      return;
    }
    const supabase = createClientSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }
    const resposta = await fetch("/api/colaboradores/me", { cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      await supabase.auth.signOut();
      setErro(dados.erro ?? "Este usuário não possui um perfil de colaborador ativo.");
      setCarregando(false);
      return;
    }
    toast.success("Acesso confirmado. Abrindo seu espaço.");
    router.push("/colaboradores");
  }

  return <main data-testid="colaboradores-login-page" className="relative flex min-h-[100dvh] items-center overflow-hidden bg-[#26151b] px-4 py-8 text-cream sm:px-8">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(217,196,178,.2),transparent_32%),radial-gradient(circle_at_85%_85%,rgba(122,38,50,.6),transparent_38%)]" aria-hidden="true" />
    <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] shadow-2xl backdrop-blur-2xl md:grid-cols-[1.05fr_.95fr]">
      <section data-testid="colaboradores-login-brand" className="hidden min-h-[620px] flex-col justify-between border-r border-white/10 p-10 md:flex lg:p-14">
        <div><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><LogoMark className="h-7 w-7" /></span><span className="font-heading text-lg">Sra. Luck</span></div><p className="mt-20 max-w-sm text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-gold">Workspace de colaboradores</p><h1 className="mt-5 max-w-md font-heading text-5xl leading-[.98] text-white">Seu resultado, com clareza e intenção.</h1><p className="mt-6 max-w-sm text-sm leading-6 text-cream/65">Um espaço único para acompanhar vendas, agenda, comparecimentos e resultados com a mesma experiência Sra. Luck.</p></div>
        <div className="flex items-center gap-2 text-xs text-cream/55"><ShieldCheck className="h-4 w-4 text-gold" /> Acesso protegido por perfil e permissão</div>
      </section>
      <section className="bg-[#fbf7f4] p-6 text-burgundy sm:p-10 lg:p-14"><div className="mb-10 flex items-center gap-3 md:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-burgundy/8"><LogoMark className="h-6 w-6" /></span><span className="font-heading text-lg">Sra. Luck</span></div><p className="text-[0.6rem] font-bold uppercase tracking-[0.26em] text-rose">Acesso da equipe</p><h2 data-testid="colaboradores-login-title" className="mt-3 font-heading text-3xl leading-tight">Bem-vinda ao seu espaço.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-clay/60">Entre com seu acesso corporativo. A sua função define automaticamente o painel disponível.</p>
        <form data-testid="colaboradores-login-form" onSubmit={entrar} className="mt-9 space-y-4"><label className="block"><span className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-clay/55">E-mail</span><span className="relative block"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-clay/35" aria-hidden="true" /><input data-testid="colaboradores-login-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-xl border border-burgundy/10 bg-white px-10 text-sm outline-none transition-[border,box-shadow] focus:border-gold focus:ring-2 focus:ring-gold/20" placeholder="voce@empresa.com" /></span></label><label className="block"><span className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-clay/55">Senha</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-clay/35" aria-hidden="true" /><input data-testid="colaboradores-login-password" required type="password" autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} className="h-11 w-full rounded-xl border border-burgundy/10 bg-white px-10 text-sm outline-none transition-[border,box-shadow] focus:border-gold focus:ring-2 focus:ring-gold/20" placeholder="Sua senha" /></span></label>{erro && <p data-testid="colaboradores-login-error" role="alert" className="rounded-xl border border-alert/20 bg-alert/5 px-3 py-2.5 text-xs text-alert">{erro}</p>}<button data-testid="colaboradores-login-submit" type="submit" disabled={carregando} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-burgundy text-sm font-bold text-cream shadow-[0_16px_28px_-18px_rgba(88,25,38,.7)] transition-[transform,box-shadow,background] hover:-translate-y-0.5 hover:bg-rose-dark disabled:cursor-not-allowed disabled:opacity-60">{carregando ? "Verificando acesso…" : "Entrar no workspace"}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></button></form><p data-testid="colaboradores-login-security-note" className="mt-8 text-center text-[0.62rem] leading-5 text-clay/40">Se você precisa de acesso ou alteração de perfil, fale com o Administrativo.</p>
      </section>
    </div>
  </main>;
}