import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity, AlertTriangle } from "lucide-react";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(Math.round(v)));
const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Fluxo de caixa diário do mês: saldo acumulado Realizado (pago/recebido) × Projetado (inclui pendentes) */
export default function FluxoCaixaCard({ mes, ano }: { mes: number; ano: number }) {
  const mesEfetivo = mes === 0 ? new Date().getMonth() + 1 : mes;
  const { data, isLoading } = trpc.relatorios.fluxoCaixa.useQuery({ mes: mesEfetivo, ano });
  const [modo, setModo] = useState<"realizado" | "projetado">("projetado");

  if (isLoading && !data) return <Skeleton className="h-72" />;
  if (!data || data.dias.length === 0) return null;

  const ultimo = data.dias[data.dias.length - 1];
  const hoje = new Date();
  const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mesEfetivo;
  const diaHoje = ehMesAtual ? hoje.getDate() : null;
  const saldoFinal = modo === "realizado" ? ultimo.realizado : ultimo.projetado;
  const corLinha = saldoFinal >= 0 ? "#10b981" : "#ef4444";
  const minimo = Math.min(...data.dias.map((d) => d.projetado));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">Fluxo de Caixa — {MESES[mesEfetivo]}/{ano}</CardTitle>
            <span className={`text-sm font-bold tabular-nums ${saldoFinal >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(saldoFinal)}</span>
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["realizado", "projetado"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)} className={`px-3 py-1.5 transition-colors ${modo === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m === "realizado" ? "Realizado" : "Projetado"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {modo === "realizado" ? "Só o que já foi pago ou recebido, no dia em que aconteceu." : "Inclui o que ainda está pendente, pela data de vencimento."}
          {modo === "projetado" && data.primeiroDiaNegativo && (
            <span className="ml-1 inline-flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="h-3 w-3" /> saldo fica negativo a partir do dia {data.primeiroDiaNegativo} (mínimo {fmt(minimo)})</span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.dias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fluxoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={corLinha} stopOpacity={0.35} />
                <stop offset="95%" stopColor={corLinha} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} width={44} />
            <Tooltip
              formatter={(v: any, name: any) => [fmt(Number(v)), name === "realizado" ? "Realizado" : "Projetado"]}
              labelFormatter={(d) => `Dia ${d}`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            {diaHoje && <ReferenceLine x={diaHoje} stroke="#6366f1" strokeDasharray="3 3" label={{ value: "hoje", fontSize: 10, fill: "#6366f1", position: "top" }} />}
            <Area type="monotone" dataKey={modo} stroke={corLinha} strokeWidth={2} fill="url(#fluxoFill)" isAnimationActive={false} />
            {modo === "projetado" && <Area type="monotone" dataKey="realizado" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" fill="none" isAnimationActive={false} />}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
