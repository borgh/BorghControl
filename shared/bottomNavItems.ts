// Chaves válidas para os atalhos do Menu Inferior (mobile). Compartilhado entre
// client (define ícone/label/rota) e server (valida o que pode ser salvo).
export const BOTTOM_NAV_ITEM_KEYS = [
  "dashboard",
  "despesas",
  "receitas",
  "relatorios",
  "categorias",
  "projetos",
  "socios",
  "projetos-dashboard",
  "projetos-relatorios",
  "backup",
  "configuracoes",
] as const;

export type BottomNavItemKey = (typeof BOTTOM_NAV_ITEM_KEYS)[number];

export const BOTTOM_NAV_MAX_ITEMS = 4; // + o botão fixo "Menu" = 5 no total
