import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FolderOpen, DollarSign, Users, Calendar, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusProjeto = "em_andamento" | "pendente" | "aguardando_recurso" | "concluido" | "todos";

const STATUS_LABELS: Record<string, string> = {
  em_andamento: "Em Andamento",
  pendente: "Pendente",
  aguardando_recurso: "Aguardando Recurso",
  concluido: "Concluído",
  todos: "Todos os Status",
};

const STATUS_BADGE: Record<string, string> = {
  em_andamento: "bg-blue-100 text-blue-800 border-blue-200",
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  aguardando_recurso: "bg-orange-100 text-orange-800 border-orange-200",
  concluido: "bg-green-100 text-green-800 border-green-200",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export default function RelatoriosProjetos() {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusProjeto>("todos");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: projetos = [], isLoading } = trpc.projetos.list.useQuery();
  const { data: investimentosExpanded } = trpc.projetos.listInvestimentos.useQuery(
    { projetoId: expandedId! },
    { enabled: expandedId !== null }
  );

  const filtrados = projetos.filter((p) => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.descricao ?? "").toLowerCase().includes(busca.toLowerCase());
    const matchStatus = statusFiltro === "todos" || p.status === statusFiltro;
    return matchBusca && matchStatus;
  });

  const totalGeral = filtrados.reduce((acc, p) => acc + Number(p.totalInvestido), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatório de Projetos</h1>
        <p className="text-muted-foreground text-sm">Visão detalhada de todos os projetos e seus investimentos</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <Label className="text-xs mb-1 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nome ou descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="min-w-48">
          <Label className="text-xs mb-1 block">Status</Label>
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusProjeto)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as StatusProjeto[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Projetos filtrados</p>
              <p className="text-xl font-bold">{filtrados.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Investido</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalGeral)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-blue-400" />
            <div>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
              <p className="text-xl font-bold">{filtrados.filter((p) => p.status === "em_andamento").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-green-400" />
            <div>
              <p className="text-xs text-muted-foreground">Concluídos</p>
              <p className="text-xl font-bold">{filtrados.filter((p) => p.status === "concluido").length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de projetos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Filter className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum projeto encontrado</p>
          <p className="text-sm">Ajuste os filtros acima</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                {p.imagemUrl ? (
                  <img src={p.imagemUrl} alt={p.nome} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{p.nome}</h3>
                    <Badge className={`text-xs border ${STATUS_BADGE[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </div>
                  {p.descricao && <p className="text-xs text-muted-foreground truncate">{p.descricao}</p>}
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {p.dataInicio && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.dataInicio)}</span>
                    )}
                    {p.socios && p.socios.length > 0 && (
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {p.socios.map((s: any) => s.socioNome).join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-green-700">{formatCurrency(Number(p.totalInvestido))}</p>
                  <p className="text-xs text-muted-foreground">{p.qtdInvestimentos ?? 0} investimento{(p.qtdInvestimentos ?? 0) !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Expandido: lista de investimentos */}
              {expandedId === p.id && (
                <div className="border-t bg-muted/20 p-4">
                  {!investimentosExpanded ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    </div>
                  ) : investimentosExpanded.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum investimento registrado</p>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Investimentos</h4>
                      {investimentosExpanded.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between bg-white dark:bg-card rounded p-2 border text-sm">
                          <div>
                            <span className="font-semibold text-green-700">{formatCurrency(Number(inv.valor))}</span>
                            <span className="text-muted-foreground ml-2">{formatDate(inv.data)}</span>
                            {inv.destinoNome && <Badge variant="outline" className="text-xs ml-2">{inv.destinoNome}</Badge>}
                            {inv.descricao && <p className="text-xs text-muted-foreground mt-0.5">{inv.descricao}</p>}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2 border-t">
                        <span className="text-sm font-bold text-green-700">
                          Total: {formatCurrency(investimentosExpanded.reduce((a, i) => a + Number(i.valor), 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
