import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PiggyBank, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Banner do dia do salário: a partir do dia configurado, lembra de separar o "Investir X%"
 * das receitas do mês ainda não investidas, com um botão que marca tudo como investido.
 * Pode ser dispensado por mês (guardado só neste navegador).
 */
export default function LembreteSalarioBanner() {
  const { data } = trpc.orcamento.lembreteSalario.useQuery();
  const chave = data ? `salario-dispensado-${data.ano}-${data.mes}` : "";
  const [dispensado, setDispensado] = useState(() => { try { return !!chave && localStorage.getItem(chave) === "1"; } catch { return false; } });
  const separar = trpc.orcamento.separarPoupanca.useMutation({
    onSuccess: (r) => toast.success(`${r.marcadas} receita(s) marcada(s) como investida(s). Bom trabalho!`),
    onError: (e) => toast.error(e.message),
  });

  if (!data || !data.diaSalario || !data.ehHoje || data.receitas.length === 0 || data.totalSeparar <= 0) return null;
  const dispensadoAgora = (() => { try { return localStorage.getItem(chave) === "1"; } catch { return false; } })();
  if (dispensado || dispensadoAgora) return null;

  const dismiss = () => { try { localStorage.setItem(chave, "1"); } catch {} setDispensado(true); };

  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
        <PiggyBank className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Dia do salário — separe os {data.pct}% agora
        </p>
        <p className="text-xs text-emerald-800/80">
          {data.receitas.length === 1
            ? <>{data.receitas[0].descricao}: guarde <strong>{fmt(data.totalSeparar)}</strong> ({data.pct}% de {fmt(data.receitas[0].valor)}).</>
            : <>{data.receitas.length} receitas deste mês ainda sem a poupança separada — total a guardar: <strong>{fmt(data.totalSeparar)}</strong>.</>}
          {" "}Assim que o dinheiro cair, a regra é mexer na poupança primeiro.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" className="h-8 gap-1.5" disabled={separar.isPending} onClick={() => separar.mutate({ ids: data.receitas.map((r) => r.id) })}>
          <PiggyBank className="h-3.5 w-3.5" /> Já separei {fmt(data.totalSeparar)}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-800" onClick={dismiss} aria-label="Dispensar este mês"><X className="h-4 w-4" /></Button>
      </div>
      <Link href="/configuracoes" className="sr-only">Configurar dia do salário</Link>
    </div>
  );
}
