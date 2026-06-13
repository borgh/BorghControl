import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CalendarDays, Repeat, Hash, Infinity } from "lucide-react";

interface TransacaoModalProps {
  open: boolean;
  onClose: () => void;
  tipo: "despesa" | "receita";
  editItem?: any;
  onSuccess: () => void;
}

const FORMAS = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Transferência", "Boleto", "Outro"];

// Tipos de recorrência
type TipoRecorrencia = "unico" | "parcelas" | "contrato";

const RECORRENCIA_LABELS: Record<TipoRecorrencia, { label: string; desc: string; icon: React.ReactNode }> = {
  unico: { label: "Pagamento Único", desc: "Ocorre apenas uma vez", icon: <CalendarDays className="h-4 w-4" /> },
  parcelas: { label: "Parcelado", desc: "Repete por N meses", icon: <Hash className="h-4 w-4" /> },
  contrato: { label: "Contrato Mensal", desc: "Repete todo mês permanentemente", icon: <Infinity className="h-4 w-4" /> },
};

export function TransacaoModal({ open, onClose, tipo, editItem, onSuccess }: TransacaoModalProps) {
  const utils = trpc.useUtils();
  const { data: cats } = trpc.categorias.list.useQuery({ tipo });
  const hoje = new Date();

  // Determinar tipo de recorrência a partir do item editado
  function getTipoRecorrencia(item: any): TipoRecorrencia {
    if (!item || !item.recorrente) return "unico";
    if (item.totalParcelas == null) return "contrato";
    return "parcelas";
  }

  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>("unico");
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    dataVencimento: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`,
    categoriaId: "",
    formaPagamento: "",
    observacao: "",
    status: "pendente" as "pendente" | "pago" | "cancelado",
    totalParcelas: "2",
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      // Montar dataVencimento a partir dos campos existentes
      let dataVenc = editItem.dataVencimento ?? "";
      if (!dataVenc && editItem.mes && editItem.ano) {
        const dia = editItem.diaVencimento ?? 1;
        dataVenc = `${editItem.ano}-${String(editItem.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      }
      setTipoRecorrencia(getTipoRecorrencia(editItem));
      setForm({
        descricao: editItem.descricao ?? "",
        valor: String(editItem.valor ?? ""),
        dataVencimento: dataVenc,
        categoriaId: editItem.categoriaId ? String(editItem.categoriaId) : "",
        formaPagamento: editItem.formaPagamento ?? "",
        observacao: editItem.observacao ?? "",
        status: editItem.status ?? "pendente",
        totalParcelas: editItem.totalParcelas ? String(editItem.totalParcelas) : "2",
      });
    } else {
      const d = new Date();
      setTipoRecorrencia("unico");
      setForm({
        descricao: "",
        valor: "",
        dataVencimento: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        categoriaId: "",
        formaPagamento: "",
        observacao: "",
        status: "pendente",
        totalParcelas: "2",
      });
    }
  }, [editItem, open]);

  const invalidate = () => {
    utils.transacoes.list.invalidate();
    utils.relatorios.dashboard.invalidate();
  };

  const createMut = trpc.transacoes.create.useMutation({
    onSuccess: (res) => {
      const count = (res as any)?.created?.length ?? 1;
      if (count > 1) {
        toast.success(`${count} lançamentos criados com sucesso!`);
      } else {
        toast.success("Lançamento criado!");
      }
      invalidate();
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.transacoes.update.useMutation({
    onSuccess: () => { toast.success("Lançamento atualizado!"); invalidate(); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const loading = createMut.isPending || updateMut.isPending;
  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Extrair mes/ano/dia da dataVencimento
    const [anoStr, mesStr, diaStr] = (form.dataVencimento || "").split("-");
    const mes = parseInt(mesStr ?? "1");
    const ano = parseInt(anoStr ?? String(hoje.getFullYear()));
    const dia = parseInt(diaStr ?? "1");

    if (!mes || !ano || isNaN(mes) || isNaN(ano)) {
      toast.error("Data de vencimento inválida.");
      return;
    }

    const recorrente = tipoRecorrencia !== "unico";
    const totalParcelas = tipoRecorrencia === "parcelas"
      ? (parseInt(form.totalParcelas) || 2)
      : tipoRecorrencia === "contrato"
        ? null
        : undefined;

    const data = {
      descricao: form.descricao,
      valor: Number(form.valor),
      tipo,
      status: form.status,
      dataVencimento: form.dataVencimento || undefined,
      diaVencimento: dia || undefined,
      vencimentoTexto: dia ? `DIA ${String(dia).padStart(2, "0")}` : undefined,
      mes,
      ano,
      categoriaId: form.categoriaId ? Number(form.categoriaId) : undefined,
      formaPagamento: form.formaPagamento || undefined,
      observacao: form.observacao || undefined,
      recorrente,
      totalParcelas,
    };

    if (editItem) {
      // Edição: atualiza apenas este registro
      updateMut.mutate({ id: editItem.id, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  const isEdit = !!editItem;
  const labelTipo = tipo === "despesa" ? "Despesa" : "Receita";
  const labelPago = tipo === "despesa" ? "Pago" : "Recebido";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? "Editar" : "Nova"} {tipo === "despesa" ? "Conta a Pagar" : "Conta a Receber"}
            {isEdit && editItem?.recorrenciaGrupoId && (
              <Badge variant="outline" className="text-xs font-normal">
                {editItem.totalParcelas == null ? "Contrato" : `Parcela ${editItem.parcelaAtual}/${editItem.totalParcelas}`}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input
              placeholder={tipo === "despesa" ? "Ex: Aluguel, Conta de Luz..." : "Ex: Salário, Serviço de T.I..."}
              value={form.descricao}
              onChange={(e) => f("descricao", e.target.value)}
              required
            />
          </div>

          {/* Valor + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                type="number" step="0.01" min="0.01" placeholder="0,00"
                value={form.valor}
                onChange={(e) => f("valor", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => f("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">{labelPago}</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-1.5">
            <Label>Data de Vencimento *</Label>
            <Input
              type="date"
              value={form.dataVencimento}
              onChange={(e) => f("dataVencimento", e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Mês e ano são extraídos automaticamente desta data.
            </p>
          </div>

          {/* Tipo de Recorrência — apenas na criação */}
          {!isEdit && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" /> Tipo de Lançamento
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(RECORRENCIA_LABELS) as [TipoRecorrencia, typeof RECORRENCIA_LABELS[TipoRecorrencia]][]).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTipoRecorrencia(key)}
                    className={`rounded-lg border p-2.5 text-left transition-all ${
                      tipoRecorrencia === key
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className={`mb-1 ${tipoRecorrencia === key ? "text-primary" : "text-muted-foreground"}`}>
                      {info.icon}
                    </div>
                    <p className="text-xs font-semibold leading-tight">{info.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{info.desc}</p>
                  </button>
                ))}
              </div>

              {/* Campo de parcelas */}
              {tipoRecorrencia === "parcelas" && (
                <div className="space-y-1.5 pt-1">
                  <Label>Número de Parcelas *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="2" max="360"
                      value={form.totalParcelas}
                      onChange={(e) => f("totalParcelas", e.target.value)}
                      className="w-28"
                      required
                    />
                    <span className="text-sm text-muted-foreground">
                      meses (a partir de {form.dataVencimento ? new Date(form.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—"})
                    </span>
                  </div>
                </div>
              )}

              {tipoRecorrencia === "contrato" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                  Serão gerados lançamentos para os próximos <strong>24 meses</strong>. Você pode excluir parcelas futuras a qualquer momento.
                </div>
              )}
            </div>
          )}

          {/* Categoria + Forma de Pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoriaId || "none"} onValueChange={(v) => f("categoriaId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {(cats ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={form.formaPagamento || "none"} onValueChange={(v) => f("formaPagamento", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {FORMAS.map((fm) => <SelectItem key={fm} value={fm}>{fm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              placeholder="Observações opcionais..."
              value={form.observacao}
              onChange={(e) => f("observacao", e.target.value)}
              rows={2}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit
                ? "Salvar Alterações"
                : tipoRecorrencia === "unico"
                  ? `Criar ${labelTipo}`
                  : tipoRecorrencia === "parcelas"
                    ? `Criar ${form.totalParcelas || "?"} Parcelas`
                    : "Criar Contrato Mensal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
