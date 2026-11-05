import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, ShoppingBag, TrendingUp, AlertTriangle, CheckCircle2, Settings, Target } from "lucide-react";
import { GRUPO_LABEL, type GrupoOrcamento } from "@shared/orcamento";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const GRUPO_UI: Record<GrupoOrcamento, { icon: any; desc: string; cor: string; corBarra: string; corTexto: string }> = {
  essencial: { icon: Home, desc: "Moradia, mercado, saúde, transporte", cor: "bg-blue-100 text-blue-700", corBarra: "bg-blue-500", corTexto: "text-blue-700" },
  lazer: { icon: ShoppingBag, desc: "Restaurantes, lazer, compras extras", cor: "bg-orange-100 text-orange-700", corBarra: "bg-orange-500", corTexto: "text-orange-700" },
  investimento: { icon: TrendingUp, desc: "Sobra para guardar e investir", cor: "bg-emerald-100 text-emerald-700", corBarra: "bg-emerald-500", corTexto: "text-emerald-700" },
};

/**
 * Card "Meta Financeira" (regra 50-30-20): real × meta de cada grupo, com alertas.
 * Some sozinho quando o orçamento está em "Gerenciar livremente".
 */
export default function MetaFinanceiraCard({ mes, ano }: { mes: number; ano: number }) {
  const { data, isLoading } = trpc.relatorios.metaFinanceira.useQuery({ mes, ano });
  const [modo, setModo] = useState<"real" | "meta">("real");

  if (isLoading && !data) return <Skeleton className="h-64" />;
  if (!data || data.modo === "livre") return null;

  const periodo = mes === 0 ? `${ano}` : `${MESES[mes]}/${ano}`;
  const ordem: GrupoOrcamento[] = ["essencial", "lazer", "investimento"];

  return (
    <Card className="border-2">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meta Financeira · Regra {data.pct.essencial}-{data.pct.lazer}-{data.pct.poupanca}</p>
            <p className="text-sm text-muted-foreground">
              Renda de {periodo}: <strong className="text-foreground">{fmt(data.renda)}</strong>
              {data.renda > 0 && <> · gasto {fmt(data.totalGasto)} ({Math.round((data.totalGasto / data.renda) * 100)}% da renda)</>}
            </p>
          </div>
          <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
            {(["real", "meta"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)} className={`px-3 py-1.5 transition-colors ${modo === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                {m === "real" ? "Real" : "Meta"}
              </button>
            ))}
          </div>
        </div>

        {data.renda <= 0 && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
            Nenhuma receita em {periodo} — as metas são calculadas sobre a renda do período (recebida + prevista).
          </p>
        )}

        {/* Alertas */}
        {data.alertas.filter((a) => a.nivel !== "abaixo").length > 0 && (
          <div className="space-y-1.5">
            {data.alertas.filter((a) => a.nivel !== "abaixo").map((a) => (
              <div key={a.grupo} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${a.nivel === "estourou" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {a.nivel === "estourou"
                  ? <>{GRUPO_LABEL[a.grupo]} passou da meta: <strong>{Math.round(a.pctMeta)}%</strong> do limite. É aqui que você precisa mexer primeiro.</>
                  : <>Atenção: você já usou <strong>{Math.round(a.pctMeta)}%</strong> da meta de {GRUPO_LABEL[a.grupo]} em {periodo}.</>}
              </div>
            ))}
          </div>
        )}

        {/* Barras por grupo */}
        <div className="space-y-3">
          {ordem.map((g) => {
            const info = data.grupos[g];
            const ui = GRUPO_UI[g];
            const Icon = ui.icon;
            const isInv = g === "investimento";
            const pctBarra = info.meta > 0 ? Math.min(100, (info.real / info.meta) * 100) : 0;
            const estourou = !isInv && info.meta > 0 && info.pctMeta > 100;
            const abaixo = isInv && info.meta > 0 && info.pctMeta < 100;
            const valorPrincipal = modo === "real" ? info.real : info.meta;
            const diff = info.meta > 0 ? Math.round(info.pctMeta - 100) : 0;
            return (
              <div key={g} className="rounded-xl border p-3">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${ui.cor}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{GRUPO_LABEL[g]}</p>
                      <p className={`text-sm font-bold tabular-nums ${estourou ? "text-red-600" : ui.corTexto}`}>{fmt(valorPrincipal)}</p>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground truncate">{ui.desc}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {modo === "real" ? `meta: ${fmt(info.meta)} (${isInv ? data.pct.poupanca : g === "essencial" ? data.pct.essencial : data.pct.lazer}%)` : `real: ${fmt(info.real)}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${estourou ? "bg-red-500" : ui.corBarra}`} style={{ width: `${pctBarra}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{info.pctRenda}% da renda</span>
                  {info.meta > 0 && (
                    estourou
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium"><AlertTriangle className="h-3 w-3" /> +{diff}% acima</span>
                      : abaixo
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">faltam {fmt(info.meta - info.real)} para a meta</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium"><CheckCircle2 className="h-3 w-3" /> dentro da meta{!isInv && diff < 0 ? ` · ${Math.abs(diff)}% de folga` : ""}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo em % */}
        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
          {ordem.map((g) => (
            <div key={g}>
              <p className={`text-lg font-bold tabular-nums ${GRUPO_UI[g].corTexto}`}>{Math.round(data.grupos[g].pctRenda)}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{GRUPO_LABEL[g].split(" ")[0]}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Settings className="h-3 w-3" /> Percentuais e grupos das categorias em <Link href="/configuracoes" className="underline">Configurações</Link> e <Link href="/categorias" className="underline">Categorias</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
