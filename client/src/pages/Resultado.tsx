import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  CheckCircle2, Download, FileSpreadsheet, Printer, ArrowLeft, ParkingSquare, Building2, User, Calendar, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type ResultadoItem = {
  apartamentoId: number;
  apartamentoNumero: string;
  apartamentoBloco: string | null;
  apartamentoResponsavel: string | null;
  vagaId: number;
  vagaNumero: string;
  vagaDescricao: string | null;
};

interface ResultadoProps {
  id: number;
}

export default function Resultado({ id }: ResultadoProps) {
  const [, setLocation] = useLocation();
  const { data: sorteio, isLoading } = trpc.historico.getById.useQuery({ id });

  const resultado: ResultadoItem[] = sorteio ? (sorteio.resultado as unknown as ResultadoItem[]) : [];

  const exportPDF = async () => {
    if (!sorteio) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.setTextColor(30, 64, 175);
      doc.text("VagaWin — Resultado do Sorteio", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Sorteio #${sorteio.id}`, 14, 28);
      doc.text(`Data: ${new Date(sorteio.realizadoEm).toLocaleString("pt-BR")}`, 14, 34);
      doc.text(`Responsável: ${sorteio.responsavelNome ?? "—"}`, 14, 40);
      doc.text(`Participantes: ${sorteio.totalParticipantes} | Vagas: ${sorteio.totalVagas}`, 14, 46);

      autoTable(doc, {
        startY: 54,
        head: [["#", "Apartamento", "Bloco/Torre", "Responsável", "Vaga Sorteada", "Descrição"]],
        body: resultado.map((r, i) => [
          i + 1,
          `Apto ${r.apartamentoNumero}`,
          r.apartamentoBloco ?? "—",
          r.apartamentoResponsavel ?? "—",
          `Vaga ${r.vagaNumero}`,
          r.vagaDescricao ?? "—",
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });

      doc.save(`vagawin-sorteio-${sorteio.id}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar PDF.");
    }
  };

  const exportExcel = async () => {
    if (!sorteio) return;
    try {
      const XLSX = await import("xlsx");
      const wsData = [
        ["VagaWin — Resultado do Sorteio"],
        [`Sorteio #${sorteio.id}`, `Data: ${new Date(sorteio.realizadoEm).toLocaleString("pt-BR")}`],
        [`Responsável: ${sorteio.responsavelNome ?? "—"}`, `Participantes: ${sorteio.totalParticipantes}`, `Vagas: ${sorteio.totalVagas}`],
        [],
        ["#", "Apartamento", "Bloco/Torre", "Responsável", "Vaga Sorteada", "Descrição da Vaga"],
        ...resultado.map((r, i) => [
          i + 1,
          `Apto ${r.apartamentoNumero}`,
          r.apartamentoBloco ?? "",
          r.apartamentoResponsavel ?? "",
          `Vaga ${r.vagaNumero}`,
          r.vagaDescricao ?? "",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 24 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resultado");
      XLSX.writeFile(wb, `vagawin-sorteio-${sorteio.id}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar Excel.");
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!sorteio) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-muted-foreground">Sorteio não encontrado.</p>
        <Button variant="outline" onClick={() => setLocation("/historico")}>Ver Histórico</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/historico")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Resultado do Sorteio</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Sorteio #{sorteio.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={exportPDF}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={exportExcel}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print-only">
        <h1 className="text-2xl font-bold">VagaWin — Resultado do Sorteio #{sorteio.id}</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Hash, label: "Sorteio", value: `#${sorteio.id}`, color: "text-blue-700", bg: "bg-blue-50" },
          { icon: Calendar, label: "Realizado em", value: new Date(sorteio.realizadoEm).toLocaleDateString("pt-BR"), color: "text-indigo-700", bg: "bg-indigo-50" },
          { icon: Building2, label: "Participantes", value: sorteio.totalParticipantes, color: "text-violet-700", bg: "bg-violet-50" },
          { icon: ParkingSquare, label: "Vagas Sorteadas", value: resultado.length, color: "text-emerald-700", bg: "bg-emerald-50" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold text-foreground truncate">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Responsável */}
      {sorteio.responsavelNome && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2.5">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Responsável pelo sorteio: <strong className="text-foreground">{sorteio.responsavelNome}</strong></span>
        </div>
      )}

      {/* Resultado Table */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-base">Resultado Completo</CardTitle>
            <Badge variant="secondary" className="ml-auto">{resultado.length} atribuições</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Apartamento</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Bloco</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Responsável</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Vaga Sorteada</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resultado.map((r, i) => (
                  <tr key={r.apartamentoId} className="hover:bg-muted/30 transition-colors animate-result-reveal" style={{ animationDelay: `${i * 30}ms` }}>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs font-medium">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3 h-3 text-indigo-600" />
                        </div>
                        <span className="font-semibold text-foreground">Apto {r.apartamentoNumero}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {r.apartamentoBloco || <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                      {r.apartamentoResponsavel || <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <ParkingSquare className="w-3 h-3 text-blue-700" />
                        </div>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 font-semibold">
                          Vaga {r.vagaNumero}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                      {r.vagaDescricao || <span className="italic opacity-50">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Button variant="outline" className="gap-2" onClick={() => setLocation("/sorteio")}>
          <ParkingSquare className="w-4 h-4" /> Novo Sorteio
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setLocation("/historico")}>
          Ver Histórico Completo
        </Button>
      </div>
    </div>
  );
}
