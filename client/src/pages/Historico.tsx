import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  History, Calendar, Building2, ParkingSquare, User, Eye, Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Historico() {
  const [, setLocation] = useLocation();
  const { data: sorteios = [], isLoading } = trpc.historico.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Histórico de Sorteios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sorteios.length} sorteio(s) registrado(s)
          </p>
        </div>
        <Button className="gap-2 h-9" onClick={() => setLocation("/sorteio")}>
          <Shuffle className="w-4 h-4" /> Novo Sorteio
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : sorteios.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <History className="w-12 h-12 opacity-25" />
          <p className="text-sm font-medium">Nenhum sorteio realizado ainda.</p>
          <Button variant="outline" size="sm" onClick={() => setLocation("/sorteio")} className="gap-2 mt-1">
            <Shuffle className="w-3.5 h-3.5" /> Realizar primeiro sorteio
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorteios.map((s: any, index: number) => (
            <Card
              key={s.id}
              className="border border-border hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => setLocation(`/resultado/${s.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shuffle className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">Sorteio #{s.id}</span>
                      <Badge variant="secondary" className="text-xs">
                        {index === 0 ? "Mais recente" : `${index + 1}º`}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>{new Date(s.realizadoEm).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span>{s.totalParticipantes} participantes</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ParkingSquare className="w-3 h-3 flex-shrink-0" />
                        <span>{s.totalVagas} vagas</span>
                      </div>
                      {s.responsavelNome && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span>{s.responsavelNome}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-shrink-0 h-8 text-xs no-print"
                    onClick={(e) => { e.stopPropagation(); setLocation(`/resultado/${s.id}`); }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver resultado
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
