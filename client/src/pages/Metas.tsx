import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Target, Pencil, Trash2, PiggyBank, CalendarDays, CheckCircle2, TrendingUp, History, AlertTriangle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtData = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", opts) : "—";
const CORES = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];
const hojeStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function Metas() {
  const { data: metas, isLoading } = trpc.metas.list.useQuery();
  const { can } = usePermissions();
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", valorAlvo: "", prazo: "", cor: "#10b981" });
  const [aporteMeta, setAporteMeta] = useState<any>(null);
  const [aporte, setAporte] = useState({ valor: "", data: hojeStr(), observacao: "" });
  const [histMeta, setHistMeta] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMut = trpc.metas.create.useMutation({ onSuccess: () => { toast.success("Meta criada!"); setModal(false); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.metas.update.useMutation({ onSuccess: () => { toast.success("Meta atualizada!"); setModal(false); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.metas.delete.useMutation({ onSuccess: () => { toast.success("Meta excluída!"); setDeleteId(null); }, onError: (e) => toast.error(e.message) });
  const aportarMut = trpc.metas.aportar.useMutation({ onSuccess: () => { toast.success("Aporte registrado!"); setAporteMeta(null); }, onError: (e) => toast.error(e.message) });
  const removerAporteMut = trpc.metas.removerAporte.useMutation({ onSuccess: () => toast.success("Aporte removido."), onError: (e) => toast.error(e.message) });
  const { data: aportes } = trpc.metas.aportes.useQuery({ metaId: histMeta?.id ?? 0 }, { enabled: !!histMeta });

  const openNew = () => { setEditItem(null); setForm({ nome: "", valorAlvo: "", prazo: "", cor: "#10b981" }); setModal(true); };
  const openEdit = (m: any) => { setEditItem(m); setForm({ nome: m.nome, valorAlvo: String(m.valorAlvo), prazo: m.prazo ?? "", cor: m.cor ?? "#10b981" }); setModal(true); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: form.nome, valorAlvo: Number(form.valorAlvo), prazo: form.prazo || null, cor: form.cor };
    if (editItem) updateMut.mutate({ id: editItem.id, ...payload }); else createMut.mutate(payload);
  };

  const ativas = (metas ?? []).filter((m) => !m.concluida);
  const concluidas = (metas ?? []).filter((m) => m.concluida);
  const totalGuardado = (metas ?? []).reduce((s, m) => s + m.guardado, 0);
  const totalAlvo = ativas.reduce((s, m) => s + m.valorAlvo, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center"><Target className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-bold">Metas de Poupança</h1>
            <p className="text-xs text-muted-foreground">{ativas.length} ativa(s) · {fmt(totalGuardado)} guardados{totalAlvo > 0 && <> · {Math.round((ativas.reduce((s, m) => s + m.guardado, 0) / totalAlvo) * 100)}% do alvo das ativas</>}</p>
          </div>
        </div>
        {can("create_lancamentos") && <Button onClick={openNew} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova Meta</Button>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (metas ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma meta ainda</p>
          <p className="text-sm">Crie um objetivo (reserva de emergência, viagem, equipamento…) e registre os aportes.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ativas.map((m) => (
              <MetaCard key={m.id} m={m} can={can} onEdit={() => openEdit(m)} onDelete={() => setDeleteId(m.id)} onAporte={() => { setAporteMeta(m); setAporte({ valor: "", data: hojeStr(), observacao: "" }); }} onHist={() => setHistMeta(m)} />
            ))}
          </div>
          {concluidas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Concluídas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concluidas.map((m) => (
                  <MetaCard key={m.id} m={m} can={can} onEdit={() => openEdit(m)} onDelete={() => setDeleteId(m.id)} onAporte={() => { setAporteMeta(m); setAporte({ valor: "", data: hojeStr(), observacao: "" }); }} onHist={() => setHistMeta(m)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Nova / editar meta */}
      <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editItem ? "Editar" : "Nova"} Meta</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Objetivo *</Label><Input placeholder="Ex: Reserva de emergência" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor-alvo (R$) *</Label><Input type="number" step="0.01" min="0.01" value={form.valorAlvo} onChange={(e) => setForm({ ...form, valorAlvo: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES.map((c) => <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })} className={`h-7 w-7 rounded-full border-2 ${form.cor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />)}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editItem ? "Salvar" : "Criar Meta"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Aporte */}
      <Dialog open={!!aporteMeta} onOpenChange={(o) => !o && setAporteMeta(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5" /> Aporte — {aporteMeta?.nome}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); aportarMut.mutate({ metaId: aporteMeta.id, valor: Number(aporte.valor), data: aporte.data, observacao: aporte.observacao || undefined }); }} className="space-y-4 pt-2">
            {aporteMeta && <p className="text-xs text-muted-foreground">Faltam <strong>{fmt(aporteMeta.falta)}</strong> para {fmt(aporteMeta.valorAlvo)}.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" step="0.01" min="0.01" value={aporte.valor} onChange={(e) => setAporte({ ...aporte, valor: e.target.value })} required autoFocus /></div>
              <div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={aporte.data} onChange={(e) => setAporte({ ...aporte, data: e.target.value })} required /></div>
            </div>
            <div className="space-y-1.5"><Label>Observação</Label><Input placeholder="Opcional" value={aporte.observacao} onChange={(e) => setAporte({ ...aporte, observacao: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAporteMeta(null)}>Cancelar</Button>
              <Button type="submit" disabled={aportarMut.isPending}>Registrar Aporte</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Histórico de aportes */}
      <Dialog open={!!histMeta} onOpenChange={(o) => !o && setHistMeta(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Aportes — {histMeta?.nome}</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y">
            {(aportes ?? []).length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum aporte ainda.</p>}
            {(aportes ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium tabular-nums">{fmt(Number(a.valor))}</p>
                  <p className="text-xs text-muted-foreground">{fmtData(a.data)}{a.observacao ? ` · ${a.observacao}` : ""}</p>
                </div>
                {can("delete_lancamentos") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removerAporteMut.mutate({ id: a.id })}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir meta?</AlertDialogTitle><AlertDialogDescription>Os aportes registrados nela também serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetaCard({ m, can, onEdit, onDelete, onAporte, onHist }: { m: any; can: (p: string) => boolean; onEdit: () => void; onDelete: () => void; onAporte: () => void; onHist: () => void }) {
  return (
    <Card className={m.concluida ? "opacity-80" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${m.cor}22`, color: m.cor }}>
            {m.concluida ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{m.nome}</p>
              {m.concluida && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-[10px]">Concluída</Badge>}
              {m.atrasada && !m.concluida && <Badge className="bg-red-100 text-red-700 border-red-200 border text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Prazo vencido</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {m.prazo ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> até {fmtData(m.prazo)}</span> : "Sem prazo"} · {m.aportes} aporte(s)
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onHist} title="Histórico de aportes"><History className="h-3.5 w-3.5" /></Button>
            {can("edit_lancamentos") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>}
            {can("delete_lancamentos") && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold tabular-nums" style={{ color: m.cor }}>{fmt(m.guardado)}</span>
            <span className="text-muted-foreground text-xs tabular-nums">de {fmt(m.valorAlvo)} · <strong>{m.pct}%</strong></span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: m.cor }} />
          </div>
        </div>
        {!m.concluida && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {m.previsao
                ? <>No ritmo atual ({fmt(m.ritmoMensal)}/mês), chega em <strong>{fmtData(m.previsao, { month: "short", year: "numeric" })}</strong></>
                : "Registre aportes (ou marque receitas como investidas) para ver a projeção"}
            </span>
            {m.necessarioMes !== null && <span>Para bater o prazo: <strong>{fmt(m.necessarioMes)}/mês</strong></span>}
          </div>
        )}
        {can("create_lancamentos") && (
          <Button size="sm" variant={m.concluida ? "outline" : "default"} className="w-full gap-1.5 h-8" onClick={onAporte}>
            <PiggyBank className="h-3.5 w-3.5" /> Registrar aporte
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
