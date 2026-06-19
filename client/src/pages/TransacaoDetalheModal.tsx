import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Pencil, Check, RotateCcw, CalendarDays, Tag, CreditCard,
  FileText, Repeat, Infinity, TrendingDown, TrendingUp, ExternalLink, Flame, AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Link } from "wouter";
import { AnexosDetalheSection } from "@/components/AnexosBadge";
import { isEmAtraso } from "./Despesas";

const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface TransacaoDetalheModalProps {
  open: boolean;
  item: any | null;
  onClose: () => void;
  onEdit: (item: any) => void;
  onRefresh: () => void;
  /** Quando true, substitui o botão Editar por um link "Ver em [Despesas/Receitas]" */
  editAsLink?: boolean;
}

function StatusBadgeLg({ status, tipo, item }: { status: string; tipo: string; item?: any }) {
  if (status === "pendente") {
    if (item && isEmAtraso(item)) {
      return (
        <Badge className="text-sm px-3 py-1 gap-1 bg-red-100 text-red-800 border border-red-400 hover:bg-red-100">
          <AlertTriangle className="h-3.5 w-3.5" /> Em Atraso
        </Badge>
      );
    }
    return (
      <Badge className="text-sm px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
        Pendente
      </Badge>
    );
  }
  if (status === "cancelado") {
    return (
      <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">
        Cancelado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-sm px-3 py-1 text-emerald-700 border-emerald-200 bg-emerald-50">
      {tipo === "receita" ? "Recebido" : "Pago"}
    </Badge>
  );
}

export function TransacaoDetalheModal({ open, item, onClose, onEdit, onRefresh, editAsLink }: TransacaoDetalheModalProps) {
  const utils = trpc.useUtils();
  const { can } = usePermissions();

  const invalidate = () => {
    utils.transacoes.list.invalidate();
    utils.relatorios.dashboard.invalidate();
    onRefresh();
  };

  const marcarPago = trpc.transacoes.marcarPago.useMutation({
    onSuccess: () => { toast.success(item?.tipo === "receita" ? "Marcado como recebido!" : "Marcado como pago!"); invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const marcarPendente = trpc.transacoes.marcarPendente.useMutation({
    onSuccess: () => { toast.success("Marcado como pendente!"); invalidate(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!item) return null;

  const isDespesa = item.tipo === "despesa";
  const isPendente = item.status === "pendente";
  const isPago = item.status === "pago";

  // Data de vencimento formatada
  const dataVencFormatada = item.dataVencimento
    ? new Date(item.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : item.diaVencimento
      ? `Dia ${item.diaVencimento} de cada mês`
      : null;

  // Tipo de recorrência
  const tipoRecorrencia = !item.recorrente
    ? "Pagamento Único"
    : item.totalParcelas == null
      ? "Contrato Mensal"
      : `Parcelado (${item.parcelaAtual}/${item.totalParcelas})`;

  const RecIcon = !item.recorrente ? CalendarDays : item.totalParcelas == null ? Infinity : Repeat;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isDespesa ? "bg-red-100" : "bg-emerald-100"}`}>
              {isDespesa
                ? <TrendingDown className="h-4 w-4 text-red-600" />
                : <TrendingUp className="h-4 w-4 text-emerald-600" />
              }
            </div>
            <span className="truncate">{item.descricao}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Valor + Status */}
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Valor</p>
              <p className={`text-2xl font-bold tabular-nums ${isDespesa ? "text-red-600" : "text-emerald-600"}`}>
                {fmt(Number(item.valor))}
              </p>
            </div>
            <StatusBadgeLg status={item.status} tipo={item.tipo} item={item} />
          </div>

          {/* Detalhes em grade */}
          <div className="space-y-2.5">
            {/* Mês/Ano */}
            <div className="flex items-start gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Competência</p>
                <p className="text-sm font-medium">{MESES[item.mes]}/{item.ano}</p>
              </div>
            </div>

            {/* Vencimento */}
            {dataVencFormatada && (
              <div className="flex items-start gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Vencimento</p>
                  <p className="text-sm font-medium">{dataVencFormatada}</p>
                </div>
              </div>
            )}

            {/* Categoria */}
            {item.categoriaNome && (
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex items-center gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Categoria</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.categoriaCor && (
                        <span className="h-3 w-3 rounded-full shrink-0 inline-block" style={{ background: item.categoriaCor }} />
                      )}
                      <p className="text-sm font-medium">{item.categoriaNome}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Forma de pagamento */}
            {item.formaPagamento && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Forma de Pagamento</p>
                  <p className="text-sm font-medium">{item.formaPagamento}</p>
                </div>
              </div>
            )}

            {/* Tipo de lançamento */}
            <div className="flex items-start gap-3">
              <RecIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Tipo</p>
                <p className="text-sm font-medium">{tipoRecorrencia}</p>
              </div>
            </div>

            {/* Prioridade (somente despesas) */}
            {item.tipo === "despesa" && (
              <div className="flex items-start gap-3">
                <Flame className={`h-4 w-4 mt-0.5 shrink-0 ${item.prioridade ? "text-orange-500" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Prioridade</p>
                  {item.prioridade ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                      Alta Prioridade
                      <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                    </span>
                  ) : (
                    <p className="text-sm text-muted-foreground">Prioridade normal</p>
                  )}
                </div>
              </div>
            )}

            {/* Nota Fiscal (somente receitas) */}
            {item.tipo === "receita" && (
              <div className="flex items-start gap-3">
                <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${item.emitirNF ? "text-blue-500" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Nota Fiscal</p>
                  {item.emitirNF ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                      Emitir NF
                      <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                    </span>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem nota fiscal</p>
                  )}
                </div>
              </div>
            )}

            {/* Observação */}
            {item.observacao && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Observação</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.observacao}</p>
                  </div>
                </div>
              </>
            )}

            {/* Anexos (somente despesas) */}
            {isDespesa && (
              <>
                <Separator />
                <AnexosDetalheSection transacaoId={item.id} />
              </>
            )}
          </div>

          {/* Ações */}
          <Separator />
          <div className="flex gap-2 flex-wrap">
            {/* Marcar pago / pendente */}
            {isPendente && can("mark_paid") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => marcarPago.mutate({ id: item.id })}
                disabled={marcarPago.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {item.tipo === "receita" ? "Marcar Recebido" : "Marcar Pago"}
              </Button>
            )}
            {isPago && can("mark_paid") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => marcarPendente.mutate({ id: item.id })}
                disabled={marcarPendente.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Marcar Pendente
              </Button>
            )}

            <div className="flex-1" />

            {/* Editar / Ver na página */}
            {can("edit_lancamentos") && (
              editAsLink ? (
                <Link href={item?.tipo === "receita" ? "/receitas" : "/despesas"}>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={onClose}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver {item?.tipo === "receita" ? "Receitas" : "Despesas"}
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { onClose(); onEdit(item); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
