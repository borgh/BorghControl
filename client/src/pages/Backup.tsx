import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
  FileText, FileSpreadsheet, Archive, Shield, Zap, Timer
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

const ETAPAS = [
  { id: "conectando", label: "Conectando ao banco", icon: Database, pct: 8 },
  { id: "sql", label: "Gerando dump SQL", icon: FileText, pct: 35 },
  { id: "csv", label: "Exportando CSVs", icon: FileSpreadsheet, pct: 65 },
  { id: "zip", label: "Compactando arquivos", icon: Archive, pct: 82 },
  { id: "email", label: "Enviando por email", icon: Mail, pct: 95 },
  { id: "concluido", label: "Backup concluído!", icon: CheckCircle2, pct: 100 },
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

// Calcular próxima execução no FRONTEND usando horário local do browser
function calcularProximaExecucaoLocal(diasSemana: number[] | null, horario: string): Date {
  const [hh, mm] = horario.split(":").map(Number);
  const agora = new Date();
  const candidato = new Date(agora);
  candidato.setHours(hh, mm, 0, 0);

  if (!diasSemana || diasSemana.length === 0) {
    if (candidato <= agora) candidato.setDate(candidato.getDate() + 1);
    return candidato;
  }
  for (let i = 0; i <= 7; i++) {
    const d = new Date(agora);
    d.setDate(d.getDate() + i);
    d.setHours(hh, mm, 0, 0);
    if (diasSemana.includes(d.getDay()) && d > agora) return d;
  }
  candidato.setDate(candidato.getDate() + 1);
  return candidato;
}

// Formatar countdown legível
function formatarCountdown(ms: number): string {
  if (ms <= 0) return "Agora";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `em ${d}d ${h % 24}h`;
  if (h > 0) return `em ${h}h ${m % 60}min`;
  if (m > 0) return `em ${m}min ${s % 60}s`;
  return `em ${s}s`;
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

// ── Painel de progresso animado ───────────────────────────────────────────────
function BackupProgressPanel({
  onDone,
  agendamentoInfo,
}: {
  onDone: (success: boolean, msg: string) => void;
  agendamentoInfo?: string; // ex: "Agendado — 22:00 todos os dias"
}) {
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const etapaAtual = ETAPAS[Math.min(etapaIdx, ETAPAS.length - 1)];

  const executarMut = trpc.backup.executarManual.useMutation({
    onSuccess: (res) => {
      setEtapaIdx(ETAPAS.length - 1);
      setProgresso(100);
      setConcluido(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => onDone(res.sucesso, res.mensagem), 1400);
    },
    onError: (e) => {
      setErro(e.message);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => onDone(false, e.message), 1800);
    },
  });

  useEffect(() => {
    executarMut.mutate({ emailDestino: "borghborges@gmail.com", incluirSql: true, incluirCsv: true });

    let idx = 0;
    timerRef.current = setInterval(() => {
      idx++;
      if (idx < ETAPAS.length - 1) setEtapaIdx(idx);
    }, 900);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animar barra suavemente
  useEffect(() => {
    const target = etapaAtual.pct;
    const step = setInterval(() => {
      setProgresso(prev => {
        if (prev >= target) { clearInterval(step); return prev; }
        return Math.min(prev + 1, target);
      });
    }, 18);
    return () => clearInterval(step);
  }, [etapaAtual.pct]);

  const IconAtual = erro ? XCircle : etapaAtual.icon;

  return (
    <Card className={cn(
      "border-2 overflow-hidden transition-all duration-500",
      erro ? "border-red-300 bg-red-50/50" :
      concluido ? "border-emerald-300 bg-emerald-50/50" :
      "border-primary/30 bg-primary/5"
    )}>
      <CardContent className="p-6 space-y-5">
        {agendamentoInfo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-3">
            <Timer className="h-3.5 w-3.5 text-primary" />
            <span>{agendamentoInfo}</span>
          </div>
        )}
        {/* Ícone + título */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl transition-all duration-300",
            erro ? "bg-red-100" : concluido ? "bg-emerald-100" : "bg-primary/10"
          )}>
            <IconAtual className={cn(
              "h-5 w-5 transition-all",
              erro ? "text-red-600" :
              concluido ? "text-emerald-600" :
              "text-primary animate-pulse"
            )} />
          </div>
          <div>
            <p className={cn(
              "font-semibold text-sm",
              erro ? "text-red-700" : concluido ? "text-emerald-700" : "text-foreground"
            )}>
              {erro ? "Erro no backup" : etapaAtual.label}
            </p>
            {erro && <p className="text-xs text-red-600 mt-0.5">{erro}</p>}
          </div>
          <div className="ml-auto text-right">
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              erro ? "text-red-600" : concluido ? "text-emerald-600" : "text-primary"
            )}>
              {progresso}%
            </span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              erro ? "bg-red-500" :
              concluido ? "bg-emerald-500" :
              "bg-gradient-to-r from-primary to-primary/80"
            )}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* Etapas */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ETAPAS.map((etapa, i) => {
            const EtapaIcon = etapa.icon;
            const ativa = i === etapaIdx && !concluido && !erro;
            const feita = i < etapaIdx || concluido;
            return (
              <div key={etapa.id} className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all duration-300",
                ativa ? "bg-primary/10 scale-105" :
                feita ? "bg-emerald-50" :
                "opacity-40"
              )}>
                <EtapaIcon className={cn(
                  "h-4 w-4",
                  ativa ? "text-primary animate-pulse" :
                  feita ? "text-emerald-600" :
                  "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-[10px] leading-tight font-medium",
                  ativa ? "text-primary" :
                  feita ? "text-emerald-700" :
                  "text-muted-foreground"
                )}>
                  {etapa.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
  emailDestino: "borghborges@gmail.com",
  incluirSql: true,
  incluirCsv: true,
};

export default function Backup() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const utils = trpc.useUtils();

  // Polling: refetch agendamentos e logs a cada 30s
  const { data: agendamentos = [], isLoading: loadingAg } = trpc.backup.listarAgendamentos.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: logs = [], isLoading: loadingLogs } = trpc.backup.listarLogs.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000 }
  );
  const { data: smtpStatus } = trpc.backup.statusSmtp.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

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

  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<AgendamentoForm>(FORM_VAZIO);
  const [confirmarDeletar, setConfirmarDeletar] = useState<number | null>(null);
  const [todosOsDias, setTodosOsDias] = useState(true);
  const [executandoBackup, setExecutandoBackup] = useState(false);
  const [backupAgendamentoInfo, setBackupAgendamentoInfo] = useState<string | undefined>();

  // Countdown em tempo real: recalcular a cada segundo
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Rastrear quais agendamentos já foram disparados nesta sessão
  const disparadosRef = useRef<Set<number>>(new Set());

  // Verificar se algum agendamento deve disparar agora
  const verificarDisparo = useCallback(() => {
    if (executandoBackup) return;
    for (const ag of agendamentos) {
      if (!ag.ativo) continue;
      if (disparadosRef.current.has(ag.id)) continue;

      const [hh, mm] = (ag.horario as string).split(":").map(Number);
      const now = new Date();
      const horaLocal = now.getHours();
      const minLocal = now.getMinutes();

      const diasSemana = ag.diasSemana as number[] | null;
      const diaOk = !diasSemana || diasSemana.length === 0 || diasSemana.includes(now.getDay());

      if (horaLocal === hh && minLocal === mm && diaOk) {
        // Marcar como disparado para não repetir no mesmo minuto
        disparadosRef.current.add(ag.id);
        const label = `Agendado — ${ag.horario} ${!diasSemana || diasSemana.length === 0 ? "todos os dias" : DIAS_SEMANA.filter(d => diasSemana.includes(d.valor)).map(d => d.label).join(", ")}`;
        setBackupAgendamentoInfo(label);
        setExecutandoBackup(true);
        toast.info(`⏰ Executando backup agendado das ${ag.horario}…`);
        break;
      }
    }
  }, [agendamentos, executandoBackup]);

  // Verificar disparo a cada 10s (mais frequente que o polling do servidor)
  useEffect(() => {
    verificarDisparo();
    const t = setInterval(verificarDisparo, 10_000);
    return () => clearInterval(t);
  }, [verificarDisparo]);

  // Limpar disparados a cada hora (para não acumular)
  useEffect(() => {
    const t = setInterval(() => { disparadosRef.current.clear(); }, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
    salvarMut.mutate({ ...form, diasSemana: diasFinal });
  }

  function handleBackupDone(success: boolean, msg: string) {
    setExecutandoBackup(false);
    setBackupAgendamentoInfo(undefined);
    if (success) {
      toast.success(msg);
    } else {
      toast.error("Backup falhou: " + msg);
    }
    utils.backup.listarLogs.invalidate();
  }

  const providerLabel = smtpStatus?.provider === "Resend"
    ? "Resend API (HTTPS)"
    : smtpStatus?.host
    ? `SMTP via ${smtpStatus.host}`
    : null;

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
          onClick={() => { setBackupAgendamentoInfo(undefined); setExecutandoBackup(true); }}
          disabled={executandoBackup}
          className="gap-2 shrink-0"
        >
          {executandoBackup
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />}
          Executar Backup Agora
        </Button>
      </div>

      {/* Painel de progresso animado */}
      {executandoBackup && (
        <BackupProgressPanel onDone={handleBackupDone} agendamentoInfo={backupAgendamentoInfo} />
      )}

      {/* Status de email */}
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
                ? `Email configurado — envios via ${providerLabel}`
                : "Email não configurado — backups serão gerados mas não enviados"}
            </p>
            {smtpStatus?.configurado && smtpStatus.provider === "Resend" && (
              <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Usando Resend API — envio confiável via HTTPS, sem bloqueio de porta SMTP
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
              {agendamentos.map((ag: any) => {
                // Calcular próxima execução no frontend com horário local
                const diasSemana = ag.diasSemana as number[] | null;
                const proxima = calcularProximaExecucaoLocal(diasSemana, ag.horario as string);
                const msAte = proxima.getTime() - agora.getTime();
                const countdown = formatarCountdown(msAte);
                const iminente = msAte > 0 && msAte < 5 * 60 * 1000; // menos de 5min

                return (
                  <Card key={ag.id} className={cn(
                    "transition-all",
                    !ag.ativo && "opacity-60",
                    iminente && "border-amber-300 bg-amber-50/30"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
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
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              {ag.horario}
                            </span>
                            <span className="text-xs text-muted-foreground">—</span>
                            {!diasSemana || diasSemana.length === 0 ? (
                              <Badge variant="secondary" className="text-xs">Todos os dias</Badge>
                            ) : (
                              <div className="flex gap-1">
                                {DIAS_SEMANA.map(d => (
                                  <Badge
                                    key={d.valor}
                                    variant={diasSemana.includes(d.valor) ? "default" : "outline"}
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
                          {ag.ativo && (
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs",
                              iminente ? "text-amber-600 font-medium" : "text-muted-foreground/70"
                            )}>
                              <Timer className={cn("h-3 w-3", iminente && "animate-pulse")} />
                              <span>
                                Próxima execução: {proxima.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                {" "}
                                <span className={cn(
                                  "tabular-nums",
                                  iminente ? "text-amber-700 font-semibold" : "text-muted-foreground/50"
                                )}>
                                  ({countdown})
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
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
                );
              })}
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
            <div className="space-y-1.5">
              <Label htmlFor="horario">Horário do backup (horário de Brasília)</Label>
              <Input
                id="horario"
                type="time"
                value={form.horario}
                onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email de destino</Label>
              <Input
                id="email"
                type="email"
                value={form.emailDestino}
                onChange={e => setForm(f => ({ ...f, emailDestino: e.target.value }))}
                placeholder="borghborges@gmail.com"
              />
            </div>

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
