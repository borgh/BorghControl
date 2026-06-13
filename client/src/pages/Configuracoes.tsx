import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserPlus, Shield, ShieldOff, Trash2, Settings, Users, Eye, EyeOff } from "lucide-react";

const ROLE_LABELS: Record<string, string> = { admin: "Administrador", user: "Usuário" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  user: "bg-blue-100 text-blue-700 border-blue-200",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Configuracoes() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: usuarios, isLoading } = trpc.configuracoes.listUsuarios.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
  });

  const criarMutation = trpc.configuracoes.criarUsuario.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.configuracoes.listUsuarios.invalidate();
      setModalOpen(false);
      setForm({ name: "", email: "", password: "", role: "user" });
    },
    onError: (e) => toast.error(e.message),
  });

  const roleMutation = trpc.configuracoes.atualizarRole.useMutation({
    onSuccess: () => { toast.success("Permissão atualizada!"); utils.configuracoes.listUsuarios.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const ativoMutation = trpc.configuracoes.toggleAtivo.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.ativo ? "Usuário ativado!" : "Usuário desativado!");
      utils.configuracoes.listUsuarios.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const excluirMutation = trpc.configuracoes.excluirUsuario.useMutation({
    onSuccess: () => { toast.success("Usuário excluído!"); utils.configuracoes.listUsuarios.invalidate(); setConfirmDelete(null); },
    onError: (e) => toast.error(e.message),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "admin" | "user" });

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldOff className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Esta área é exclusiva para administradores do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie usuários e permissões do sistema</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Usuários */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários do Sistema
          </CardTitle>
          <CardDescription>
            Administradores têm acesso total. Usuários comuns podem visualizar e lançar dados, mas não gerenciam outros usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !usuarios?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-2">
              {usuarios.map((u) => {
                const isMe = u.id === currentUser?.id;
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      !u.ativo ? "opacity-50 bg-muted/30" : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{u.name ?? "—"}</span>
                        {isMe && <Badge variant="outline" className="text-xs py-0">Você</Badge>}
                        <Badge className={`text-xs border ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                        {!u.ativo && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em {formatDate(u.createdAt)}
                        {u.lastSignedIn && ` · Último acesso: ${formatDate(u.lastSignedIn)}`}
                      </p>
                    </div>

                    {/* Actions */}
                    {!isMe && (
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Alterar role */}
                        <Select
                          value={u.role}
                          onValueChange={(role) => roleMutation.mutate({ userId: u.id, role: role as "admin" | "user" })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Ativar/Desativar */}
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={u.ativo}
                            onCheckedChange={(ativo) => ativoMutation.mutate({ userId: u.id, ativo })}
                            className="scale-90"
                          />
                        </div>

                        {/* Excluir */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDelete(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda de permissões */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Níveis de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-purple-50/50 border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 border">Administrador</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Acesso total ao sistema</li>
                <li>✅ Gerenciar usuários e permissões</li>
                <li>✅ Criar, editar e excluir todos os lançamentos</li>
                <li>✅ Visualizar relatórios e dashboard</li>
                <li>✅ Gerenciar categorias</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border bg-blue-50/50 border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">Usuário</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Visualizar dashboard e relatórios</li>
                <li>✅ Criar e editar lançamentos</li>
                <li>✅ Marcar despesas e receitas como pagas</li>
                <li>✅ Gerenciar categorias</li>
                <li>❌ Gerenciar usuários e permissões</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Novo Usuário */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              criarMutation.mutate(form);
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input
                placeholder="Ex: João Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nível de acesso *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "user" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário — acesso padrão</SelectItem>
                  <SelectItem value="admin">Administrador — acesso total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário perderá acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete !== null && excluirMutation.mutate({ userId: confirmDelete })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
