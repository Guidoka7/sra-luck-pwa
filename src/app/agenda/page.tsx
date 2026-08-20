"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/ui/Logo";
import { CelebracaoData } from "@/components/cliente/CelebracaoData";
import { CardPrevisaoLiberacao } from "@/components/cliente/CardPrevisaoLiberacao";
import { CentralNotificacoes } from "@/components/cliente/CentralNotificacoes";
import { AtivarNotificacoesPush } from "@/components/cliente/AtivarNotificacoesPush";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { CalendarioAgendamento, DataDisponivel } from "@/components/cliente/CalendarioAgendamento";
import { TabBoletos } from "@/components/cliente/TabBoletos";
import { RegrasLiberacao } from "@/components/cliente/RegrasLiberacao";
import { JourneyTracker } from "@/components/cliente/JourneyTracker";
import { WhatsAppFab } from "@/components/cliente/WhatsAppFab";
import { primeiroNome, percentualNecessario } from "@/lib/utils";
import { PRAZO_REVISAO_FINANCEIRA_HORAS, type StatusRevisaoFinanceira } from "@/types/database";
import { Clock, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";

type Aba = "cirurgia" | "boletos";

interface ConfigPublica {
  pagamento: { pixChave: string | null; pixQrCodeUrl: string | null; pixDescontoPercentual?: number };
  contato: { whatsapp: string | null; telefone: string | null };
}

export default function AgendaClientePage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("cirurgia");
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [notificacaoTick, setNotificacaoTick] = useState(0);
  const [procedimento, setProcedimento] = useState<string | null>(null);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState<{
    id: string;
    data: string;
    previsaoLiberacaoFinanceira: string | null;
  } | null>(null);
  const [datas, setDatas] = useState<DataDisponivel[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [celebrando, setCelebrando] = useState<string | null>(null);
  const [podeAgendar, setPodeAgendar] = useState(true);
  const [agendaLiberada, setAgendaLiberada] = useState(true);
  const [statusRevisao, setStatusRevisao] = useState<StatusRevisaoFinanceira | null>(null);
  const [dataAtingiuPercentual, setDataAtingiuPercentual] = useState<string | null>(null);
  const [porcentagemPagamento, setPorcentagemPagamento] = useState<number | null>(null);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number | null>(null);
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [destacarCardLiberacao, setDestacarCardLiberacao] = useState(false);
  const agendaLiberadaRef = useRef(true);
  // undefined = ainda não carregamos nada (evita toast falso no primeiro load);
  // null = sem previsão cadastrada; string = previsão atual.
  const previsaoRef = useRef<string | null | undefined>(undefined);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    const [resAgenda, resBoletos] = await Promise.all([
      fetch("/api/cliente/agenda"),
      fetch("/api/cliente/boletos"),
    ]);
    if (!resAgenda.ok) {
      router.push("/login");
      return;
    }
    const data = await resAgenda.json();
    setNome(data.cliente.nome);
    setClienteId(data.cliente.id ?? null);
    setProcedimento(data.cliente.procedimento ?? null);
    setAgendamentoAtivo(data.agendamentoAtivo);
    setDatas(data.datasDisponiveis);

    // Avisa a cliente assim que a gestão cadastra ou altera a previsão de
    // liberação — sem precisar recarregar a página manualmente.
    const novaPrevisao: string | null = data.agendamentoAtivo?.previsaoLiberacaoFinanceira ?? null;
    if (previsaoRef.current !== undefined && novaPrevisao !== previsaoRef.current) {
      if (novaPrevisao) {
        toast.success(
          previsaoRef.current
            ? "📅 Sua previsão de liberação foi atualizada. Confira em \"Minha Agenda\"."
            : "📅 Sua previsão de liberação já está disponível em \"Minha Agenda\"."
        );
        // A etapa avançou para "Liberação financeira" agora mesmo — destaca o
        // card por alguns segundos em vez de criar qualquer elemento novo.
        if (!previsaoRef.current) {
          setDestacarCardLiberacao(true);
          setTimeout(() => setDestacarCardLiberacao(false), 4000);
        }
      }
    }
    previsaoRef.current = novaPrevisao;

    // A ausência de boletos cadastrados (ainda não configurado pelo admin)
    // não deve bloquear a cliente indevidamente.
    let liberou = true;
    if (resBoletos.ok) {
      const boletosData = await resBoletos.json();
      const temBoletos = (boletosData.boletos ?? []).length > 0;
      liberou = temBoletos ? Boolean(boletosData.agenda_liberada) : true;
      setPodeAgendar(temBoletos ? Boolean(boletosData.pode_agendar) : true);
      setAgendaLiberada(liberou);
      setStatusRevisao(temBoletos ? boletosData.status_revisao_financeira ?? null : null);
      setDataAtingiuPercentual(boletosData.data_atingiu_percentual ?? null);
      setPorcentagemPagamento(temBoletos ? boletosData.porcentagem_pagamento : null);
      setQuantidadeParcelas(boletosData.quantidade_parcelas ?? null);
    } else {
      setPodeAgendar(true);
      setAgendaLiberada(true);
      setStatusRevisao(null);
      setDataAtingiuPercentual(null);
      setPorcentagemPagamento(null);
      setQuantidadeParcelas(null);
    }

    // Detecta a transição bloqueada → liberada pra avisar a cliente na hora,
    // sem ela precisar sair e entrar de novo no perfil.
    if (liberou && !agendaLiberadaRef.current) {
      toast.success("🎉 Sua agenda foi liberada! Você já pode escolher a data da sua assinatura.");
    }
    agendaLiberadaRef.current = liberou;

    setCarregando(false);
  }

  useEffect(() => {
    carregar();

    // Chave PIX, QR Code e contato mudam raramente — basta buscar uma vez.
    fetch("/api/cliente/config")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setConfig(data))
      .catch((erro) => {
        // Antes essa falha era engolida em silêncio, o que fazia o botão de
        // Pix "desaparecer" sem nenhuma pista do motivo. Agora avisa.
        console.error("Não foi possível carregar chave PIX / contato:", erro);
        toast.error("Não foi possível carregar os dados de pagamento (PIX). Recarregue a página.");
      });

    // Atualiza o status de liberação sozinho em segundo plano — o pagamento
    // é confirmado pelo admin em outra sessão, então a cliente não teria
    // como saber que foi liberada sem recarregar a página manualmente.
    const intervalo = setInterval(() => carregar(true), 30_000);

    // E também assim que a cliente volta pra aba (ex: saiu pra pegar o
    // comprovante e voltou), pra não depender só do intervalo.
    function aoFocarAba() {
      if (document.visibilityState === "visible") carregar(true);
    }
    document.addEventListener("visibilitychange", aoFocarAba);
    window.addEventListener("focus", aoFocarAba);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoFocarAba);
      window.removeEventListener("focus", aoFocarAba);
    };
  }, []);

  // Realtime: assim que o admin cadastra ou altera a previsão de liberação,
  // a gente ouve no mesmo canal (Supabase Realtime Broadcast) que o
  // simulador de iPhone usa pra Dynamic Island, e atualiza a tela na hora —
  // sem depender do polling de 30s nem de um refresh manual.
  useEffect(() => {
    if (!clienteId) return;
    const supabase = createClientSupabaseClient();
    const canal = supabase
      .channel(`notificacoes-cliente:${clienteId}`)
      .on("broadcast", { event: "nova_notificacao" }, () => {
        carregar(true);
        setNotificacaoTick((t) => t + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [clienteId]);

  async function escolherData(dataId: string) {
    if (!agendaLiberada) {
      if (statusRevisao === "pendente") {
        toast.error(
          "Estamos realizando o levantamento financeiro dos seus pagamentos. Sua agenda será liberada em até 72 horas."
        );
      } else if (statusRevisao === "recusada") {
        toast.error("Encontramos uma divergência no levantamento financeiro. Fale com a nossa equipe.");
      } else {
        const necessario = percentualNecessario(quantidadeParcelas);
        toast.error(
          `Você está em ${porcentagemPagamento}% de pagamento. São necessários ${necessario}% para liberar sua agenda — continue enviando seus comprovantes na aba "Meus Boletos".`
        );
      }
      return;
    }
    setConfirmando(true);
    try {
      const res = await fetch("/api/cliente/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataId }),
      });
      const resultado = await res.json();
      if (!res.ok) {
        toast.error(resultado.erro ?? "Não foi possível confirmar essa data.");
        return;
      }
      setCelebrando(resultado.data);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setConfirmando(false);
    }
  }

  async function sair() {
    await fetch("/api/cliente/logout", { method: "POST" });
    router.push("/login");
  }

  const horasRestantes = (() => {
    if (!dataAtingiuPercentual) return null;
    const horasDecorridas = Math.floor((Date.now() - new Date(dataAtingiuPercentual).getTime()) / (1000 * 60 * 60));
    return Math.max(0, PRAZO_REVISAO_FINANCEIRA_HORAS - horasDecorridas);
  })();

  if (carregando) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-bloom">
        <LogoMark className="h-10 w-10 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="client-app min-h-[100dvh] bg-bloom px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] sm:px-6 sm:pt-12 sm:pb-12">
      {celebrando && (
        <CelebracaoData
          data={celebrando}
          nome={primeiroNome(nome)}
          onFechar={() => {
            setCelebrando(null);
            carregar();
          }}
        />
      )}

      <div className="mobile-app-frame mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between sm:mb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[20px] border border-white/70 bg-white/85 shadow-card dark:border-white/10 dark:bg-white/[0.055]">
              <LogoMark className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-label text-rose">Bem-vinda,</p>
              <h1 className="font-heading text-xl font-semibold leading-tight text-burgundy sm:text-2xl">
                {primeiroNome(nome)}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <CentralNotificacoes onAbrirAgenda={() => setAba("cirurgia")} refreshSignal={notificacaoTick} />
            <button
              onClick={sair}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs uppercase tracking-label text-clay/40 transition-all duration-200 hover:bg-white/60 hover:text-burgundy dark:hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </header>

        <PwaInstallPrompt />
        <AtivarNotificacoesPush />

        {/* Jornada visual */}
        <div className="mb-6">
          <JourneyTracker
            percentualPagamento={porcentagemPagamento ?? 0}
            percentualAtingido={podeAgendar}
            statusRevisao={statusRevisao}
            agendada={Boolean(agendamentoAtivo)}
          />
        </div>

        {/* Abas em formato pílula */}
        <div className="mx-auto mb-6 flex w-full max-w-md gap-1 rounded-full bg-blush/70 p-1.5 dark:bg-white/[0.06]">
          <button
            onClick={() => setAba("cirurgia")}
            className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-label transition-all duration-200 ${
              aba === "cirurgia"
                ? "bg-burgundy text-cream shadow-card"
                : "text-burgundy/60 hover:text-burgundy dark:text-pearl/55 dark:hover:text-pearl"
            }`}
          >
            Minha Agenda
          </button>
          <button
            onClick={() => setAba("boletos")}
            className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-label transition-all duration-200 ${
              aba === "boletos"
                ? "bg-burgundy text-cream shadow-card"
                : "text-burgundy/60 hover:text-burgundy dark:text-pearl/55 dark:hover:text-pearl"
            }`}
          >
            Meus Boletos
          </button>
        </div>

        {aba === "boletos" && (
          <TabBoletos pagamento={config?.pagamento} procedimento={procedimento} />
        )}

        {aba === "cirurgia" &&
          (agendamentoAtivo ? (
            <div className="flex flex-col gap-5 animate-fadeUp">
              <CardPrevisaoLiberacao
                previsaoLiberacaoFinanceira={agendamentoAtivo.previsaoLiberacaoFinanceira}
                dataAssinatura={agendamentoAtivo.data}
                destacar={destacarCardLiberacao}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {statusRevisao === "pendente" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 to-blush/40 p-5 sm:p-6"
                >
                  <Clock className="mt-0.5 h-5 w-5 flex-none text-burgundy" />
                  <div>
                    <p className="text-sm font-semibold text-burgundy">
                      Você atingiu o percentual de pagamento necessário! 🎉
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-clay/65">
                      Agora vamos realizar o levantamento financeiro para
                      confirmar seus pagamentos. Sua agenda será liberada em
                      até {PRAZO_REVISAO_FINANCEIRA_HORAS} horas
                      {horasRestantes !== null ? ` (faltam aproximadamente ${horasRestantes}h)` : ""}.
                    </p>
                  </div>
                </motion.div>
              )}

              {statusRevisao === "recusada" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-3xl border border-alert/25 bg-alert/5 p-5 sm:p-6"
                >
                  <ShieldAlert className="mt-0.5 h-5 w-5 flex-none text-alert" />
                  <div>
                    <p className="text-sm font-semibold text-alert">
                      Encontramos uma divergência no levantamento financeiro
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-clay/65">
                      Fale com a nossa equipe para regularizar seus pagamentos
                      e liberar sua agenda.
                    </p>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <RegrasLiberacao quantidadeParcelas={quantidadeParcelas} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="p-4 sm:p-6">
                  {datas.length === 0 ? (
                    <p className="p-6 text-center text-sm text-clay/50">
                      Ainda não há datas disponíveis no momento. Fale com a
                      nossa equipe para saber mais.
                    </p>
                  ) : (
                    <CalendarioAgendamento
                      datas={datas}
                      onConfirmar={escolherData}
                      confirmando={confirmando}
                      bloqueado={!agendaLiberada}
                    />
                  )}
                </Card>
              </motion.div>
            </div>
          ))}
      </div>

      <WhatsAppFab
        numero={config?.contato.whatsapp ?? null}
        mensagem={`Olá! Sou ${primeiroNome(nome)} e preciso de ajuda com minha agenda.`}
      />
    </main>
  );
}
