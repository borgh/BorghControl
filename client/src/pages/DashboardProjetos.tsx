import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, DollarSign, Users, CheckCircle, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

type StatusProjeto = "em_andamento" | "pendente" | "aguardando_recurso" | "concluido";

const STATUS_LABELS: Record<StatusProjeto, string> = {
  em_andamento: "Em Andamento",
  pendente: "Pendente",
  aguardando_recurso: "Aguardando Recurso",
  concluido: "Concluído",
};

const STATUS_COLORS: Record<StatusProjeto, string> = {
  em_andamento: "#3b82f6",
  pendente: "#f59e0b",
  aguardando_recurso: "#f97316",
  concluido: "#22c55e",
};

const STATUS_BADGE: Record<StatusProjeto, string> = {
  em_andamento: "bg-blue-100 text-blue-800 border-blue-200",
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  aguardando_recurso: "bg-orange-100 text-orange-800 border-orange-200",
  concluido: "bg-green-100 text-green-800 border-green-200",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function DashboardProjetos() {
  const { data: stats, isLoading } = trpc.projetos.dashboard.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const statusData = Object.entries(stats.porStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status as StatusProjeto] ?? status,
    value: count,
    color: STATUS_COLORS[status as StatusProjeto] ?? "#888",
  })).filter((d) => d.value > 0);

  const investPorProjeto = stats.top5Projetos.map((p) => ({
    name: p.nome.length > 20 ? p.nome.slice(0, 18) + "…" : p.nome,
    valor: Number(p.totalInvestido),
  }));

  const investPorDestino = stats.investPorDestino.map((d) => ({
    name: d.destinoNome ?? "Sem destino",
    valor: Number(d.total),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Projetos</h1>
        <p className="text-muted-foreground text-sm">Visão geral dos projetos e investimentos</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100"><FolderOpen className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Projetos</p>
              <p className="text-2xl font-bold">{stats.totalProjetos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Investido</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(Number(stats.totalInvestido))}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100"><Users className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Sócios</p>
              <p className="text-2xl font-bold">{stats.totalSocios}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Concluídos</p>
              <p className="text-2xl font-bold">{stats.porStatus.concluido ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status cards detalhados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(STATUS_LABELS) as StatusProjeto[]).map((s) => (
          <div key={s} className={`rounded-lg border p-3 ${STATUS_BADGE[s]}`}>
            <p className="text-xs font-medium">{STATUS_LABELS[s]}</p>
            <p className="text-2xl font-bold mt-1">{stats.porStatus[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pizza de status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Projetos por Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Nenhum projeto cadastrado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} projeto(s)`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 projetos por investimento */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top 5 Projetos por Investimento</CardTitle></CardHeader>
          <CardContent>
            {investPorProjeto.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Nenhum investimento registrado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={investPorProjeto} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Investido"]} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Investimento por destino */}
      {investPorDestino.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Investimentos por Destino</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={investPorDestino} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Total"]} />
                <Bar dataKey="valor" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista dos projetos recentes */}
      {stats.projetosRecentes && stats.projetosRecentes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Projetos Recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.projetosRecentes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {p.imagemUrl ? (
                      <img src={p.imagemUrl} alt={p.nome} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{p.nome}</p>
                      {p.socios && p.socios.length > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> {p.socios.map((s: any) => s.socioNome).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(Number(p.totalInvestido))}</span>
                    <Badge className={`text-xs border ${STATUS_BADGE[p.status as StatusProjeto]}`}>
                      {STATUS_LABELS[p.status as StatusProjeto]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
