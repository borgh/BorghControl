import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);

  useEffect(() => {
    // Detectar iOS (Safari não suporta beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("pwa-install-dismissed");

    if (ios && !standalone && !dismissed) {
      setIsIOS(true);
      // Mostrar dica iOS após 3 segundos
      const t = setTimeout(() => setIosVisible(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome: capturar evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        // Mostrar banner após 2 segundos
        setTimeout(() => setVisible(true), 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    setIosVisible(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem("pwa-install-dismissed", "1");
    }
    setDeferredPrompt(null);
    setVisible(false);
  }

  // Banner Android/Chrome
  if (visible && deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex items-start gap-3">
          <img src="/icons/icon-72x72.png" alt="BorghControl" className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Instalar BorghControl</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione à tela inicial para acesso rápido, mesmo sem internet.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={install} className="gap-1.5 h-8 text-xs">
                <Download className="h-3.5 w-3.5" />
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 text-xs text-muted-foreground">
                Agora não
              </Button>
            </div>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Dica iOS
  if (isIOS && iosVisible) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-72x72.png" alt="BorghControl" className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Instalar BorghControl</p>
              <p className="text-xs text-muted-foreground mt-1">
                Toque em <strong>Compartilhar</strong> <span className="text-base">⬆️</span> e depois em{" "}
                <strong>"Adicionar à Tela de Início"</strong> para instalar o app.
              </p>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
