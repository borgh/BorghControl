import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingDown, TrendingUp, AlertCircle, DollarSign, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function StatCard({ title, value, icon: Icon, color, sub, trend }: any) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {fmt(Math.abs(trend))} saldo do mês
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VencimentoLista({ items, tipo }: { items: any[]; tipo: "despesa" | "receita" }) {
  const isDespesa = tipo === "despesa";
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        Nenhum vencimento nos próximos 7 dias
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((v: any) => (
        <div
          key={v.id}
          className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: v.categoriaCor ?? (isDespesa ? "#ef4444" : "#10b981") }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{v.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {v.categoriaNome ?? "Sem categoria"} · Dia {v.diaVencimento}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm font-semibold ${isDespesa ? "text-red-600" : "text-emerald-600"}`}>
              {fmt(Number(v.valor))}
            </span>
            <Badge variant="outline" className="text-xs badge-pendente">Pendente</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.relatorios.dashboard.useQuery();
  const hoje = new Date();
  const mesAtual = MESES[hoje.getMonth()];

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );

  const rm = stats?.resumoMensal;
  const anuais = (stats?.anuais ?? []).map((m: any) => ({ ...m, nome: MESES[m.mes - 1] }));
  const categorias = stats?.despesasPorCategoria ?? [];
  const vencimentosDespesas = stats?.proximosVencimentosDespesas ?? [];
  const vencimentosReceitas = stats?.proximosVencimentosReceitas ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{mesAtual} {hoje.getFullYear()} — Visão geral financeira</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receitas do Mês" value={fmt(rm?.totalReceitas ?? 0)} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title="Despesas do Mês" value={fmt(rm?.totalDespesas ?? 0)} icon={TrendingDown} color="bg-red-500" />
        <StatCard title="Saldo do Mês" value={fmt(rm?.saldo ?? 0)} icon={DollarSign} color={(rm?.saldo ?? 0) >= 0 ? "bg-primary" : "bg-orange-500"} trend={rm?.saldo} />
        <StatCard title="Pendentes" value={fmt(rm?.totalPendente ?? 0)} icon={AlertCircle} color="bg-amber-500" sub={`${stats?.contadores?.pendentes ?? 0} lançamentos`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anual */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Receitas × Despesas — {hoje.getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={anuais} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Categorias */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categorias.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categorias} dataKey="total" nameKey="categoriaNome" cx="50%" cy="50%" outerRadius={75} label={false}>
                    {categorias.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos vencimentos — separados por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-red-500" />
              Despesas Vencendo (7 dias)
              {vencimentosDespesas.length > 0 && (
                <Badge className="ml-1 bg-red-100 text-red-700 border-red-200 text-xs font-semibold">
                  {vencimentosDespesas.length}
                </Badge>
              )}
            </CardTitle>
            <Link href="/despesas">
              <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <VencimentoLista items={vencimentosDespesas} tipo="despesa" />
          </CardContent>
        </Card>

        {/* Receitas */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Receitas Vencendo (7 dias)
              {vencimentosReceitas.length > 0 && (
                <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold">
                  {vencimentosReceitas.length}
                </Badge>
              )}
            </CardTitle>
            <Link href="/receitas">
              <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <VencimentoLista items={vencimentosReceitas} tipo="receita" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
