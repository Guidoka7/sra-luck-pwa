"use client";

import { useEffect } from "react";

function deviceType() {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function displayMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    ? "standalone" : "browser";
}

function deviceKey() {
  const key = "sra-luck-device-key";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem(key, value);
  }
  return value;
}

export function AppTelemetry() {
  useEffect(() => {
    let cancelado = false;
    const enviar = async () => {
      try {
        const standalone = displayMode() === "standalone";
        let pushActive = false;
        if ("serviceWorker" in navigator && "PushManager" in window && Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration("/agenda");
          pushActive = Boolean(await reg?.pushManager.getSubscription());
        }
        if (cancelado) return;
        await fetch("/api/cliente/app-telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceKey: deviceKey(),
            deviceType: deviceType(),
            displayMode: displayMode(),
            isPwaInstalled: standalone,
            notificationPermission: "Notification" in window ? Notification.permission : "default",
            pushActive,
          }),
          keepalive: true,
        });
      } catch {}
    };

    enviar();
    const interval = window.setInterval(enviar, 5 * 60 * 1000);
    window.addEventListener("resize", enviar, { passive: true });
    return () => {
      cancelado = true;
      window.clearInterval(interval);
      window.removeEventListener("resize", enviar);
    };
  }, []);

  return null;
}
