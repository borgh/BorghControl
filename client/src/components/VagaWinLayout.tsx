import { useState } from "react";
import { Link, useLocation, useLocation as useWouterLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard,
  ParkingSquare,
  Building2,
  Shuffle,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useNavigate } from "@/lib/navigate";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vagas", label: "Vagas", icon: ParkingSquare },
  { href: "/apartamentos", label: "Apartamentos", icon: Building2 },
  { href: "/sorteio", label: "Sorteio", icon: Shuffle },
  { href: "/historico", label: "Histórico", icon: History },
];

interface VagaWinLayoutProps {
  children: React.ReactNode;
}

export default function VagaWinLayout({ children }: VagaWinLayoutProps) {
  const [location] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const [, setLocation] = useWouterLocation();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Sessão encerrada com sucesso.");
      setLocation("/login");
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <ParkingSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sidebar-foreground font-bold text-base leading-tight tracking-tight">VagaWin</p>
          <p className="text-sidebar-foreground/50 text-xs">Sorteio de Garagens</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border mx-4 w-auto" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <button
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </button>
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border mx-4 w-auto" />

      {/* User */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-sm font-medium truncate">
              {user?.name ?? "Usuário"}
            </p>
            <p className="text-sidebar-foreground/50 text-xs truncate">{user?.email ?? ""}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 flex-shrink-0"
            onClick={() => logoutMutation.mutate()}
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col lg:hidden transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:pl-60 min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ParkingSquare className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">VagaWin</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
