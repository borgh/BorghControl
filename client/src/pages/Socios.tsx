import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";

function ModalSocio({ open, onClose, socio, onSaved }: {
  open: boolean; onClose: () => void;
  socio?: { id: number; nome: string; email?: string | null; telefone?: string | null; documento?: string | null; observacao?: string | null } | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(socio?.nome ?? "");
  const [email, setEmail] = useState(socio?.email ?? "");
  const [telefone, setTelefone] = useState(socio?.telefone ?? "");
  const [documento, setDocumento] = useState(socio?.documento ?? "");
  const [observacao, setObservacao] = useState(socio?.observacao ?? "");
  const utils = trpc.useUtils();
  const create = trpc.projetos.createSocio.useMutation({
    onSuccess: () => { toast.success("Sócio cadastrado!"); utils.projetos.listSocios.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.projetos.updateSocio.useMutation({
    onSuccess: () => { toast.success("Sócio atualizado!"); utils.projetos.listSocios.invalidate(); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (socio) {
      update.mutate({ id: socio.id, nome, email: email || undefined, telefone: telefone || undefined, documento: documento || undefined, observacao: observacao || undefined });
    } else {
      create.mutate({ nome, email: email || undefined, telefone: telefone || undefined, documento: documento || undefined, observacao: observacao || undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{socio ? "Editar Sócio" : "Novo Sócio"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></div>
          <div><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
          <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div>
          <div><Label>CPF/CNPJ</Label><Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00" /></div>
          <div><Label>Observação</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Socios() {
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editSocio, setEditSocio] = useState<any | null>(null);
  const utils = trpc.useUtils();
  const { data: socios = [], isLoading } = trpc.projetos.listSocios.useQuery(busca ? { busca } : undefined);
  const deleteSocio = trpc.projetos.deleteSocio.useMutation({
    onSuccess: () => { toast.success("Sócio removido!"); utils.projetos.listSocios.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sócios</h1>
          <p className="text-muted-foreground text-sm">Cadastro de sócios dos projetos</p>
        </div>
        <Button onClick={() => { setEditSocio(null); setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Sócio
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar sócios..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : socios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum sócio cadastrado</p>
          <p className="text-sm">Clique em "Novo Sócio" para começar</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">E-mail</th>
                <th className="text-left p-3 font-medium">Telefone</th>
                <th className="text-left p-3 font-medium">CPF/CNPJ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {socios.map((s, idx) => (
                <tr key={s.id} className={`border-t hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="p-3 font-medium">{s.nome}</td>
                  <td className="p-3 text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.telefone ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.documento ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditSocio(s); setShowModal(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Excluir "${s.nome}"?`)) deleteSocio.mutate({ id: s.id }); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ModalSocio
          open={showModal}
          onClose={() => { setShowModal(false); setEditSocio(null); }}
          socio={editSocio}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
