import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DollarSign, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const utils = trpc.useUtils();

  const loginMut = trpc.auth.login.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });
  const registerMut = trpc.auth.register.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });

  const loading = loginMut.isPending || registerMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") loginMut.mutate({ email: form.email, password: form.password });
    else registerMut.mutate({ name: form.name, email: form.email, password: form.password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-accent/20 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-3">
          <img src="/icons/icon-192x192.png" alt="BorghControl" className="mx-auto h-16 w-16 rounded-2xl shadow-lg object-cover" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">BorghControl</h1>
            <p className="text-sm text-muted-foreground">Controle financeiro pessoal</p>
          </div>
        </div>
        {/* Card */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{mode === "login" ? "Entrar" : "Criar conta"}</CardTitle>
            <CardDescription>{mode === "login" ? "Acesse seu painel financeiro" : "Comece a controlar suas finanças"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={loading} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPwd ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required disabled={loading} className="pr-10" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <span>Não tem conta?{" "}<button onClick={() => setMode("register")} className="text-primary font-medium hover:underline">Criar conta</button></span>
              ) : (
                <span>Já tem conta?{" "}<button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">Entrar</button></span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
