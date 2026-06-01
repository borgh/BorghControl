import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ParkingSquare, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Vaga = {
  id: number;
  numero: string;
  descricao: string | null;
  status: "ativa" | "inativa";
};

export default function Vagas() {
  const utils = trpc.useUtils();
  const { data: vagas = [], isLoading } = trpc.vagas.list.useQuery();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editVaga, setEditVaga] = useState<Vaga | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ numero: "", descricao: "", status: "ativa" as "ativa" | "inativa" });

  const invalidate = () => utils.vagas.list.invalidate();

  const createMutation = trpc.vagas.create.useMutation({
    onSuccess: () => { toast.success("Vaga cadastrada com sucesso!"); invalidate(); setModalOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.vagas.update.useMutation({
    onSuccess: () => { toast.success("Vaga atualizada com sucesso!"); invalidate(); setModalOpen(false); setEditVaga(null); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.vagas.delete.useMutation({
    onSuccess: () => { toast.success("Vaga removida."); invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.vagas.toggleStatus.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditVaga(null);
    setForm({ numero: "", descricao: "", status: "ativa" });
    setModalOpen(true);
  };

  const openEdit = (v: Vaga) => {
    setEditVaga(v);
    setForm({ numero: v.numero, descricao: v.descricao ?? "", status: v.status });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!form.numero.trim()) { toast.error("Número da vaga é obrigatório."); return; }
    if (editVaga) {
      updateMutation.mutate({ id: editVaga.id, ...form, descricao: form.descricao || undefined });
    } else {
      createMutation.mutate({ ...form, descricao: form.descricao || undefined });
    }
  };

  const filtered = vagas.filter(
    (v) =>
      v.numero.toLowerCase().includes(search.toLowerCase()) ||
      (v.descricao ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const ativas = vagas.filter((v) => v.status === "ativa").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Vagas de Garagem</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {vagas.length} vagas cadastradas · {ativas} ativas
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 h-9">
          <Plus className="w-4 h-4" /> Nova Vaga
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar vaga..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Table Card */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <ParkingSquare className="w-10 h-10 opacity-30" />
              <p className="text-sm">{search ? "Nenhuma vaga encontrada." : "Nenhuma vaga cadastrada ainda."}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={openCreate} className="gap-2 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Cadastrar primeira vaga
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Número</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Descrição</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <ParkingSquare className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {v.numero}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                        {v.descricao || <span className="italic opacity-50">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={v.status === "ativa" ? "default" : "secondary"}
                          className={v.status === "ativa" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
                        >
                          {v.status === "ativa" ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            title={v.status === "ativa" ? "Desativar" : "Ativar"}
                            onClick={() => toggleMutation.mutate({ id: v.id })}
                          >
                            {v.status === "ativa" ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(v)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(v.id)}
                          >
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

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editVaga ? "Editar Vaga" : "Nova Vaga"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número da Vaga <span className="text-destructive">*</span></Label>
              <Input
                id="numero"
                placeholder="Ex: 01, A-15, B-03"
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                placeholder="Ex: Próxima ao elevador, coberta..."
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "ativa" | "inativa" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editVaga ? "Salvar Alterações" : "Cadastrar Vaga"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Vaga</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta vaga? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
