import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Check, RotateCcw, Pencil, Trash2, TrendingUp, Loader2, Repeat, Infinity } from "lucide-react";
import { TransacaoModal } from "./TransacaoModal";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MESES = ["Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function RecorrenciaBadge({ item }: { item: any }) {
  if (!item.recorrente) return null;
  if (item.totalParcelas == null) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-emerald-700 border-emerald-200 bg-emerald-50">
        <Infinity className="h-2.5 w-2.5" /> Contrato
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-blue-700 border-blue-200 bg-blue-50">
      <Repeat className="h-2.5 w-2.5" /> {item.parcelaAtual}/{item.totalParcelas}
    </Badge>
  );
}

export default function Receitas() {
  const hoje = new Date();
  // Padrão: mês e ano atuais
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; grupoId?: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"single" | "group">("single");

  const utils = trpc.useUtils();
  const { data: anosData } = trpc.relatorios.anosDisponiveis.useQuery();
  const anos = useMemo(() => {
    const set = new Set([...(anosData ?? []), hoje.getFullYear()]);
    return Array.from(set).sort((a, b) => b - a);
  }, [anosData]);

  const { data, isLoading } = trpc.transacoes.list.useQuery({
    tipo: "receita",
    mes: mes !== "0" ? Number(mes) : undefined,
    ano: ano !== "0" ? Number(ano) : undefined,
    status: status !== "todos" ? status as any : undefined,
    busca: busca || undefined,
  });

  const invalidate = () => { utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); };

  const marcarPago = trpc.transacoes.marcarPago.useMutation({
    onSuccess: () => { toast.success("Marcado como recebido!"); invalidate(); },
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
  const items = data?.items ?? [];
  const total = items.reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalRecebido = items.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalPendente = items.filter((i: any) => i.status === "pendente").reduce((s: number, i: any) => s + Number(i.valor), 0);

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
          <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Contas a Receber</h1>
            <p className="text-xs text-muted-foreground">{items.length} lançamentos</p>
          </div>
        </div>
        {can("create_lancamentos") && (
          <Button onClick={() => { setEditItem(null); setModal(true); }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Receita
          </Button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(total)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Recebido</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(totalRecebido)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pendente</p>
            <p className="text-lg font-bold text-amber-700">{fmt(totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9" />
            </div>
            {/* Mês */}
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos os meses</SelectItem>
                {MESES.slice(1).map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Ano */}
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos os anos</SelectItem>
                {anos.map((a: number) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Status */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
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
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma receita encontrada</p>
              <p className="text-sm">Ajuste os filtros ou crie uma nova receita</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item: any) => {
                const isPendente = item.status === "pendente";
                const isCancelado = item.status === "cancelado";
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors group ${
                      isPendente
                        ? "bg-amber-50/70 hover:bg-amber-50 border-l-2 border-l-amber-400"
                        : isCancelado
                          ? "bg-muted/20 hover:bg-muted/30 opacity-60"
                          : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.categoriaCor ?? "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium truncate ${isPendente ? "text-amber-900" : ""}`}>{item.descricao}</p>
                        <RecorrenciaBadge item={item} />
                      </div>
                      <p className={`text-xs ${isPendente ? "text-amber-700" : "text-muted-foreground"}`}>
                        {item.categoriaNome ?? "Sem categoria"}
                        {item.formaPagamento ? ` · ${item.formaPagamento}` : ""}
                        {item.dataVencimento
                          ? ` · vence ${new Date(item.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}`
                          : item.diaVencimento ? ` · dia ${item.diaVencimento}` : ""}
                        {item.recorrente && item.totalParcelas != null && item.parcelaAtual != null
                          ? ` · Parcela ${item.parcelaAtual}/${item.totalParcelas}`
                          : ""}
                        {` · ${MESES[item.mes]}/${item.ano}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${isPendente ? "text-amber-700" : "text-emerald-600"}`}>
                        {fmt(Number(item.valor))}
                      </span>
                      {/* Badge de status com cor diferenciada para pendente */}
                      {isPendente ? (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                          Pendente
                        </Badge>
                      ) : isCancelado ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Cancelado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50">Recebido</Badge>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPendente && can("mark_paid") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => marcarPago.mutate({ id: item.id })} title="Marcar como recebido">
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TransacaoModal open={modal} onClose={() => setModal(false)} tipo="receita" editItem={editItem} onSuccess={invalidate} />

      {/* Dialog de exclusão */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasGroup
                ? "Esta receita faz parte de uma série recorrente. Escolha como deseja excluir:"
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hasGroup && (
            <div className="flex flex-col gap-2 py-2">
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                <input type="radio" name="deleteModeReceita" checked={deleteMode === "single"} onChange={() => setDeleteMode("single")} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Apenas este lançamento</p>
                  <p className="text-xs text-muted-foreground">Remove somente esta parcela, mantendo as demais.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                <input type="radio" name="deleteModeReceita" checked={deleteMode === "group"} onChange={() => setDeleteMode("group")} className="mt-0.5" />
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
