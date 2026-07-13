import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingDown, TrendingUp, AlertCircle, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransacaoDetalheModal } from "./TransacaoDetalheModal";
import { TransacaoModal } from "./TransacaoModal";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function StatCard({ title, value, icon: Icon, color, sub, trend, href }: any) {
  const [, navigate] = useLocation();
  const handleClick = () => {
    if (!href) return;
    // navigate do wouter suporta query strings e dispara useSearch corretamente
    navigate(href);
  };
  const inner = (
    <Card
      className={`relative overflow-hidden${href ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={href ? handleClick : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
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
  return inner;
}

function VencimentoLista({
  items,
  tipo,
  atraso = false,
  onItemClick,
}: {
  items: any[];
  tipo: "despesa" | "receita";
  atraso?: boolean;
  onItemClick: (item: any) => void;
}) {
  const isDespesa = tipo === "despesa";
  const defaultColor = isDespesa ? "#ef4444" : "#10b981";

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        {atraso ? "Nenhum lançamento em atraso" : "Nenhum vencimento nos próximos 7 dias"}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((v: any) => (
        <div
          key={v.id}
          onClick={() => onItemClick({ ...v, tipo })}
          className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors cursor-pointer ${
            atraso
              ? "bg-red-50/80 hover:bg-red-100 border border-red-100"
              : "bg-muted/50 hover:bg-muted"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: v.categoriaCor ?? defaultColor }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{v.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {v.categoriaNome ?? "Sem categoria"}
                {atraso
                  ? ` · ${MESES_FULL[v.mes]}/${v.ano} · Dia ${v.diaVencimento}`
                  : ` · Dia ${v.diaVencimento}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm font-semibold ${
              atraso ? "text-red-700" : isDespesa ? "text-red-600" : "text-emerald-600"
            }`}>
              {fmt(Number(v.valor))}
            </span>
            {atraso ? (
              <Badge className="text-xs bg-red-100 text-red-700 border border-red-300 hover:bg-red-100">
                Atrasado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Pendente</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

export default function Dashboard() {
  const hoje = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(() => hoje.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(() => hoje.getFullYear());

  const { data: stats, isLoading, refetch } = trpc.relatorios.dashboard.useQuery({ mes: mesFiltro, ano: anoFiltro });
  const utils = trpc.useUtils();

  const [detalheItem, setDetalheItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);

  const handleRefresh = () => {
    utils.transacoes.list.invalidate();
    utils.relatorios.dashboard.invalidate();
    refetch();
  };

  if (isLoading) return (
    <div className="space-y-4 sm:space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );

  const rm = stats?.resumoMensal;
  const anuais = (stats?.anuais ?? []).map((m: any) => ({ ...m, nome: MESES[m.mes - 1] }));
  const categorias = (stats?.despesasPorCategoria ?? []).map((c: any) => ({
    ...c,
    total: Number(c.total),
    categoriaNome: c.categoriaNome ?? "Sem categoria",
  })).filter((c: any) => c.total > 0);
  const vencimentosDespesas = stats?.proximosVencimentosDespesas ?? [];
  const vencimentosReceitas = stats?.proximosVencimentosReceitas ?? [];
  const atrasoDespesas = stats?.atrasoDespesas ?? [];
  const atrasoReceitas = stats?.atrasoReceitas ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {mesFiltro === 0 ? `Ano ${anoFiltro} — Todos os meses` : `${MESES_FULL[mesFiltro]} ${anoFiltro} — Visão geral financeira`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mesFiltro)} onValueChange={(v) => setMesFiltro(Number(v))}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos os meses</SelectItem>
              {MESES_FULL.slice(1).map((nome, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anoFiltro)} onValueChange={(v) => setAnoFiltro(Number(v))}>
            <SelectTrigger className="w-[90px] h-8 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 2 + i).map((ano) => (
                <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards */}
      {(() => {
        const totalAtraso = rm?.totalAtraso ?? 0;
        const totalPendenteReal = (rm?.totalPendente ?? 0) - totalAtraso;
        const totalPendenteReceitas = (rm as any)?.totalPendenteReceitas ?? 0;
        const saldoPendente = totalPendenteReceitas - totalPendenteReal;
        const hasAtraso = totalAtraso > 0;
        // Usa dados do backend para despesas que vencem em até 3 dias
        const venceEmBreve = stats?.venceEmBreve ?? [];
        const hasVenceEmBreve = venceEmBreve.length > 0;
        const colCount = 5 + (hasAtraso ? 1 : 0) + (hasVenceEmBreve ? 1 : 0);
        const gridClass = `grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-${colCount}`;
        return (
          <>
          <div className={gridClass}>
            <StatCard title={mesFiltro === 0 ? "Receitas do Ano" : "Receitas do Mês"} value={fmt(rm?.totalReceitas ?? 0)} icon={TrendingUp} color="bg-emerald-500" href="/receitas" />
            <StatCard title={mesFiltro === 0 ? "Despesas do Ano" : "Despesas do Mês"} value={fmt(rm?.totalDespesas ?? 0)} icon={TrendingDown} color="bg-red-500" href="/despesas" />
            <StatCard title={mesFiltro === 0 ? "Saldo do Ano" : "Saldo do Mês"} value={fmt(rm?.saldo ?? 0)} icon={DollarSign} color={(rm?.saldo ?? 0) >= 0 ? "bg-primary" : "bg-orange-500"} trend={rm?.saldo} />
            <StatCard title="Pendentes a Pagar" value={fmt(totalPendenteReal)} icon={AlertCircle} color="bg-amber-500" sub={`${stats?.contadores?.pendentes ?? 0} lançamentos`} href="/despesas?status=pendente" />
            <StatCard title="Pendentes a Receber" value={fmt(totalPendenteReceitas)} icon={TrendingUp} color="bg-teal-500" sub={`${(stats?.contadores as any)?.pendentesReceitas ?? 0} lançamentos`} href="/receitas?status=pendente" />
            {hasAtraso && (
              <StatCard title="Em Atraso" value={fmt(totalAtraso)} icon={AlertTriangle} color="bg-red-600" sub="despesas vencidas" href="/despesas?status=em_atraso" />
            )}
            {hasVenceEmBreve && (
              <StatCard title="Vence em Breve" value={String(venceEmBreve.length)} icon={Clock} color="bg-orange-500" sub="próximos 3 dias" href="/despesas?status=vence_em_breve" />
            )}
          </div>

          {/* Card de Saldo Pendente — discrepância entre a receber e a pagar */}
          <Card className={`border-2 transition-colors ${
            saldoPendente > 0 ? "border-emerald-200 bg-emerald-50/40" :
            saldoPendente < 0 ? "border-red-200 bg-red-50/40" :
            "border-border"
          }`}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    saldoPendente > 0 ? "bg-emerald-500" : saldoPendente < 0 ? "bg-red-500" : "bg-muted"
                  }`}>
                    {saldoPendente >= 0
                      ? <ArrowUpRight className="h-5 w-5 text-white" />
                      : <ArrowDownRight className="h-5 w-5 text-white" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo Pendente</p>
                    <p className={`text-xl sm:text-2xl font-bold tabular-nums ${
                      saldoPendente > 0 ? "text-emerald-700" : saldoPendente < 0 ? "text-red-600" : "text-foreground"
                    }`}>
                      {saldoPendente >= 0 ? "+" : ""}{fmt(saldoPendente)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {saldoPendente > 0
                        ? "Você tem mais a receber do que a pagar"
                        : saldoPendente < 0
                        ? "Você tem mais a pagar do que a receber"
                        : "Receber e pagar estão equilibrados"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-10 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">A Receber</p>
                    <p className="font-semibold text-teal-700 tabular-nums">{fmt(totalPendenteReceitas)}</p>
                  </div>
                  <div className="text-muted-foreground text-lg font-light select-none">−</div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">A Pagar</p>
                    <p className="font-semibold text-amber-700 tabular-nums">{fmt(totalPendenteReal)}</p>
                  </div>
                  <div className="text-muted-foreground text-lg font-light select-none">=</div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Saldo</p>
                    <p className={`font-bold tabular-nums ${
                      saldoPendente > 0 ? "text-emerald-700" : saldoPendente < 0 ? "text-red-600" : "text-foreground"
                    }`}>{saldoPendente >= 0 ? "+" : ""}{fmt(saldoPendente)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
        );
      })()}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Receitas × Despesas — {hoje.getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={anuais} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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

      {/* Próximos vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
            <VencimentoLista items={vencimentosDespesas} tipo="despesa" onItemClick={setDetalheItem} />
          </CardContent>
        </Card>

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
            <VencimentoLista items={vencimentosReceitas} tipo="receita" onItemClick={setDetalheItem} />
          </CardContent>
        </Card>
      </div>

      {/* Em atraso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={atrasoDespesas.length > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${atrasoDespesas.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              Despesas em Atraso
              {atrasoDespesas.length > 0 && (
                <Badge className="ml-1 bg-red-600 text-white border-red-600 text-xs font-semibold">
                  {atrasoDespesas.length}
                </Badge>
              )}
            </CardTitle>
            <Link href="/despesas">
              <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <VencimentoLista items={atrasoDespesas} tipo="despesa" atraso onItemClick={setDetalheItem} />
          </CardContent>
        </Card>

        <Card className={atrasoReceitas.length > 0 ? "border-orange-200" : ""}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${atrasoReceitas.length > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              Receitas em Atraso
              {atrasoReceitas.length > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white border-orange-500 text-xs font-semibold">
                  {atrasoReceitas.length}
                </Badge>
              )}
            </CardTitle>
            <Link href="/receitas">
              <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <VencimentoLista items={atrasoReceitas} tipo="receita" atraso onItemClick={setDetalheItem} />
          </CardContent>
        </Card>
      </div>

      {/* Modal de detalhe */}
      <TransacaoDetalheModal
        open={detalheItem !== null}
        item={detalheItem}
        onClose={() => setDetalheItem(null)}
        onEdit={(it) => { setEditItem(it); setEditModal(true); }}
        onRefresh={handleRefresh}
      />

      {/* Modal de edição */}
      <TransacaoModal
        open={editModal}
        onClose={() => { setEditModal(false); setEditItem(null); }}
        tipo={editItem?.tipo ?? "despesa"}
        editItem={editItem}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
