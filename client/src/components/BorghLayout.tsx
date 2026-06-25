import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, TrendingDown, TrendingUp, Tag, BarChart3,
  Menu, LogOut, ChevronRight, DollarSign, X, Settings,
  FolderOpen, Users, PieChart, FileText, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/despesas", label: "Contas a Pagar", icon: TrendingDown },
  { href: "/receitas", label: "Contas a Receber", icon: TrendingUp },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/categorias", label: "Categorias", icon: Tag },
];

const projetosSubItems = [
  { href: "/projetos", label: "Projetos", icon: FolderOpen },
  { href: "/projetos/socios", label: "Sócios", icon: Users },
  { href: "/projetos/dashboard", label: "Dashboard", icon: PieChart },
  { href: "/projetos/relatorios", label: "Relatórios", icon: FileText },
];

function NavLink({ href, label, icon: Icon, onClick, indent }: {
  href: string; label: string; icon: any; onClick?: () => void; indent?: boolean;
}) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link href={href} onClick={onClick}>
      <div className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer",
        indent ? "px-3 py-2" : "px-3 py-2.5",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}>
        <Icon className={cn(
          "shrink-0",
          indent ? "h-3.5 w-3.5" : "h-4 w-4",
          active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
        )} />
        <span>{label}</span>
        {active && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
      </div>
    </Link>
  );
}

function NavGroup({ label, icon: Icon, children, defaultOpen, matchPrefix }: {
  label: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; matchPrefix?: string;
}) {
  const [location] = useLocation();
  const isActive = matchPrefix ? location.startsWith(matchPrefix) : false;
  const [open, setOpen] = useState(defaultOpen ?? isActive);
  return (
    <div>
      <button
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer",
          isActive
            ? "bg-sidebar-primary/10 text-sidebar-primary"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
        )} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="ml-3 mt-0.5 pl-3 border-l border-sidebar-border space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const initials = user?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "BC";

  function goTo(path: string) {
    if (onClose) onClose();
    navigate(path);
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192x192.png" alt="BorghControl" className="h-9 w-9 rounded-xl shadow-sm object-cover" />
          <div>
            <p className="font-bold text-sm text-sidebar-foreground tracking-tight">BorghControl</p>
            <p className="text-xs text-sidebar-foreground/50">Controle Financeiro</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} onClick={onClose} />
        ))}

        {/* Separador */}
        <div className="pt-2 pb-1">
          <div className="border-t border-sidebar-border" />
        </div>

        {/* Menu Projetos e Investimentos */}
        <NavGroup
          label="Projetos e Investimentos"
          icon={FolderOpen}
          matchPrefix="/projetos"
          defaultOpen={location.startsWith("/projetos")}
        >
          {projetosSubItems.map((item) => (
            <NavLink key={item.href} {...item} onClick={onClose} indent />
          ))}
        </NavGroup>
      </nav>

      {/* User menu */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name ?? "Usuário"}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email ?? ""}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
              {user?.name ?? "Usuário"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user?.role === "admin" && (
              <>
                <DropdownMenuItem
                  onClick={() => goTo("/configuracoes")}
                  className="gap-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function BorghLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 border-r border-sidebar-border">
        <Sidebar />
      </aside>
      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border [&>button]:hidden">
          <Sidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192x192.png" alt="BorghControl" className="h-6 w-6 rounded object-cover" />
            <span className="font-bold text-sm">BorghControl</span>
          </div>
        </header>
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
