import {
  LayoutDashboard, TrendingDown, TrendingUp, BarChart3, Tag,
  FolderOpen, Users, PieChart, FileText, Database, Settings,
} from "lucide-react";
import { BOTTOM_NAV_ITEM_KEYS, type BottomNavItemKey } from "@shared/bottomNavItems";

export type BottomNavItemDef = {
  key: BottomNavItemKey;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const BOTTOM_NAV_REGISTRY: Record<BottomNavItemKey, BottomNavItemDef> = {
  dashboard: { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  despesas: { key: "despesas", label: "Contas a Pagar", href: "/despesas", icon: TrendingDown },
  receitas: { key: "receitas", label: "Contas a Receber", href: "/receitas", icon: TrendingUp },
  relatorios: { key: "relatorios", label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  categorias: { key: "categorias", label: "Categorias", href: "/categorias", icon: Tag },
  projetos: { key: "projetos", label: "Projetos", href: "/projetos", icon: FolderOpen },
  socios: { key: "socios", label: "Sócios", href: "/projetos/socios", icon: Users },
  "projetos-dashboard": { key: "projetos-dashboard", label: "Dashboard Investimentos", href: "/projetos/dashboard", icon: PieChart },
  "projetos-relatorios": { key: "projetos-relatorios", label: "Relatórios Investimentos", href: "/projetos/relatorios", icon: FileText },
  backup: { key: "backup", label: "Backup", href: "/backup", icon: Database },
  configuracoes: { key: "configuracoes", label: "Configurações", href: "/configuracoes", icon: Settings },
};

export const BOTTOM_NAV_DEFAULT: BottomNavItemKey[] = ["dashboard", "despesas", "receitas", "relatorios"];

export function parseBottomNavConfig(raw: string | null | undefined): BottomNavItemKey[] {
  if (!raw) return BOTTOM_NAV_DEFAULT;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return BOTTOM_NAV_DEFAULT;
    const valid = parsed.filter((k): k is BottomNavItemKey => BOTTOM_NAV_ITEM_KEYS.includes(k));
    return valid.length > 0 ? valid.slice(0, 4) : BOTTOM_NAV_DEFAULT;
  } catch {
    return BOTTOM_NAV_DEFAULT;
  }
}
