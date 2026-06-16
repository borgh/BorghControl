import { useState, useEffect, useCallback } from "react";

export interface Anexo {
  id: number;
  transacao_id: number;
  nome_arquivo: string;
  mime_type: string;
  tamanho: number;
  created_at: string;
}

// Cache simples para evitar múltiplas requisições para o mesmo ID
const cache = new Map<number, { anexos: Anexo[]; ts: number }>();
const CACHE_TTL = 30_000; // 30 segundos

export function useAnexos(transacaoId: number | null | undefined) {
  const [anexos, setAnexos] = useState<Anexo[]>(() => {
    if (!transacaoId) return [];
    const cached = cache.get(transacaoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.anexos;
    return [];
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anexos/list/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: Anexo[] = data.anexos ?? [];
      cache.set(id, { anexos: list, ts: Date.now() });
      setAnexos(list);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!transacaoId) { setAnexos([]); return; }
    const cached = cache.get(transacaoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setAnexos(cached.anexos);
      return;
    }
    load(transacaoId);
  }, [transacaoId, load]);

  const refresh = useCallback(() => {
    if (!transacaoId) return;
    cache.delete(transacaoId);
    load(transacaoId);
  }, [transacaoId, load]);

  return { anexos, loading, refresh };
}

// Invalida o cache de um item específico (chamar após upload/delete)
export function invalidateAnexosCache(transacaoId: number) {
  cache.delete(transacaoId);
}
