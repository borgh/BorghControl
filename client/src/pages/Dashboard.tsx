import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ParkingSquare,
  Building2,
  Shuffle,
  History,
  TrendingUp,
  CheckCircle2,
  Users,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const vagasData = stats
    ? [
        { name: "Ativas", value: stats.vagasAtivas, color: "#1e40af" },
        { name: "Inativas", value: stats.totalVagas - stats.vagasAtivas, color: "#e2e8f0" },
      ]
    : [];

  const aptsData = stats
    ? [
        { name: "Participantes", value: stats.apartamentosParticipantes, color: "#1e40af" },
        { name: "Não Participantes", value: stats.totalApartamentos - stats.apartamentosParticipantes, color: "#e2e8f0" },
      ]
    : [];

  const barData = stats?.ultimosSorteios?.map((s: any, i: number) => ({
    name: `Sorteio ${i + 1}`,
    participantes: s.totalParticipantes,
    vagas: s.totalVagas,
  })).reverse() ?? [];

  const statCards = [
    {
      title: "Total de Vagas",
      value: stats?.totalVagas ?? 0,
      sub: `${stats?.vagasAtivas ?? 0} ativas`,
      icon: ParkingSquare,
      color: "text-blue-700",
      bg: "bg-blue-50",
      href: "/vagas",
    },
    {
      title: "Apartamentos",
      value: stats?.totalApartamentos ?? 0,
      sub: `${stats?.apartamentosParticipantes ?? 0} participantes`,
      icon: Building2,
      color: "text-indigo-700",
      bg: "bg-indigo-50",
      href: "/apartamentos",
    },
    {
      title: "Sorteios Realizados",
      value: stats?.totalSorteios ?? 0,
      sub: "histórico completo",
      icon: Shuffle,
      color: "text-violet-700",
      bg: "bg-violet-50",
      href: "/historico",
    },
    {
      title: "Pronto para Sortear",
      value:
        stats && stats.apartamentosParticipantes > 0 && stats.vagasAtivas > 0
          ? "Sim"
          : "Não",
      sub:
        stats && stats.apartamentosParticipantes > 0 && stats.vagasAtivas > 0
          ? `${Math.min(stats.apartamentosParticipantes, stats.vagasAtivas)} pares disponíveis`
          : "Cadastre vagas e apartamentos",
      icon: CheckCircle2,
      color:
        stats && stats.apartamentosParticipantes > 0 && stats.vagasAtivas > 0
          ? "text-emerald-700"
          : "text-amber-700",
      bg:
        stats && stats.apartamentosParticipantes > 0 && stats.vagasAtivas > 0
          ? "bg-emerald-50"
          : "bg-amber-50",
      href: "/sorteio",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visão geral do sistema de sorteio de vagas
          </p>
        </div>
        <Link href="/sorteio">
          <Button className="gap-2 h-9">
            <Shuffle className="w-4 h-4" />
            Novo Sorteio
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ title, value, sub, icon: Icon, color, bg, href }) => (
          <Link key={title} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200 border border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {title}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16 mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground">{value}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 ml-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vagas Pie */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Vagas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : stats?.totalVagas === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma vaga cadastrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={vagasData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {vagasData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, ""]} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Apartamentos Pie */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Apartamentos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : stats?.totalApartamentos === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum apartamento cadastrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={aptsData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {aptsData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, ""]} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Últimos Sorteios Bar */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Últimos Sorteios</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : barData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum sorteio realizado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="participantes" name="Participantes" fill="#1e40af" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="vagas" name="Vagas" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/vagas", icon: ParkingSquare, title: "Gerenciar Vagas", desc: "Cadastre e gerencie as vagas disponíveis", color: "text-blue-600" },
          { href: "/apartamentos", icon: Building2, title: "Gerenciar Apartamentos", desc: "Cadastre os apartamentos participantes", color: "text-indigo-600" },
          { href: "/historico", icon: History, title: "Ver Histórico", desc: "Consulte sorteios anteriores", color: "text-violet-600" },
        ].map(({ href, icon: Icon, title, desc, color }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200 border border-border group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
