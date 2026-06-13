import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, TrendingDown, TrendingUp, DollarSign } from "lucide-react";

const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_ABREV = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

export default function Relatorios() {
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));

  const { data: anosData } = trpc.relatorios.anosDisponiveis.useQuery();
  const anos = useMemo(() => {
    const set = new Set([...(anosData ?? []), hoje.getFullYear()]);
    return Array.from(set).sort((a, b) => b - a);
  }, [anosData]);

  const { data: resumo, isLoading: loadResumo } = trpc.relatorios.resumoMensal.useQuery({ mes: Number(mes), ano: Number(ano) });
  const { data: anuaisRaw, isLoading: loadAnual } = trpc.relatorios.resumoAnual.useQuery({ ano: Number(ano) });
  const { data: catData, isLoading: loadCat } = trpc.relatorios.despesasPorCategoria.useQuery({ mes: Number(mes), ano: Number(ano) });

  const anuais = (anuaisRaw ?? []).map((m: any) => ({ ...m, nome: MESES_ABREV[m.mes] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold">Relatórios</h1>
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.slice(1).map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a: number) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo mensal */}
      {loadResumo ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Receitas", value: resumo?.totalReceitas ?? 0, icon: TrendingUp, color: "bg-emerald-100 text-emerald-600", val: "text-emerald-700" },
            { label: "Despesas", value: resumo?.totalDespesas ?? 0, icon: TrendingDown, color: "bg-red-100 text-red-600", val: "text-red-700" },
            { label: "Saldo", value: resumo?.saldo ?? 0, icon: DollarSign, color: "bg-primary/10 text-primary", val: (resumo?.saldo ?? 0) >= 0 ? "text-primary" : "text-red-700" },
            { label: "Pendente", value: resumo?.totalPendente ?? 0, icon: BarChart3, color: "bg-amber-100 text-amber-600", val: "text-amber-700" },
          ].map(({ label, value, icon: Icon, color, val }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className={`text-base font-bold ${val}`}>{fmt(value)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gráfico anual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolução Anual — {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadAnual ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={anuais} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Saldo mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Saldo Mensal — {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadAnual ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={anuais} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Despesas por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Despesas por Categoria — {MESES[Number(mes)]}/{ano}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadCat ? <Skeleton className="h-52" /> : (catData ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">Sem dados para o período</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} dataKey="total" nameKey="categoriaNome" cx="50%" cy="50%" outerRadius={80}>
                    {(catData ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ranking de Despesas — {MESES[Number(mes)]}/{ano}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadCat ? <Skeleton className="h-52" /> : (catData ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">Sem dados para o período</p>
            ) : (
              <div className="space-y-3">
                {(catData ?? []).slice(0, 8).map((c: any, i: number) => {
                  const maxVal = Math.max(...(catData ?? []).map((x: any) => Number(x.total)));
                  const pct = maxVal > 0 ? (Number(c.total) / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium truncate">{c.categoriaNome ?? "Sem categoria"}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{fmt(Number(c.total))}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
