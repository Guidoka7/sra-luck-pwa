"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function registrarInstalacao() {
  try {
    const deviceKey = localStorage.getItem("sra-luck-device-key");
    if (!deviceKey) return;
    void fetch("/api/cliente/app-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceKey,
        deviceType: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop",
        displayMode: "standalone",
        isPwaInstalled: true,
        notificationPermission: "Notification" in window ? Notification.permission : "default",
        pushActive: false,
      }),
      keepalive: true,
    });
  } catch {}
}

export function PwaInstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const iosDevice = isIOS();
    setIos(iosDevice);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setEvento(event as BeforeInstallPromptEvent);
      setVisivel(true);
    };

    const onInstalled = () => {
      setEvento(null);
      setVisivel(false);
      registrarInstalacao();
      toast.success("Aplicativo instalado. Agora ele abre como um app.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (iosDevice) {
      const dispensado = sessionStorage.getItem("sra-luck-pwa-install-dismissed");
      if (!dispensado) setVisivel(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function instalar() {
    if (ios) {
      toast.info("No iPhone, toque em Compartilhar e depois em 'Adicionar à Tela de Início'.");
      return;
    }
    if (!evento) return;

    setInstalando(true);
    try {
      await evento.prompt();
      const escolha = await evento.userChoice;
      if (escolha.outcome === "accepted") {
        setVisivel(false);
      }
      setEvento(null);
    } catch {
      toast.error("O navegador não conseguiu abrir a instalação agora. Tente novamente.");
    } finally {
      setInstalando(false);
    }
  }

  function dispensar() {
    sessionStorage.setItem("sra-luck-pwa-install-dismissed", "1");
    setVisivel(false);
  }

  if (!visivel || isStandalone()) return null;

  return (
    <div className="mb-4 rounded-2xl border border-burgundy/10 bg-white/90 p-4 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.055]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blush text-burgundy dark:bg-white/10 dark:text-[#F4D9DC]"><Smartphone className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-burgundy dark:text-pearl">Instale o aplicativo Sra. Luck</p>
          <p className="mt-0.5 text-xs leading-relaxed text-clay/60 dark:text-pearl/55">{ios ? "No iPhone, use Compartilhar → Adicionar à Tela de Início para abrir como aplicativo." : "Instale no celular para abrir em tela cheia, como um aplicativo normal."}</p>
          <button type="button" onClick={instalar} disabled={instalando || (!ios && !evento)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-burgundy px-3.5 py-2 text-xs font-semibold text-pearl disabled:opacity-60">
            {instalando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {ios ? "Como instalar no iPhone" : instalando ? "Abrindo instalação..." : "Instalar aplicativo"}
          </button>
        </div>
        <button type="button" aria-label="Dispensar instalação" onClick={dispensar} className="flex h-8 w-8 items-center justify-center rounded-full text-clay/40 hover:bg-blush dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
