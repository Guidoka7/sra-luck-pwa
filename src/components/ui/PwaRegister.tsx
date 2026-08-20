"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registra o Service Worker apenas na experiência da cliente/PWA. */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/simulador-iphone-sw.js", { scope: "/" })
      .catch(() => {});
  }, [pathname]);

  return null;
}
