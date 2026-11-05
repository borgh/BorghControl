import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeartPulse, AlertTriangle } from "lucide-react";

/** Score de saúde financeira (0–100) com os 3 fatores da regra 50-30-20 e penalidade por atraso */
export default function ScoreSaudeCard({ mes, ano }: { mes: number; ano: number }) {
  const { data, isLoading } = trpc.relatorios.scoreSaude.useQuery({ mes, ano });
  const { data: meta } = trpc.relatorios.metaFinanceira.useQuery({ mes, ano });

  if (isLoading && !data) return <Skeleton className="h-72" />;
  if (!data || meta?.modo === "livre") return null;

  const cor = data.score >= 75 ? "#10b981" : data.score >= 50 ? "#f59e0b" : "#ef4444";
  const corTexto = data.score >= 75 ? "text-emerald-700" : data.score >= 50 ? "text-amber-700" : "text-red-600";
  const r = 44, c = 2 * Math.PI * r, off = c * (1 - data.score / 100);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Score de Saúde Financeira</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 600ms ease-out" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold tabular-nums leading-none ${corTexto}`}>{data.score}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-base font-bold ${corTexto}`}>{data.rotulo}</p>
            <p className="text-[11px] text-muted-foreground mb-2">Baseado em 3 fatores{data.penalidade.pontos > 0 ? " e contas em atraso" : ""}</p>
            <ul className="space-y-1.5">
              {data.fatores.map((f) => (
                <li key={f.chave} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="leading-tight">{f.label}</span>
                    <span className="tabular-nums font-medium shrink-0">{f.pontos}/{f.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(f.pontos / f.max) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{f.detalhe}</p>
                </li>
              ))}
              {data.penalidade.pontos > 0 && (
                <li className="text-xs flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {data.penalidade.emAtraso} conta(s) em atraso: −{data.penalidade.pontos} pontos
                </li>
              )}
            </ul>
          </div>
        </div>
        {data.semRenda && <p className="mt-3 text-[11px] text-muted-foreground">Sem receitas no período — o score depende da renda para calcular as metas.</p>}
      </CardContent>
    </Card>
  );
}
