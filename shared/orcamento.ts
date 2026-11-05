// Regra 50-30-20 — configuração do orçamento (compartilhada entre client e server)
export type ModoOrcamento = "padrao" | "livre" | "personalizado";

export type OrcamentoConfig = {
  modo: ModoOrcamento;
  essencial: number;   // % da renda do mês
  lazer: number;       // %
  poupanca: number;    // % — também define o "Investir X%" das receitas
  diaSalario: number | null; // dia do mês em que o salário cai (lembrete) — fase 7
};

export const ORCAMENTO_PADRAO: OrcamentoConfig = {
  modo: "padrao",
  essencial: 50,
  lazer: 30,
  poupanca: 20,
  diaSalario: null,
};

export const GRUPOS_ORCAMENTO = ["essencial", "lazer", "investimento"] as const;
export type GrupoOrcamento = (typeof GRUPOS_ORCAMENTO)[number];

export const GRUPO_LABEL: Record<GrupoOrcamento, string> = {
  essencial: "Essenciais",
  lazer: "Lazer & Compras",
  investimento: "Investimentos / Sobra",
};

/** Percentuais efetivos: no modo padrão são sempre 50/30/20; no personalizado, os informados */
export function percentuais(cfg: OrcamentoConfig) {
  if (cfg.modo === "personalizado") return { essencial: cfg.essencial, lazer: cfg.lazer, poupanca: cfg.poupanca };
  return { essencial: 50, lazer: 30, poupanca: 20 };
}

/** Normaliza/valida o que veio do banco ou do formulário */
export function normalizarOrcamento(raw: Partial<OrcamentoConfig> | null | undefined): OrcamentoConfig {
  const cfg: OrcamentoConfig = { ...ORCAMENTO_PADRAO, ...(raw ?? {}) };
  if (!["padrao", "livre", "personalizado"].includes(cfg.modo)) cfg.modo = "padrao";
  for (const k of ["essencial", "lazer", "poupanca"] as const) {
    const v = Number(cfg[k]);
    cfg[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : ORCAMENTO_PADRAO[k];
  }
  if (cfg.modo !== "personalizado") { cfg.essencial = 50; cfg.lazer = 30; cfg.poupanca = 20; }
  const d = cfg.diaSalario == null ? null : Number(cfg.diaSalario);
  cfg.diaSalario = d && d >= 1 && d <= 31 ? Math.round(d) : null;
  return cfg;
}
