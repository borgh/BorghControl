import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

const CORES = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#6366f1"];

export default function Categorias() {
  const utils = trpc.useUtils();
  const { data: cats, isLoading } = trpc.categorias.list.useQuery();
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "despesa" as "despesa" | "receita", cor: "#10b981" });

  const createMut = trpc.categorias.create.useMutation({
    onSuccess: () => { toast.success("Categoria criada!"); utils.categorias.list.invalidate(); setModal(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.categorias.update.useMutation({
    onSuccess: () => { toast.success("Categoria atualizada!"); utils.categorias.list.invalidate(); setModal(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.categorias.delete.useMutation({
    onSuccess: () => { toast.success("Excluída!"); utils.categorias.list.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (c: any) => { setEditItem(c); setForm({ nome: c.nome, tipo: c.tipo, cor: c.cor ?? "#10b981" }); setModal(true); };
  const openNew = () => { setEditItem(null); setForm({ nome: "", tipo: "despesa", cor: "#10b981" }); setModal(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem) updateMut.mutate({ id: editItem.id, nome: form.nome, cor: form.cor });
    else createMut.mutate(form);
  };

  const despesas = (cats ?? []).filter((c: any) => c.tipo === "despesa");
  const receitas = (cats ?? []).filter((c: any) => c.tipo === "receita");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <Tag className="h-5 w-5 text-purple-600" />
          </div>
          <h1 className="text-xl font-bold">Categorias</h1>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova Categoria</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[{ label: "Despesas", items: despesas, color: "text-red-600" }, { label: "Receitas", items: receitas, color: "text-emerald-600" }].map(({ label, items, color }) => (
          <Card key={label}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-semibold ${color}`}>{label} ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria</p>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 group">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ background: c.cor ?? "#94a3b8" }} />
                      <span className="flex-1 text-sm font-medium">{c.nome}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editItem ? "Editar" : "Nova"} Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Alimentação, Salário..." value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            {!editItem && (
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })}
                    className={`h-7 w-7 rounded-full transition-transform ${form.cor === c ? "scale-125 ring-2 ring-offset-1 ring-ring" : "hover:scale-110"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editItem ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir categoria?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
