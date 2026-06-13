import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Check, RotateCcw, Pencil, Trash2, TrendingDown, Loader2 } from "lucide-react";
import { TransacaoModal } from "./TransacaoModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Despesas() {
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: anosData } = trpc.relatorios.anosDisponiveis.useQuery();
  const anos = useMemo(() => {
    const set = new Set([...(anosData ?? []), hoje.getFullYear()]);
    return Array.from(set).sort((a, b) => b - a);
  }, [anosData]);

  const { data, isLoading } = trpc.transacoes.list.useQuery({
    tipo: "despesa", mes: Number(mes), ano: Number(ano),
    status: status !== "todos" ? status as any : undefined,
    busca: busca || undefined,
  });

  const marcarPago = trpc.transacoes.marcarPago.useMutation({
    onSuccess: () => { toast.success("Marcado como pago!"); utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const marcarPendente = trpc.transacoes.marcarPendente.useMutation({
    onSuccess: () => { toast.success("Marcado como pendente!"); utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.transacoes.delete.useMutation({
    onSuccess: () => { toast.success("Excluído!"); utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const total = items.reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalPago = items.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.valor), 0);
  const totalPendente = items.filter((i: any) => i.status === "pendente").reduce((s: number, i: any) => s + Number(i.valor), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Contas a Pagar</h1>
            <p className="text-xs text-muted-foreground">{items.length} lançamentos</p>
          </div>
        </div>
        <Button onClick={() => { setEditItem(null); setModal(true); }} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Despesa
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-red-50 border-red-100"><CardContent className="p-4 text-center"><p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total</p><p className="text-lg font-bold text-red-700">{fmt(total)}</p></CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-100"><CardContent className="p-4 text-center"><p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Pago</p><p className="text-lg font-bold text-emerald-700">{fmt(totalPago)}</p></CardContent></Card>
        <Card className="bg-amber-50 border-amber-100"><CardContent className="p-4 text-center"><p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pendente</p><p className="text-lg font-bold text-amber-700">{fmt(totalPendente)}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.slice(1).map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a: number) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
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
              <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma despesa encontrada</p>
              <p className="text-sm">Ajuste os filtros ou crie uma nova despesa</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.categoriaCor ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{item.descricao}</p>
                      {item.diaVencimento && <span className="text-xs text-muted-foreground">dia {item.diaVencimento}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.categoriaNome ?? "Sem categoria"}{item.formaPagamento ? ` · ${item.formaPagamento}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-red-600">{fmt(Number(item.valor))}</span>
                    <Badge variant="outline" className={`text-xs ${item.status === "pago" ? "badge-pago" : item.status === "cancelado" ? "badge-cancelado" : "badge-pendente"}`}>
                      {item.status === "pago" ? "Pago" : item.status === "cancelado" ? "Cancelado" : "Pendente"}
                    </Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.status === "pendente" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => marcarPago.mutate({ id: item.id })} title="Marcar como pago">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {item.status === "pago" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => marcarPendente.mutate({ id: item.id })} title="Marcar como pendente">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditItem(item); setModal(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransacaoModal open={modal} onClose={() => setModal(false)} tipo="despesa" editItem={editItem} onSuccess={() => utils.transacoes.list.invalidate()} />
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir despesa?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
