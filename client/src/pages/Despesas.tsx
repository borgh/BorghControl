import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Check, RotateCcw, Pencil, Trash2, TrendingDown, Loader2, Repeat, Infinity, Flame, AlertTriangle, Clock } from "lucide-react";
import { TransacaoModal } from "./TransacaoModal";
import { TransacaoDetalheModal } from "./TransacaoDetalheModal";
import { AnexosBadge } from "@/components/AnexosBadge";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MESES = ["Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type OrdemKey = "vencimento_asc" | "vencimento_desc" | "valor_asc" | "valor_desc" | "descricao_asc" | "descricao_desc" | "status";

/**
 * Retorna true se a despesa está em atraso:
 * status=pendente E data de vencimento anterior a hoje.
 * Usa dataVencimento (YYYY-MM-DD) se disponível, senão reconstrói a partir de ano/mes/diaVencimento.
 */
export function isEmAtraso(item: any): boolean {
  if (item.status !== "pendente") return false;
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const venc = item.dataVencimento
    ?? (item.diaVencimento
      ? `${item.ano}-${String(item.mes).padStart(2, "0")}-${String(item.diaVencimento).padStart(2, "0")}`
      : `${item.ano}-${String(item.mes).padStart(2, "0")}-01`);
  return venc < hojeStr;
}

/**
 * Retorna quantos dias faltam para o vencimento (0 = hoje, negativo = atrasado).
 * Retorna null se não houver data de vencimento.
 */
export function diasParaVencer(item: any): number | null {
  const venc = item.dataVencimento
    ?? (item.diaVencimento
      ? `${item.ano}-${String(item.mes).padStart(2, "0")}-${String(item.diaVencimento).padStart(2, "0")}`
      : null);
  if (!venc) return null;
  const hoje = new Date();
  const hojeMs = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [y, m, d] = venc.split("-").map(Number);
  const vencMs = Date.UTC(y, m - 1, d);
  return Math.round((vencMs - hojeMs) / 86400000);
}

/**
 * Retorna true se a despesa está pendente (não em atraso) e vence em até 3 dias.
 */
export function isVenceEmBreve(item: any): boolean {
  if (item.status !== "pendente") return false;
  if (isEmAtraso(item)) return false;
  const dias = diasParaVencer(item);
  return dias !== null && dias >= 0 && dias <= 3;
}

function sortItems(items: any[], ordem: OrdemKey): any[] {
  return [...items].sort((a, b) => {
    switch (ordem) {
      case "vencimento_asc": {
        const da = a.dataVencimento ?? `${a.ano}-${String(a.mes).padStart(2,"0")}-${String(a.diaVencimento ?? 1).padStart(2,"0")}`;
        const db = b.dataVencimento ?? `${b.ano}-${String(b.mes).padStart(2,"0")}-${String(b.diaVencimento ?? 1).padStart(2,"0")}`;
        return da < db ? -1 : da > db ? 1 : 0;
      }
      case "vencimento_desc": {
        const da = a.dataVencimento ?? `${a.ano}-${String(a.mes).padStart(2,"0")}-${String(a.diaVencimento ?? 1).padStart(2,"0")}`;
        const db = b.dataVencimento ?? `${b.ano}-${String(b.mes).padStart(2,"0")}-${String(b.diaVencimento ?? 1).padStart(2,"0")}`;
        return da > db ? -1 : da < db ? 1 : 0;
      }
      case "valor_asc":
        return Number(a.valor) - Number(b.valor);
      case "valor_desc":
        return Number(b.valor) - Number(a.valor);
      case "descricao_asc":
        return (a.descricao ?? "").localeCompare(b.descricao ?? "", "pt-BR");
      case "descricao_desc":
        return (b.descricao ?? "").localeCompare(a.descricao ?? "", "pt-BR");
      case "status": {
        // Em atraso primeiro, depois pendente, pago, cancelado
        const order = (i: any) => {
          if (i.status === "cancelado") return 3;
          if (i.status === "pago") return 2;
          if (isEmAtraso(i)) return 0;
          return 1;
        };
        return order(a) - order(b);
      }
      default:
        return 0;
    }
  });
}

function RecorrenciaBadge({ item }: { item: any }) {
  if (!item.recorrente) return null;
  if (item.totalParcelas == null) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 shrink-0">
        <Infinity className="h-2.5 w-2.5" /> Contrato
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50 shrink-0">
      <Repeat className="h-2.5 w-2.5" /> {item.parcelaAtual}/{item.totalParcelas}
    </Badge>
  );
}

export function StatusBadge({ item }: { item: any }) {
  if (item.status === "pendente") {
    if (isEmAtraso(item)) {
      return (
        <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-red-100 text-red-800 border border-red-400 hover:bg-red-100 shrink-0">
          <AlertTriangle className="h-2.5 w-2.5" /> Em Atraso
        </Badge>
      );
    }
    const dias = diasParaVencer(item);
    if (dias !== null && dias >= 0 && dias <= 3) {
      const label = dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias}d`;
      return (
        <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-orange-100 text-orange-800 border border-orange-400 hover:bg-orange-100 shrink-0">
          <Clock className="h-2.5 w-2.5" /> {label}
        </Badge>
      );
    }
    return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100 shrink-0">Pendente</Badge>;
  }
  if (item.status === "cancelado") {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground shrink-0">Cancelado</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50 shrink-0">Pago</Badge>;
}

export default function Despesas() {
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const searchStr = useSearch();
  // Lê o status inicial da URL (funciona tanto na montagem quanto na navegação)
  const [status, setStatus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") ?? "todos";
  });

  // Atualiza o filtro quando a URL mudar (ex: navegação do dashboard)
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const s = params.get("status") ?? "todos";
    setStatus(s);
  }, [searchStr]);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemKey>("vencimento_asc");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [detalheItem, setDetalheItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; grupoId?: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"single" | "group">("single");

  const utils = trpc.useUtils();
  const { data: anosData } = trpc.relatorios.anosDisponiveis.useQuery();
  const anos = useMemo(() => {
    const set = new Set([...(anosData ?? []), hoje.getFullYear()]);
    return Array.from(set).sort((a, b) => b - a);
  }, [anosData]);

  // Para "em_atraso" e "vence_em_breve", buscamos todos os pendentes e filtramos no frontend
  const queryStatus = (status === "em_atraso" || status === "vence_em_breve") ? "pendente" : (status !== "todos" ? status as any : undefined);

  // Quando não há filtro de mês (todos os meses), precisamos de limite alto para garantir que
  // todos os registros sejam retornados antes do filtro de "em_atraso"/"vence_em_breve" no frontend.
  // Sem isso, o limite padrão de 100 corta o dataset e o filtro retorna resultados incorretos.
  const queryLimit = mes === "0" ? 5000 : 500;

  const { data, isLoading } = trpc.transacoes.list.useQuery({
    tipo: "despesa",
    mes: mes !== "0" ? Number(mes) : undefined,
    ano: ano !== "0" ? Number(ano) : undefined,
    status: queryStatus,
    busca: busca || undefined,
    prioridade: filtroPrioridade === "sim" ? true : filtroPrioridade === "nao" ? false : undefined,
    limit: queryLimit,
  });

  const invalidate = () => { utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); };

  const marcarPago = trpc.transacoes.marcarPago.useMutation({
    onSuccess: () => { toast.success("Marcado como pago!"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const marcarPendente = trpc.transacoes.marcarPendente.useMutation({
    onSuccess: () => { toast.success("Marcado como pendente!"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.transacoes.delete.useMutation({
    onSuccess: () => { toast.success("Excluído!"); invalidate(); setDeleteTarget(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGrupoMut = trpc.transacoes.deleteGrupo.useMutation({
    onSuccess: () => { toast.success("Série excluída!"); invalidate(); setDeleteTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const { can } = usePermissions();
  const rawItems = data?.items ?? [];

  // Aplica filtro de "em atraso" ou "pendente puro" no frontend
  const filteredItems = useMemo(() => {
    if (status === "em_atraso") return rawItems.filter((i: any) => isEmAtraso(i));
    if (status === "pendente") return rawItems.filter((i: any) => i.status === "pendente" && !isEmAtraso(i));
    if (status === "vence_em_breve") return rawItems.filter((i: any) => isVenceEmBreve(i));
    return rawItems;
  }, [rawItems, status]);

  const items = useMemo(() => sortItems(filteredItems, ordem), [filteredItems, ordem]);

  const total = rawItems.reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalPago = rawItems.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalPendente = rawItems.filter((i: any) => i.status === "pendente" && !isEmAtraso(i)).reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalAtraso = rawItems.filter((i: any) => isEmAtraso(i)).reduce((s: number, i: any) => s + Number(i.valor), 0);
  const itensVenceEmBreve = rawItems.filter((i: any) => isVenceEmBreve(i));
  const totalVenceEmBreve = itensVenceEmBreve.reduce((s: number, i: any) => s + Number(i.valor), 0);

  const handleDeleteClick = (item: any) => {
    setDeleteTarget({ id: item.id, grupoId: item.recorrenciaGrupoId });
    setDeleteMode("single");
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteMode === "group" && deleteTarget.grupoId) {
      deleteGrupoMut.mutate({ grupoId: deleteTarget.grupoId });
    } else {
      deleteMut.mutate({ id: deleteTarget.id });
    }
  };

  const hasGroup = !!deleteTarget?.grupoId;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Contas a Pagar</h1>
            <p className="text-xs text-muted-foreground">{items.length} lançamentos</p>
          </div>
        </div>
        {can("create_lancamentos") && (
          <Button onClick={() => { setEditItem(null); setModal(true); }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Despesa
          </Button>
        )}
      </div>

      {/* Banner de alerta — vence em breve */}
      {itensVenceEmBreve.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => setStatus("vence_em_breve")}
          title="Clique para filtrar despesas que vencem em breve"
        >
          <Clock className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">
              {itensVenceEmBreve.length === 1
                ? "1 despesa vence nos próximos 3 dias"
                : `${itensVenceEmBreve.length} despesas vencem nos próximos 3 dias`}
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Total: {fmt(totalVenceEmBreve)} — clique para ver apenas essas despesas
            </p>
          </div>
          <Badge className="text-[10px] px-2 py-0.5 bg-orange-200 text-orange-800 border border-orange-400 hover:bg-orange-200 shrink-0">
            Ver
          </Badge>
        </div>
      )}
      {/* Resumo — 4 cards quando há atraso, 3 quando não */}
      <div className={`grid gap-2 ${totalAtraso > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        <Card className="bg-red-50 border-red-100 overflow-hidden">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-red-600 font-medium uppercase tracking-wide">Total</p>
            <p className="text-[10px] sm:text-sm font-bold text-red-700 tabular-nums leading-tight break-all">{fmt(total)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 overflow-hidden">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Pago</p>
            <p className="text-[10px] sm:text-sm font-bold text-emerald-700 tabular-nums leading-tight break-all">{fmt(totalPago)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 overflow-hidden cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setStatus("pendente")} title="Filtrar apenas Pendentes">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-amber-600 font-medium uppercase tracking-wide">Pendente</p>
            <p className="text-[10px] sm:text-sm font-bold text-amber-700 tabular-nums leading-tight break-all">{fmt(totalPendente)}</p>
          </CardContent>
        </Card>
        {totalAtraso > 0 && (
          <Card className="bg-red-100 border-red-300 overflow-hidden cursor-pointer hover:bg-red-200 transition-colors" onClick={() => setStatus("em_atraso")} title="Filtrar apenas Em Atraso">
            <CardContent className="p-2 sm:p-3 text-center">
              <p className="text-[9px] sm:text-[10px] text-red-700 font-medium uppercase tracking-wide flex items-center justify-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" /> Em Atraso
              </p>
              <p className="text-[10px] sm:text-sm font-bold text-red-800 tabular-nums leading-tight break-all">{fmt(totalAtraso)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {/* Busca */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9 w-full" />
            </div>
            {/* Mês / Ano / Status */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9 text-xs sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos os meses</SelectItem>
                  {MESES.slice(1).map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="h-9 text-xs sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos</SelectItem>
                  {anos.map((a: number) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="vence_em_breve">🕐 Vence em 3 dias</SelectItem>
                  <SelectItem value="em_atraso">⚠️ Em Atraso</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              {/* Prioridade */}
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger className="h-9 text-xs sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="sim">🔥 Alta Prioridade</SelectItem>
                  <SelectItem value="nao">Prioridade Normal</SelectItem>
                </SelectContent>
              </Select>
              {/* Ordenação */}
              <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemKey)}>
                <SelectTrigger className="h-9 text-xs sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vencimento_asc">Vencimento ↑</SelectItem>
                  <SelectItem value="vencimento_desc">Vencimento ↓</SelectItem>
                  <SelectItem value="valor_asc">Valor ↑</SelectItem>
                  <SelectItem value="valor_desc">Valor ↓</SelectItem>
                  <SelectItem value="descricao_asc">Descrição A→Z</SelectItem>
                  <SelectItem value="descricao_desc">Descrição Z→A</SelectItem>
                  <SelectItem value="status">Status (atraso primeiro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma despesa encontrada</p>
              <p className="text-sm">Ajuste os filtros ou crie uma nova despesa</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item: any) => {
                const isPendente = item.status === "pendente";
                const isCancelado = item.status === "cancelado";
                const emAtraso = isEmAtraso(item);

                const dataVenc = item.dataVencimento
                  ? new Date(item.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : item.diaVencimento
                    ? `dia ${item.diaVencimento}`
                    : null;

                return (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setDetalheItem(item);
                    }}
                    className={`px-3 py-3 transition-colors group cursor-pointer ${
                      emAtraso
                        ? "bg-red-50/80 hover:bg-red-50 border-l-2 border-l-red-500"
                        : isPendente
                          ? "bg-amber-50/70 hover:bg-amber-50 border-l-2 border-l-amber-400"
                          : isCancelado
                            ? "bg-muted/20 hover:bg-muted/30 opacity-60"
                            : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: item.categoriaCor ?? "#94a3b8" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <p className={`text-sm font-semibold leading-tight truncate ${emAtraso ? "text-red-900" : isPendente ? "text-amber-900" : ""}`}>
                              {item.descricao}
                            </p>
                            <RecorrenciaBadge item={item} />
                            {item.prioridade && (
                              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-orange-700 border-orange-300 bg-orange-50 shrink-0">
                                <Flame className="h-2.5 w-2.5" /> Prioridade
                              </Badge>
                            )}
                            <AnexosBadge transacaoId={item.id} descricao={item.descricao} />
                          </div>
                          <span className={`text-sm font-bold tabular-nums shrink-0 ${emAtraso ? "text-red-700" : isPendente ? "text-amber-700" : "text-red-600"}`}>
                            {fmt(Number(item.valor))}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={`text-[11px] leading-tight truncate min-w-0 ${emAtraso ? "text-red-700" : isPendente ? "text-amber-700" : "text-muted-foreground"}`}>
                            {[item.categoriaNome, item.formaPagamento, dataVenc, `${MESES[item.mes]?.slice(0,3)}/${item.ano}`].filter(Boolean).join(" · ")}
                          </p>

                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge item={item} />
                            {isPendente && can("mark_paid") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => marcarPago.mutate({ id: item.id })} title="Marcar como pago">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {item.status === "pago" && can("mark_paid") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => marcarPendente.mutate({ id: item.id })} title="Marcar como pendente">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {can("edit_lancamentos") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditItem(item); setModal(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {can("delete_lancamentos") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(item)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TransacaoModal open={modal} onClose={() => setModal(false)} tipo="despesa" editItem={editItem} onSuccess={invalidate} />

      <TransacaoDetalheModal
        open={detalheItem !== null}
        item={detalheItem}
        onClose={() => setDetalheItem(null)}
        onEdit={(it) => { setEditItem(it); setModal(true); }}
        onRefresh={invalidate}
      />

      {/* Dialog de exclusão */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasGroup
                ? "Esta despesa faz parte de uma série recorrente. Escolha como deseja excluir:"
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hasGroup && (
            <div className="flex flex-col gap-2 py-2">
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                <input type="radio" name="deleteModeDespesa" checked={deleteMode === "single"} onChange={() => setDeleteMode("single")} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Apenas este lançamento</p>
                  <p className="text-xs text-muted-foreground">Remove somente esta parcela, mantendo as demais.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                <input type="radio" name="deleteModeDespesa" checked={deleteMode === "group"} onChange={() => setDeleteMode("group")} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Toda a série</p>
                  <p className="text-xs text-muted-foreground">Remove todos os lançamentos desta série recorrente.</p>
                </div>
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMode === "group" ? "Excluir Toda a Série" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
