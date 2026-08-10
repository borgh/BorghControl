import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_REGISTRY, parseBottomNavConfig } from "@/lib/bottomNavRegistry";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const items = parseBottomNavConfig(user?.bottomNavConfig)
    .map((key) => BOTTOM_NAV_REGISTRY[key])
    .filter(Boolean);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.key} href={item.href} className="flex-1">
            <div className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">{item.label}</span>
            </div>
          </Link>
        );
      })}
      <button onClick={onOpenMenu} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground">
        <Menu className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-none">Menu</span>
      </button>
    </nav>
  );
}
