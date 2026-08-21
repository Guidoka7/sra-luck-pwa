"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registra o Service Worker somente na área /agenda da cliente. */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname?.startsWith("/agenda")) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/simulador-iphone-sw.js", { scope: "/agenda", updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  }, [pathname]);

  return null;
}
