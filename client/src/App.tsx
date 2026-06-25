import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Despesas from "./pages/Despesas";
import Receitas from "./pages/Receitas";
import Categorias from "./pages/Categorias";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Projetos from "./pages/Projetos";
import Socios from "./pages/Socios";
import DashboardProjetos from "./pages/DashboardProjetos";
import RelatoriosProjetos from "./pages/RelatoriosProjetos";
import BorghLayout from "./components/BorghLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading, error } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  // Só redireciona para login se não há sessão E não houve erro de rede/servidor
  // Erros de rede (fetch failed, 502, etc.) não devem deslogar o usuário
  if (!isAuthenticated && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Reconectando...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) { window.location.href = "/login"; return null; }
  return <BorghLayout><Component /></BorghLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/despesas" component={() => <ProtectedRoute component={Despesas} />} />
      <Route path="/receitas" component={() => <ProtectedRoute component={Receitas} />} />
      <Route path="/categorias" component={() => <ProtectedRoute component={Categorias} />} />
      <Route path="/relatorios" component={() => <ProtectedRoute component={Relatorios} />} />
      <Route path="/configuracoes" component={() => <ProtectedRoute component={Configuracoes} />} />
      <Route path="/projetos" component={() => <ProtectedRoute component={Projetos} />} />
      <Route path="/projetos/socios" component={() => <ProtectedRoute component={Socios} />} />
      <Route path="/projetos/dashboard" component={() => <ProtectedRoute component={DashboardProjetos} />} />
      <Route path="/projetos/relatorios" component={() => <ProtectedRoute component={RelatoriosProjetos} />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
