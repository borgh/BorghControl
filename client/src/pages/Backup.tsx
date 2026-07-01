import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Database, Mail, Clock, Calendar, Play, Plus, Trash2, Edit2,
  CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  FileText, FileSpreadsheet, Archive, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = [
  { valor: 0, label: "Dom" },
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
];

function formatarData(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarTamanho(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sucesso") return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5">
      <CheckCircle2 className="h-3 w-3" /> Sucesso
    </Badge>
  );
  if (status === "erro") return (
    <Badge className="bg-red-100 text-red-700 border-red-200 gap-1.5">
      <XCircle className="h-3 w-3" /> Erro
    </Badge>
  );
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5">
      <Loader2 className="h-3 w-3 animate-spin" /> Em andamento
    </Badge>
  );
}

interface AgendamentoForm {
  id?: number;
  ativo: boolean;
  diasSemana: number[] | null;
  horario: string;
  emailDestino: string;
  incluirSql: boolean;
  incluirCsv: boolean;
}

const FORM_VAZIO: AgendamentoForm = {
  ativo: true,
  diasSemana: null,
  horario: "03:00",
  emailDestino: "borgh@smfusion.com.br",
  incluirSql: true,
  incluirCsv: true,
};

export default function Backup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirecionar não-admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const utils = trpc.useUtils();

  // Queries
  const { data: agendamentos = [], isLoading: loadingAg } = trpc.backup.listarAgendamentos.useQuery();
  const { data: logs = [], isLoading: loadingLogs } = trpc.backup.listarLogs.useQuery({ limit: 50 });
  const { data: smtpStatus } = trpc.backup.statusSmtp.useQuery();

  // Mutations
  const salvarMut = trpc.backup.salvarAgendamento.useMutation({
    onSuccess: () => {
      toast.success("Agendamento salvo com sucesso!");
      utils.backup.listarAgendamentos.invalidate();
      setDialogAberto(false);
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const deletarMut = trpc.backup.deletarAgendamento.useMutation({
    onSuccess: () => {
      toast.success("Agendamento removido.");
      utils.backup.listarAgendamentos.invalidate();
      setConfirmarDeletar(null);
    },
    onError: (e) => toast.error("Erro ao deletar: " + e.message),
  });

  const executarMut = trpc.backup.executarManual.useMutation({
    onSuccess: (res) => {
      if (res.sucesso) {
        toast.success(res.mensagem);
      } else {
        toast.error("Backup falhou: " + res.mensagem);
      }
      utils.backup.listarLogs.invalidate();
    },
    onError: (e) => toast.error("Erro ao executar backup: " + e.message),
  });

  // Estado local
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<AgendamentoForm>(FORM_VAZIO);
  const [confirmarDeletar, setConfirmarDeletar] = useState<number | null>(null);
  const [todosOsDias, setTodosOsDias] = useState(true);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setTodosOsDias(true);
    setDialogAberto(true);
  }

  function abrirEditar(ag: any) {
    const dias = ag.diasSemana as number[] | null;
    setTodosOsDias(!dias || dias.length === 0);
    setForm({
      id: ag.id,
      ativo: ag.ativo,
      diasSemana: dias,
      horario: ag.horario,
      emailDestino: ag.email_destino,
      incluirSql: ag.incluir_sql,
      incluirCsv: ag.incluir_csv,
    });
    setDialogAberto(true);
  }

  function toggleDia(dia: number) {
    const atual = form.diasSemana ?? [];
    if (atual.includes(dia)) {
      setForm(f => ({ ...f, diasSemana: atual.filter(d => d !== dia) }));
    } else {
      setForm(f => ({ ...f, diasSemana: [...atual, dia].sort() }));
    }
  }

  function salvar() {
    const diasFinal = todosOsDias ? null : (form.diasSemana ?? []);
    salvarMut.mutate({
      ...form,
      diasSemana: diasFinal,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Backup do Banco de Dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie backups automáticos e manuais com exportação SQL e CSV
          </p>
        </div>
        <Button
          onClick={() => executarMut.mutate({ emailDestino: "borgh@smfusion.com.br", incluirSql: true, incluirCsv: true })}
          disabled={executarMut.isPending}
          className="gap-2 shrink-0"
        >
          {executarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Executar Backup Agora
        </Button>
      </div>

      {/* Status SMTP */}
      <Card className={cn(
        "border",
        smtpStatus?.configurado ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"
      )}>
        <CardContent className="flex items-center gap-3 py-4">
          {smtpStatus?.configurado ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium", smtpStatus?.configurado ? "text-emerald-800" : "text-amber-800")}>
              {smtpStatus?.configurado
                ? `SMTP configurado — envios via ${smtpStatus.host}`
                : "SMTP não configurado — backups serão gerados mas não enviados por email"}
            </p>
            {!smtpStatus?.configurado && (
              <p className="text-xs text-amber-700 mt-0.5">
                Configure as variáveis de ambiente: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS no servidor
              </p>
            )}
          </div>
          <Mail className={cn("h-4 w-4 shrink-0", smtpStatus?.configurado ? "text-emerald-500" : "text-amber-500")} />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="agendamentos">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="agendamentos" className="gap-2">
            <Calendar className="h-4 w-4" /> Agendamentos
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Agendamentos ── */}
        <TabsContent value="agendamentos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {agendamentos.length === 0
                ? "Nenhum agendamento configurado"
                : `${agendamentos.length} agendamento${agendamentos.length > 1 ? "s" : ""} configurado${agendamentos.length > 1 ? "s" : ""}`}
            </p>
            <Button size="sm" onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Agendamento
            </Button>
          </div>

          {loadingAg ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agendamentos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Archive className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum agendamento</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Crie um agendamento para receber backups automáticos por email
                </p>
                <Button size="sm" onClick={abrirNovo} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Criar Agendamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {agendamentos.map((ag: any) => (
                <Card key={ag.id} className={cn("transition-all", !ag.ativo && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Toggle ativo */}
                      <div className="pt-0.5">
                        <Switch
                          checked={ag.ativo}
                          onCheckedChange={(v) => {
                            salvarMut.mutate({
                              id: ag.id,
                              ativo: v,
                              diasSemana: ag.diasSemana,
                              horario: ag.horario,
                              emailDestino: ag.email_destino,
                              incluirSql: ag.incluir_sql,
                              incluirCsv: ag.incluir_csv,
                            });
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {ag.horario}
                          </span>
                          <span className="text-xs text-muted-foreground">—</span>
                          {!ag.diasSemana || ag.diasSemana.length === 0 ? (
                            <Badge variant="secondary" className="text-xs">Todos os dias</Badge>
                          ) : (
                            <div className="flex gap-1">
                              {DIAS_SEMANA.map(d => (
                                <Badge
                                  key={d.valor}
                                  variant={ag.diasSemana.includes(d.valor) ? "default" : "outline"}
                                  className="text-xs px-1.5 py-0"
                                >
                                  {d.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {ag.email_destino}
                          </span>
                          {ag.incluir_sql && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" /> SQL
                            </span>
                          )}
                          {ag.incluir_csv && (
                            <span className="flex items-center gap-1">
                              <FileSpreadsheet className="h-3 w-3" /> CSV
                            </span>
                          )}
                        </div>

                        {ag.proximaExecucao && (
                          <p className="text-xs text-muted-foreground/70">
                            Próxima execução: {formatarData(ag.proximaExecucao)}
                          </p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEditar(ag)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmarDeletar(ag.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba Histórico/Logs ── */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Últimos {logs.length} registros de backup
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => utils.backup.listarLogs.invalidate()}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum backup realizado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Execute um backup manual ou configure um agendamento
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <Card key={log.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={log.status} />
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.tipo === "manual" ? "Manual" : "Agendado"}
                          </Badge>
                          {log.email_enviado && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1 text-xs">
                              <Mail className="h-3 w-3" /> Email enviado
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-foreground">{log.mensagem || "—"}</p>

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatarData(log.iniciado_em)}
                          </span>
                          {log.tamanho_sql > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              SQL: {formatarTamanho(log.tamanho_sql)}
                            </span>
                          )}
                          {log.total_csvs > 0 && (
                            <span className="flex items-center gap-1">
                              <FileSpreadsheet className="h-3 w-3" />
                              {log.total_csvs} CSVs
                            </span>
                          )}
                          {log.email_destino && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {log.email_destino}
                            </span>
                          )}
                        </div>

                        {log.detalhes && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Ver detalhes
                            </summary>
                            <pre className="mt-1.5 text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap font-mono">
                              {log.detalhes}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Criar/Editar Agendamento ── */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {form.id ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Horário */}
            <div className="space-y-1.5">
              <Label htmlFor="horario">Horário do backup</Label>
              <Input
                id="horario"
                type="time"
                value={form.horario}
                onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
              />
            </div>

            {/* Email destino */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email de destino</Label>
              <Input
                id="email"
                type="email"
                value={form.emailDestino}
                onChange={e => setForm(f => ({ ...f, emailDestino: e.target.value }))}
                placeholder="borgh@smfusion.com.br"
              />
            </div>

            {/* Dias da semana */}
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="todos-dias"
                  checked={todosOsDias}
                  onCheckedChange={(v) => {
                    setTodosOsDias(!!v);
                    if (v) setForm(f => ({ ...f, diasSemana: null }));
                  }}
                />
                <label htmlFor="todos-dias" className="text-sm cursor-pointer">Todos os dias</label>
              </div>
              {!todosOsDias && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {DIAS_SEMANA.map(d => (
                    <button
                      key={d.valor}
                      type="button"
                      onClick={() => toggleDia(d.valor)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium border transition-all",
                        (form.diasSemana ?? []).includes(d.valor)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tipos de backup */}
            <div className="space-y-2">
              <Label>Conteúdo do backup</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="incluir-sql"
                    checked={form.incluirSql}
                    onCheckedChange={v => setForm(f => ({ ...f, incluirSql: !!v }))}
                  />
                  <label htmlFor="incluir-sql" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Dump SQL completo (restaurável)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="incluir-csv"
                    checked={form.incluirCsv}
                    onCheckedChange={v => setForm(f => ({ ...f, incluirCsv: !!v }))}
                  />
                  <label htmlFor="incluir-csv" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                    Arquivos CSV por tabela
                  </label>
                </div>
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3">
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))}
              />
              <Label htmlFor="ativo">Agendamento ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button
              onClick={salvar}
              disabled={salvarMut.isPending || (!form.incluirSql && !form.incluirCsv)}
            >
              {salvarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {form.id ? "Salvar Alterações" : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Confirmar deleção ── */}
      <AlertDialog open={confirmarDeletar !== null} onOpenChange={v => !v && setConfirmarDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmarDeletar !== null && deletarMut.mutate({ id: confirmarDeletar })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
