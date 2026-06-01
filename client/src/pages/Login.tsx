import { ParkingSquare, Shield, BarChart3, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, loading, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-8 py-10 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ParkingSquare className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">VagaWin</h1>
            <p className="text-blue-200 text-sm mt-1">Sistema de Sorteio de Vagas de Garagem</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <p className="text-center text-muted-foreground text-sm mb-6">
              Faça login para acessar o sistema de gerenciamento e sorteio de vagas do seu condomínio.
            </p>

            <Button
              className="w-full h-11 text-sm font-semibold"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              Entrar com Manus
            </Button>

            {/* Features */}
            <div className="mt-8 space-y-3">
              {[
                { icon: ParkingSquare, text: "Cadastro de vagas e apartamentos" },
                { icon: Shield, text: "Sorteio criptograficamente seguro" },
                { icon: BarChart3, text: "Dashboard com estatísticas" },
                { icon: History, text: "Histórico completo auditável" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} VagaWin · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
