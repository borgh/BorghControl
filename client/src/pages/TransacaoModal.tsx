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
import { Loader2, CalendarDays, Repeat, Hash, Infinity, FileEdit, ArrowRight, LayoutList } from "lucide-react";

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
type EscopoEdicao = "apenas_este" | "este_e_futuros" | "todos";

const RECORRENCIA_LABELS: Record<TipoRecorrencia, { label: string; desc: string; icon: React.ReactNode }> = {
  unico: { label: "Pagamento Único", desc: "Ocorre apenas uma vez", icon: <CalendarDays className="h-4 w-4" /> },
  parcelas: { label: "Parcelado", desc: "Repete por N meses", icon: <Hash className="h-4 w-4" /> },
  contrato: { label: "Contrato Mensal", desc: "Repete todo mês permanentemente", icon: <Infinity className="h-4 w-4" /> },
};

// Diálogo de seleção de escopo
interface EscopoDialogProps {
  open: boolean;
  tipoRecorrencia: TipoRecorrencia;
  parcelaAtual?: number;
  totalParcelas?: number | null;
  onSelect: (escopo: EscopoEdicao) => void;
  onCancel: () => void;
}

function EscopoDialog({ open, tipoRecorrencia, parcelaAtual, totalParcelas, onSelect, onCancel }: EscopoDialogProps) {
  const isContrato = tipoRecorrencia === "contrato";
  const labelTipo = isContrato ? "contrato" : "série de parcelas";

  const opcoes: { escopo: EscopoEdicao; icon: React.ReactNode; titulo: string; desc: string }[] = [
    {
      escopo: "apenas_este",
      icon: <FileEdit className="h-5 w-5" />,
      titulo: "Apenas este lançamento",
      desc: parcelaAtual
        ? `Somente a parcela ${parcelaAtual}${totalParcelas ? `/${totalParcelas}` : ""} será alterada`
        : "Somente este lançamento será alterado",
    },
    {
      escopo: "este_e_futuros",
      icon: <ArrowRight className="h-5 w-5" />,
      titulo: "Este e os futuros",
      desc: `Este lançamento e todos os próximos do ${labelTipo} serão atualizados`,
    },
    {
      escopo: "todos",
      icon: <LayoutList className="h-5 w-5" />,
      titulo: "Todos os lançamentos",
      desc: `Todos os lançamentos desta ${isContrato ? "série" : "série de parcelas"} serão atualizados`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Qual alteração deseja fazer?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Este lançamento faz parte de um{isContrato ? " contrato mensal" : "a série de parcelas"}.
          Escolha o que deseja alterar:
        </p>
        <div className="space-y-2 pt-1">
          {opcoes.map(({ escopo, icon, titulo, desc }) => (
            <button
              key={escopo}
              type="button"
              onClick={() => onSelect(escopo)}
              className="w-full rounded-lg border border-border p-3.5 text-left hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground group-hover:text-primary transition-colors">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full mt-1">
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

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

  // Estado do diálogo de escopo
  const [escopoDialogOpen, setEscopoDialogOpen] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

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

  const updateRecorrenciaMut = trpc.transacoes.updateComRecorrencia.useMutation({
    onSuccess: (res: any) => {
      const escopo = pendingData?.escopo;
      if (escopo === "apenas_este") {
        toast.success("Lançamento atualizado!");
      } else if (escopo === "todos") {
        toast.success("Todos os lançamentos da série foram atualizados!");
      } else {
        const count = (res?.created?.length ?? 0) + 1;
        if (count > 1) {
          toast.success(`Lançamento atualizado! ${count - 1} parcelas futuras regeradas.`);
        } else {
          toast.success("Lançamento atualizado!");
        }
      }
      setPendingData(null);
      invalidate();
      onSuccess();
      onClose();
    },
    onError: (e) => { toast.error(e.message); setPendingData(null); },
  });

  const loading = createMut.isPending || updateMut.isPending || updateRecorrenciaMut.isPending;
  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // Executar a mutation com o escopo escolhido
  const executarUpdate = (escopo: EscopoEdicao) => {
    if (!pendingData) return;
    setEscopoDialogOpen(false);
    updateRecorrenciaMut.mutate({ ...pendingData, escopo });
  };

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
      if (!recorrente) {
        // Edição simples (único): apenas atualiza este registro
        updateMut.mutate({ id: editItem.id, ...data, recorrente: false });
      } else if (editItem.recorrenciaGrupoId) {
        // Lançamento que já faz parte de uma série → perguntar o escopo
        const payload = {
          id: editItem.id,
          descricao: data.descricao,
          valor: data.valor,
          tipo: data.tipo,
          status: data.status,
          dataVencimento: data.dataVencimento,
          diaVencimento: data.diaVencimento,
          vencimentoTexto: data.vencimentoTexto,
          mes: data.mes,
          ano: data.ano,
          categoriaId: data.categoriaId ?? null,
          formaPagamento: data.formaPagamento,
          observacao: data.observacao,
          recorrente: true,
          totalParcelas: totalParcelas ?? null,
        };
        setPendingData(payload);
        setEscopoDialogOpen(true);
      } else {
        // Lançamento recorrente mas sem grupo ainda (novo tipo de recorrência)
        updateRecorrenciaMut.mutate({
          id: editItem.id,
          descricao: data.descricao,
          valor: data.valor,
          tipo: data.tipo,
          status: data.status,
          dataVencimento: data.dataVencimento,
          diaVencimento: data.diaVencimento,
          vencimentoTexto: data.vencimentoTexto,
          mes: data.mes,
          ano: data.ano,
          categoriaId: data.categoriaId ?? null,
          formaPagamento: data.formaPagamento,
          observacao: data.observacao,
          recorrente: true,
          totalParcelas: totalParcelas ?? null,
          escopo: "este_e_futuros",
        });
      }
    } else {
      createMut.mutate(data);
    }
  };

  const isEdit = !!editItem;
  const labelTipo = tipo === "despesa" ? "Despesa" : "Receita";
  const labelPago = tipo === "despesa" ? "Pago" : "Recebido";

  return (
    <>
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

            {/* Tipo de Recorrência */}
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

              {tipoRecorrencia === "contrato" && !isEdit && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                  Serão gerados lançamentos para os próximos <strong>24 meses</strong>. Você pode excluir parcelas futuras a qualquer momento.
                </div>
              )}

              {isEdit && tipoRecorrencia === "unico" && editItem?.recorrenciaGrupoId && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Ao mudar para Pagamento Único, apenas <strong>este lançamento</strong> será alterado. As demais parcelas do grupo permanecem.
                </div>
              )}
            </div>

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

      {/* Diálogo de seleção de escopo */}
      <EscopoDialog
        open={escopoDialogOpen}
        tipoRecorrencia={tipoRecorrencia}
        parcelaAtual={editItem?.parcelaAtual}
        totalParcelas={editItem?.totalParcelas}
        onSelect={executarUpdate}
        onCancel={() => { setEscopoDialogOpen(false); setPendingData(null); }}
      />
    </>
  );
}
