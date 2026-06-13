import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TransacaoModalProps {
  open: boolean;
  onClose: () => void;
  tipo: "despesa" | "receita";
  editItem?: any;
  onSuccess: () => void;
}

const FORMAS = ["Dinheiro","Cartão de Crédito","Cartão de Débito","PIX","Transferência","Boleto","Outro"];

export function TransacaoModal({ open, onClose, tipo, editItem, onSuccess }: TransacaoModalProps) {
  const utils = trpc.useUtils();
  const { data: cats } = trpc.categorias.list.useQuery({ tipo });
  const hoje = new Date();
  const [form, setForm] = useState({
    descricao: "", valor: "", mes: String(hoje.getMonth() + 1), ano: String(hoje.getFullYear()),
    diaVencimento: "", vencimentoTexto: "", categoriaId: "", formaPagamento: "", observacao: "",
    status: "pendente" as "pendente" | "pago" | "cancelado", recorrente: false,
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        descricao: editItem.descricao ?? "",
        valor: String(editItem.valor ?? ""),
        mes: String(editItem.mes ?? hoje.getMonth() + 1),
        ano: String(editItem.ano ?? hoje.getFullYear()),
        diaVencimento: String(editItem.diaVencimento ?? ""),
        vencimentoTexto: editItem.vencimentoTexto ?? "",
        categoriaId: editItem.categoriaId ? String(editItem.categoriaId) : "",
        formaPagamento: editItem.formaPagamento ?? "",
        observacao: editItem.observacao ?? "",
        status: editItem.status ?? "pendente",
        recorrente: editItem.recorrente ?? false,
      });
    } else {
      setForm({ descricao: "", valor: "", mes: String(hoje.getMonth() + 1), ano: String(hoje.getFullYear()), diaVencimento: "", vencimentoTexto: "", categoriaId: "", formaPagamento: "", observacao: "", status: "pendente", recorrente: false });
    }
  }, [editItem, open]);

  const invalidate = () => { utils.transacoes.list.invalidate(); utils.relatorios.dashboard.invalidate(); };

  const createMut = trpc.transacoes.create.useMutation({
    onSuccess: () => { toast.success("Lançamento criado!"); invalidate(); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.transacoes.update.useMutation({
    onSuccess: () => { toast.success("Lançamento atualizado!"); invalidate(); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      descricao: form.descricao, valor: Number(form.valor), tipo,
      status: form.status, mes: Number(form.mes), ano: Number(form.ano),
      diaVencimento: form.diaVencimento ? Number(form.diaVencimento) : undefined,
      vencimentoTexto: form.vencimentoTexto || undefined,
      categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
      formaPagamento: form.formaPagamento || undefined,
      observacao: form.observacao || undefined,
      recorrente: form.recorrente,
    };
    if (editItem) updateMut.mutate({ id: editItem.id, ...data });
    else createMut.mutate(data);
  };

  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar" : "Novo"} {tipo === "despesa" ? "Conta a Pagar" : "Conta a Receber"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input placeholder="Ex: Aluguel, Salário..." value={form.descricao} onChange={(e) => f("descricao", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor} onChange={(e) => f("valor", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => f("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">{tipo === "despesa" ? "Pago" : "Recebido"}</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Mês *</Label>
              <Select value={form.mes} onValueChange={(v) => f("mes", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input type="number" value={form.ano} onChange={(e) => f("ano", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Dia Venc.</Label>
              <Input type="number" min="1" max="31" placeholder="Ex: 15" value={form.diaVencimento} onChange={(e) => f("diaVencimento", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoriaId || "none"} onValueChange={(v) => f("categoriaId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {(cats ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={form.formaPagamento || "none"} onValueChange={(v) => f("formaPagamento", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea placeholder="Observações opcionais..." value={form.observacao} onChange={(e) => f("observacao", e.target.value)} rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editItem ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
