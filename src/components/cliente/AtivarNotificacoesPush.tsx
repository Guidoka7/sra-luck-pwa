"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function AtivarNotificacoesPush() {
  const [visivel, setVisivel] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let cancelado = false;
    async function sincronizarAssinaturaPendente() {
      try {
        const raw = localStorage.getItem("sra-luck-pending-push-subscription");
        if (!raw) return false;
        const subscription = JSON.parse(raw);
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return false;
        const response = await fetch("/api/cliente/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription }),
        });
        if (response.ok) {
          localStorage.removeItem("sra-luck-pending-push-subscription");
          if (!cancelado) setAtivo(true);
          return true;
        }
      } catch {}
      return false;
    }

    async function verificarAssinatura() {
      if (await sincronizarAssinaturaPendente()) return;
      if (Notification.permission === "granted") {
        try {
          const reg = await navigator.serviceWorker.ready;
          const subscription = await reg.pushManager.getSubscription();
          if (subscription) {
            if (!cancelado) setAtivo(true);
            return;
          }
        } catch {
          // Se o navegador ainda não tiver uma assinatura, mostra o botão para registrar.
        }
      }
      if (!cancelado && Notification.permission !== "denied") {
        const dispensado = sessionStorage.getItem("sra-luck-push-prompt-dismissed");
        if (!dispensado) setVisivel(true);
      }
    }
    verificarAssinatura();
    return () => { cancelado = true; };
  }, []);

  async function ativar() {
    if (!window.isSecureContext) {
      toast.error("Para receber notificações do sistema, abra o app em HTTPS ou como PWA instalado.");
      return;
    }
    setAtivando(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("As notificações foram bloqueadas. Você pode permitir novamente nas configurações do navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/cliente/push/vapid", { cache: "no-store" });
      if (!keyRes.ok) throw new Error("Servidor de notificações não configurado.");
      const { publicKey } = await keyRes.json();
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const saveRes = await fetch("/api/cliente/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saveRes.ok) throw new Error("Não foi possível registrar este celular.");
      setAtivo(true);
      setVisivel(false);
      toast.success("🔔 Notificações ativadas neste celular.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível ativar as notificações.");
    } finally {
      setAtivando(false);
    }
  }

  if (ativo || !visivel) return null;

  return (
    <div className="mb-4 rounded-2xl border border-burgundy/10 bg-white/85 p-4 shadow-card dark:border-white/10 dark:bg-white/[0.055]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blush text-burgundy dark:bg-white/10 dark:text-[#F4D9DC]"><Bell className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-burgundy dark:text-pearl">Receba avisos no celular</p>
          <p className="mt-0.5 text-xs leading-relaxed text-clay/60 dark:text-pearl/55">Ative as notificações para receber mensagens da Sra. Luck mesmo com o app fechado.</p>
          <button type="button" onClick={ativar} disabled={ativando} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-burgundy px-3.5 py-2 text-xs font-semibold text-pearl disabled:opacity-60">
            {ativando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {ativando ? "Ativando..." : "Permitir notificações"}
          </button>
        </div>
        <button type="button" aria-label="Dispensar" onClick={() => { sessionStorage.setItem("sra-luck-push-prompt-dismissed", "1"); setVisivel(false); }} className="flex h-8 w-8 items-center justify-center rounded-full text-clay/40 hover:bg-blush dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
