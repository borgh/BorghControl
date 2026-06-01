import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Shuffle, ParkingSquare, Building2, CheckCircle2, AlertCircle, Play, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const MESSAGES = [
  "Verificando participantes...",
  "Embaralhando apartamentos...",
  "Embaralhando vagas disponíveis...",
  "Aplicando algoritmo criptográfico...",
  "Garantindo imparcialidade...",
  "Realizando atribuições aleatórias...",
  "Validando resultado...",
  "Finalizando sorteio...",
];

type SorteioState = "idle" | "animating" | "done" | "error";

export default function Sorteio() {
  const [, setLocation] = useLocation();
  const { data: preview, isLoading: previewLoading, refetch } = trpc.sorteio.previewSorteio.useQuery();
  const [state, setState] = useState<SorteioState>("idle");
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [shuffledApts, setShuffledApts] = useState<string[]>([]);
  const [shuffledVagas, setShuffledVagas] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: aptsData } = trpc.apartamentos.listParticipantes.useQuery();
  const { data: vagasData } = trpc.vagas.listAtivas.useQuery();

  const realizarMutation = trpc.sorteio.realizarSorteio.useMutation({
    onSuccess: (data) => {
      clearIntervals();
      setProgress(100);
      setTimeout(() => {
        setState("done");
        if (data.id) {
          setTimeout(() => setLocation(`/resultado/${data.id}`), 800);
        }
      }, 400);
    },
    onError: (e) => {
      clearIntervals();
      setState("error");
      toast.error(e.message);
    },
  });

  const clearIntervals = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
  };

  useEffect(() => () => clearIntervals(), []);

  const startSorteio = () => {
    if (!preview?.podeRealizar) return;
    setState("animating");
    setProgress(0);
    setMsgIndex(0);

    // Usa dados reais para animação
    const aptLabels = (aptsData ?? []).slice(0, 8).map((a: any) =>
      a.bloco ? `Apto ${a.numero} - Bl. ${a.bloco}` : `Apto ${a.numero}`
    );
    const vagaLabels = (vagasData ?? []).slice(0, 8).map((v: any) => `Vaga ${v.numero}`);
    setShuffledApts(aptLabels.length > 0 ? aptLabels : Array.from({ length: Math.min(preview.totalParticipantes, 8) }, (_, i) => `Apto ${i + 1}`));
    setShuffledVagas(vagaLabels.length > 0 ? vagaLabels : Array.from({ length: Math.min(preview.totalVagas, 8) }, (_, i) => `Vaga ${i + 1}`));

    // Progress animation
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += Math.random() * 3 + 1;
      if (p >= 90) {
        p = 90;
        clearInterval(intervalRef.current!);
      }
      setProgress(Math.min(p, 90));
    }, 120);

    // Message cycling
    let m = 0;
    msgIntervalRef.current = setInterval(() => {
      m = (m + 1) % MESSAGES.length;
      setMsgIndex(m);
      // Shuffle display items
      setShuffledApts((prev) => [...prev].sort(() => Math.random() - 0.5));
      setShuffledVagas((prev) => [...prev].sort(() => Math.random() - 0.5));
    }, 600);

    // Actually perform the draw after 3.5s
    setTimeout(() => {
      realizarMutation.mutate();
    }, 3500);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Sorteio de Vagas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Sorteio 100% aleatório com algoritmo criptograficamente seguro
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Participantes</p>
                <p className="text-2xl font-bold text-foreground">
                  {previewLoading ? "—" : preview?.totalParticipantes ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ParkingSquare className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Vagas Ativas</p>
                <p className="text-2xl font-bold text-foreground">
                  {previewLoading ? "—" : preview?.totalVagas ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Sorteio Card */}
      <Card className="border border-border overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Iniciar Sorteio</CardTitle>
              <p className="text-blue-200 text-xs mt-0.5">Fisher-Yates + Web Crypto API</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Status check */}
          {!previewLoading && (
            <div className="space-y-2">
              {[
                {
                  ok: (preview?.totalParticipantes ?? 0) > 0,
                  label: `${preview?.totalParticipantes ?? 0} apartamento(s) participante(s)`,
                  link: "/apartamentos",
                  linkLabel: "Cadastrar",
                },
                {
                  ok: (preview?.totalVagas ?? 0) > 0,
                  label: `${preview?.totalVagas ?? 0} vaga(s) ativa(s)`,
                  link: "/vagas",
                  linkLabel: "Cadastrar",
                },
              ].map(({ ok, label, link, linkLabel }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm">
                  {ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  {!ok && (
                    <a href={link} className="text-primary text-xs underline underline-offset-2 ml-auto">
                      {linkLabel}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Animation Area */}
          {state === "animating" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium animate-pulse">{MESSAGES[msgIndex]}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Shuffling display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 overflow-hidden h-36">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Apartamentos</p>
                  {shuffledApts.map((a, i) => (
                    <div
                      key={`${a}-${i}`}
                      className="text-xs bg-white rounded-md px-2 py-1 text-foreground font-medium border border-border/60 transition-all duration-300"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {a}
                    </div>
                  ))}
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 overflow-hidden h-36">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vagas</p>
                  {shuffledVagas.map((v, i) => (
                    <div
                      key={`${v}-${i}`}
                      className="text-xs bg-white rounded-md px-2 py-1 text-foreground font-medium border border-border/60 transition-all duration-300"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {state === "done" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              <p className="font-semibold text-foreground">Sorteio concluído!</p>
              <p className="text-sm text-muted-foreground">Redirecionando para o resultado...</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="font-semibold text-foreground">Erro ao realizar sorteio</p>
              <Button variant="outline" size="sm" onClick={() => setState("idle")}>
                Tentar novamente
              </Button>
            </div>
          )}

          {/* CTA Button */}
          {(state === "idle" || state === "error") && (
            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              disabled={!preview?.podeRealizar || previewLoading}
              onClick={startSorteio}
            >
              <Play className="w-5 h-5" />
              Iniciar Sorteio
            </Button>
          )}

          {state === "animating" && (
            <Button className="w-full h-12 text-base font-semibold gap-2" disabled>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sorteando...
            </Button>
          )}

          {!preview?.podeRealizar && state === "idle" && !previewLoading && (
            <p className="text-center text-xs text-muted-foreground">
              Cadastre ao menos 1 apartamento participante e 1 vaga ativa para iniciar o sorteio.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border border-border bg-blue-50/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Sobre o algoritmo:</strong> O sorteio utiliza o algoritmo Fisher-Yates com geração de números aleatórios via{" "}
            <code className="bg-muted px-1 rounded text-xs">Web Crypto API</code>, garantindo imparcialidade criptográfica. Cada apartamento recebe exatamente uma vaga e cada vaga é atribuída a no máximo um apartamento. O resultado é registrado no histórico com data, hora e responsável.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
