import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import VagaWinLayout from "./components/VagaWinLayout";
import Dashboard from "./pages/Dashboard";
import Vagas from "./pages/Vagas";
import Apartamentos from "./pages/Apartamentos";
import Sorteio from "./pages/Sorteio";
import Resultado from "./pages/Resultado";
import Historico from "./pages/Historico";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <VagaWinLayout><Dashboard /></VagaWinLayout>} />
      <Route path="/vagas" component={() => <VagaWinLayout><Vagas /></VagaWinLayout>} />
      <Route path="/apartamentos" component={() => <VagaWinLayout><Apartamentos /></VagaWinLayout>} />
      <Route path="/sorteio" component={() => <VagaWinLayout><Sorteio /></VagaWinLayout>} />
      <Route path="/resultado/:id" component={({ params }) => <VagaWinLayout><Resultado id={Number(params.id)} /></VagaWinLayout>} />
      <Route path="/historico" component={() => <VagaWinLayout><Historico /></VagaWinLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
