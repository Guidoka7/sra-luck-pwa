import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { PwaRegister } from "@/components/ui/PwaRegister";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const heading = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
});

const script = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic"],
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: "Sra. Luck — Cirurgia Programada",
  description: "Agenda exclusiva de crédito programado.",
  // Meta tags "apple-mobile-web-app-*" já deixadas prontas aqui: elas não
  // fazem nada enquanto o site é acessado pelo Safari normal, mas são o
  // que faz o app rodar em tela cheia (sem barra de endereço) assim que
  // você adicionar o manifest.json e transformar isso numa PWA de verdade.
  manifest: "/simulador-iphone.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sra. Luck",
  },
};

// Sem isso, o navegador do celular renderiza a página em largura de
// desktop (~980px) e depois encolhe tudo pra caber na tela — é por isso
// que elementos ficam cortados e o scroll parece travado no mobile.
//
// "viewportFit: cover" é o que permite o conteúdo ocupar a tela toda
// (inclusive atrás do notch/Dynamic Island e da barra de home indicator)
// em vez de deixar faixas pretas nas bordas — é assim que um app de
// verdade se comporta, e é obrigatório para quando isso virar PWA.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#7A2632",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${sans.variable} ${script.variable} ${heading.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light"}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-cream text-clay font-sans antialiased selection:bg-burgundy selection:text-pearl">
        <ThemeProvider>
          <PwaRegister />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
