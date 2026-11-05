import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, RefreshCw, Infinity, X, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

/**
 * Banner com os contratos mensais (12/24 meses) que terminam nos próximos 60 dias.
 * Em cada um: Renovar +24 (destaque), +12, Tornar indeterminado, Deixar encerrar.
 * `tipo` filtra despesas ou receitas (Contas a Pagar / Receber); sem `tipo` mostra tudo (Dashboard).
 */
export default function AvisosTerminoContratos({ tipo }: { tipo?: "despesa" | "receita" }) {
  const { data } = trpc.recorrencias.avisosTermino.useQuery();
  const [aberto, setAberto] = useState(true);
  const avisos = (data ?? []).filter((a) => !tipo || a.tipo === tipo);

  const renovar = trpc.recorrencias.renovar.useMutation({
    onSuccess: (r, v) => toast.success(`Contrato renovado por mais ${v.meses} meses (${r.criados} lançamentos gerados, até ${MESES[r.fim.mes]}/${r.fim.ano}).`),
    onError: (e) => toast.error(e.message),
  });
  const indeterminar = trpc.recorrencias.tornarIndeterminada.useMutation({
    onSuccess: () => toast.success("Contrato agora é indeterminado — não precisa mais renovar."),
    onError: (e) => toast.error(e.message),
  });
  const dispensar = trpc.recorrencias.dispensarAviso.useMutation({
    onSuccess: () => toast.success("Ok, o contrato vai encerrar no fim do prazo."),
    onError: (e) => toast.error(e.message),
  });
  const ocupado = renovar.isPending || indeterminar.isPending || dispensar.isPending;

  if (avisos.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {avisos.length === 1 ? "1 contrato termina em breve" : `${avisos.length} contratos terminam em breve`}
          </p>
          <p className="text-xs text-amber-800/80">
            Renove com um clique ou torne indeterminado para não precisar renovar mais.
          </p>
        </div>
        {aberto ? <ChevronUp className="h-4 w-4 text-amber-700" /> : <ChevronDown className="h-4 w-4 text-amber-700" />}
      </button>

      {aberto && (
        <div className="divide-y divide-amber-200 border-t border-amber-200">
          {avisos.map((a) => {
            const venceu = a.diasRestantes < 0;
            return (
              <div key={a.grupoId} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.tipo === "despesa" ? "Conta a pagar" : "Conta a receber"} · {fmt(a.valor)}/mês · última parcela em{" "}
                    <strong>{MESES[a.mesFim]}/{a.anoFim}</strong>
                    {" · "}
                    <span className={venceu ? "text-red-600 font-semibold" : a.diasRestantes <= 15 ? "text-red-600 font-semibold" : "text-amber-700 font-semibold"}>
                      {venceu ? `terminou há ${Math.abs(a.diasRestantes)} dia(s)` : a.diasRestantes === 0 ? "termina hoje" : `termina em ${a.diasRestantes} dia(s)`}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="gap-1.5 h-8" disabled={ocupado} onClick={() => renovar.mutate({ grupoId: a.grupoId, meses: 24 })}>
                    <RefreshCw className="h-3.5 w-3.5" /> Renovar +24 meses
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-background" disabled={ocupado} aria-label="Mais opções">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => renovar.mutate({ grupoId: a.grupoId, meses: 12 })}>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" /> Renovar +12 meses
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => indeterminar.mutate({ grupoId: a.grupoId })}>
                        <Infinity className="h-4 w-4 text-muted-foreground" /> Tornar indeterminado
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => dispensar.mutate({ grupoId: a.grupoId })}>
                        <X className="h-4 w-4" /> Deixar encerrar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Mapa grupoId → dias restantes, para a badge "Termina em X dias" nos itens das listas */
export function useAvisosPorGrupo() {
  const { data } = trpc.recorrencias.avisosTermino.useQuery();
  const mapa: Record<string, number> = {};
  for (const a of data ?? []) mapa[a.grupoId] = a.diasRestantes;
  return mapa;
}
