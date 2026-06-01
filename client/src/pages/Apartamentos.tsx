import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Apartamento = {
  id: number;
  numero: string;
  bloco: string | null;
  responsavel: string | null;
  status: "participante" | "nao_participante";
};

export default function Apartamentos() {
  const utils = trpc.useUtils();
  const { data: apts = [], isLoading } = trpc.apartamentos.list.useQuery();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editApt, setEditApt] = useState<Apartamento | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    numero: "", bloco: "", responsavel: "", status: "participante" as "participante" | "nao_participante",
  });

  const invalidate = () => utils.apartamentos.list.invalidate();

  const createMutation = trpc.apartamentos.create.useMutation({
    onSuccess: () => { toast.success("Apartamento cadastrado!"); invalidate(); setModalOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.apartamentos.update.useMutation({
    onSuccess: () => { toast.success("Apartamento atualizado!"); invalidate(); setModalOpen(false); setEditApt(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.apartamentos.delete.useMutation({
    onSuccess: () => { toast.success("Apartamento removido."); invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMutation = trpc.apartamentos.toggleStatus.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditApt(null);
    setForm({ numero: "", bloco: "", responsavel: "", status: "participante" });
    setModalOpen(true);
  };
  const openEdit = (a: Apartamento) => {
    setEditApt(a);
    setForm({ numero: a.numero, bloco: a.bloco ?? "", responsavel: a.responsavel ?? "", status: a.status });
    setModalOpen(true);
  };
  const handleSubmit = () => {
    if (!form.numero.trim()) { toast.error("Número do apartamento é obrigatório."); return; }
    const payload = {
      numero: form.numero,
      bloco: form.bloco || undefined,
      responsavel: form.responsavel || undefined,
      status: form.status,
    };
    if (editApt) updateMutation.mutate({ id: editApt.id, ...payload });
    else createMutation.mutate(payload);
  };

  const filtered = apts.filter((a) =>
    a.numero.toLowerCase().includes(search.toLowerCase()) ||
    (a.bloco ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (a.responsavel ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const participantes = apts.filter((a) => a.status === "participante").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Apartamentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {apts.length} apartamentos cadastrados · {participantes} participantes
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 h-9">
          <Plus className="w-4 h-4" /> Novo Apartamento
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar apartamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <Card className="border border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <Building2 className="w-10 h-10 opacity-30" />
              <p className="text-sm">{search ? "Nenhum apartamento encontrado." : "Nenhum apartamento cadastrado ainda."}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={openCreate} className="gap-2 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Cadastrar primeiro apartamento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Apartamento</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Bloco/Torre</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Responsável</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          Apto {a.numero}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                        {a.bloco || <span className="italic opacity-50">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          {a.responsavel ? (
                            <><User className="w-3 h-3 flex-shrink-0" />{a.responsavel}</>
                          ) : (
                            <span className="italic opacity-50">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={a.status === "participante" ? "default" : "secondary"}
                          className={a.status === "participante" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
                        >
                          {a.status === "participante" ? "Participante" : "Não Participante"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" title="Alternar status" onClick={() => toggleMutation.mutate({ id: a.id })}>
                            {a.status === "participante" ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(a)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editApt ? "Editar Apartamento" : "Novo Apartamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número <span className="text-destructive">*</span></Label>
                <Input id="numero" placeholder="Ex: 101, 202" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bloco">Bloco/Torre</Label>
                <Input id="bloco" placeholder="Ex: A, B, Torre 1" value={form.bloco} onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))} maxLength={20} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Nome do Responsável</Label>
              <Input id="responsavel" placeholder="Ex: João da Silva" value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "participante" | "nao_participante" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="participante">Participante</SelectItem>
                  <SelectItem value="nao_participante">Não Participante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editApt ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Apartamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este apartamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
