"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registra o Service Worker somente na área /agenda da cliente. */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    // O PWA é exclusivo da experiência da cliente. Admin e demais páginas
    // continuam sendo web normal, mesmo quando acessadas no celular.
    if (!pathname?.startsWith("/agenda")) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/simulador-iphone-sw.js", { scope: "/agenda" })
      .catch(() => {});
  }, [pathname]);

  return null;
}
