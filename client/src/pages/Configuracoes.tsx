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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Shield, ShieldOff, Trash2, Settings, Users, Eye, EyeOff, Pencil, CheckCircle2, XCircle } from "lucide-react";

const ROLE_LABELS: Record<string, string> = { admin: "Administrador", user: "Usuário" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  user: "bg-blue-100 text-blue-700 border-blue-200",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type UserItem = {
  id: number;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  ativo: boolean | null;
  createdAt: Date | null;
  lastSignedIn: Date | null;
};

// Definição das permissões disponíveis por papel
type Permission = {
  key: string;
  label: string;
  adminDefault: boolean;
  userDefault: boolean;
  adminLocked?: boolean; // admin sempre tem, não pode remover
};

const PERMISSIONS: Permission[] = [
  { key: "view_dashboard", label: "Visualizar dashboard e relatórios", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "create_lancamentos", label: "Criar novos lançamentos", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "edit_lancamentos", label: "Editar lançamentos existentes", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "delete_lancamentos", label: "Excluir lançamentos", adminDefault: true, userDefault: false, adminLocked: true },
  { key: "mark_paid", label: "Marcar despesas e receitas como pagas", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "manage_categorias", label: "Gerenciar categorias", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "view_relatorios", label: "Acessar relatórios detalhados", adminDefault: true, userDefault: true, adminLocked: true },
  { key: "manage_users", label: "Gerenciar usuários e permissões", adminDefault: true, userDefault: false, adminLocked: true },
];

const DEFAULT_USER_PERMS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.userDefault]));

const emptyForm = { name: "", email: "", password: "", role: "user" as "admin" | "user" };

export default function Configuracoes() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: usuarios, isLoading } = trpc.configuracoes.listUsuarios.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
  });

  // Mutations
  const criarMutation = trpc.configuracoes.criarUsuario.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.configuracoes.listUsuarios.invalidate();
      setModalCriar(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const editarMutation = trpc.configuracoes.editarUsuario.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      utils.configuracoes.listUsuarios.invalidate();
      setEditUser(null);
    },
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
    onSuccess: () => {
      toast.success("Usuário excluído!");
      utils.configuracoes.listUsuarios.invalidate();
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [modalCriar, setModalCriar] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "user" as "admin" | "user" });

  // Permissões editáveis do perfil Usuário — carregadas do banco
  const [editandoPermissoes, setEditandoPermissoes] = useState(false);
  const [userPermsTemp, setUserPermsTemp] = useState<Record<string, boolean>>({});

  const { data: dbPerms, isLoading: loadingPerms } = trpc.configuracoes.getPermissoes.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
  });
  const userPerms: Record<string, boolean> = dbPerms ?? DEFAULT_USER_PERMS;

  const salvarPermissoesMutation = trpc.configuracoes.salvarPermissoes.useMutation({
    onSuccess: () => {
      utils.configuracoes.getPermissoes.invalidate();
      setEditandoPermissoes(false);
      toast.success("Permissões do perfil Usuário atualizadas com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(u: UserItem) {
    setEditUser(u);
    setEditForm({ name: u.name ?? "", email: u.email ?? "", password: "", role: u.role });
    setShowEditPassword(false);
  }

  function openEditPermissoes() {
    setUserPermsTemp({ ...userPerms });
    setEditandoPermissoes(true);
  }

  function salvarPermissoes() {
    salvarPermissoesMutation.mutate({ permissions: userPermsTemp });
  }

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
        <Button onClick={() => { setModalCriar(true); setForm(emptyForm); setShowPassword(false); }} className="gap-2">
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
            {usuarios && <Badge variant="secondary" className="ml-1">{usuarios.length}</Badge>}
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
                      !u.ativo ? "opacity-50 bg-muted/30" : "bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                    </div>
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(u as UserItem)}
                        title="Editar usuário"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!isMe && (
                        <>
                          <div className="flex items-center gap-1" title={u.ativo ? "Desativar" : "Ativar"}>
                            <Switch
                              checked={u.ativo ?? false}
                              onCheckedChange={(ativo) => ativoMutation.mutate({ userId: u.id, ativo })}
                              className="scale-90"
                            />
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete(u.id)}
                            title="Excluir usuário"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Níveis de Acesso */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Níveis de Acesso
              </CardTitle>
              <CardDescription className="mt-1">
                Visualize e edite as permissões padrão de cada perfil de usuário.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openEditPermissoes} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editar Permissões do Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Administrador — fixo */}
            <div className="p-4 rounded-lg border bg-purple-50/50 border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 border">Administrador</Badge>
                <span className="text-xs text-muted-foreground">Permissões fixas</span>
              </div>
              <ul className="text-sm space-y-1.5">
                {PERMISSIONS.map((p) => (
                  <li key={p.key} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Usuário — editável */}
            <div className="p-4 rounded-lg border bg-blue-50/50 border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">Usuário</Badge>
                <span className="text-xs text-muted-foreground">Permissões configuráveis</span>
              </div>
              <ul className="text-sm space-y-1.5">
                {PERMISSIONS.map((p) => {
                  const allowed = userPerms[p.key] ?? p.userDefault;
                  return (
                    <li key={p.key} className="flex items-start gap-2 text-muted-foreground">
                      {allowed
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      }
                      <span className={!allowed ? "line-through opacity-60" : ""}>{p.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Criar Usuário */}
      <Dialog open={modalCriar} onOpenChange={setModalCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); criarMutation.mutate(form); }} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="Ex: João Silva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required minLength={6} className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nível de acesso *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "user" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário — acesso padrão</SelectItem>
                  <SelectItem value="admin">Administrador — acesso total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalCriar(false)}>Cancelar</Button>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Usuário */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const payload: { userId: number; name?: string; email?: string; password?: string; role?: "admin" | "user" } = { userId: editUser.id };
                if (editForm.name !== (editUser.name ?? "")) payload.name = editForm.name;
                if (editForm.email !== (editUser.email ?? "")) payload.email = editForm.email;
                if (editForm.password) payload.password = editForm.password;
                if (editForm.role !== editUser.role) payload.role = editForm.role;
                editarMutation.mutate(payload);
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input placeholder="Nome completo" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" placeholder="email@exemplo.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Nova senha <span className="text-muted-foreground text-xs">(deixe em branco para manter a atual)</span></Label>
                <div className="relative">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Nova senha (opcional)"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    minLength={6} className="pr-10"
                  />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nível de acesso *</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as "admin" | "user" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário — acesso padrão</SelectItem>
                    <SelectItem value="admin">Administrador — acesso total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                <Button type="submit" disabled={editarMutation.isPending}>
                  {editarMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Permissões do Usuário */}
      <Dialog open={editandoPermissoes} onOpenChange={(o) => !o && setEditandoPermissoes(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Editar Permissões — Perfil Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Defina quais ações os usuários com perfil <strong>Usuário</strong> podem realizar no sistema. As permissões do <strong>Administrador</strong> são fixas e não podem ser alteradas.
            </p>
            <div className="space-y-3">
              {PERMISSIONS.map((p) => (
                <div key={p.key} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Checkbox
                    id={`perm-${p.key}`}
                    checked={userPermsTemp[p.key] ?? p.userDefault}
                    onCheckedChange={(checked) =>
                      setUserPermsTemp((prev) => ({ ...prev, [p.key]: !!checked }))
                    }
                    className="mt-0.5"
                  />
                  <label htmlFor={`perm-${p.key}`} className="text-sm cursor-pointer leading-snug">
                    {p.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setEditandoPermissoes(false)}>Cancelar</Button>
            <Button onClick={salvarPermissoes} disabled={salvarPermissoesMutation.isPending}>
              {salvarPermissoesMutation.isPending ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </DialogFooter>
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
