import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Hook de cache em memória para resultados de busca.
 * Armazena dados em um Map indexado por chave de query, com expiração por TTL.
 * O cache persiste entre re-renders mas é limpo ao recarregar a página.
 * 
 * @param ttlMs Tempo de vida do cache em milissegundos (padrão: 5 minutos)
 */
export function useSearchCache<T = any>(ttlMs: number = 5 * 60 * 1000) {
  const store = useRef(new Map<string, CacheEntry<T>>());

  const get = useCallback((key: string): T | null => {
    const entry = store.current.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttlMs) {
      store.current.delete(key);
      return null;
    }

    return entry.data;
  }, [ttlMs]);

  const set = useCallback((key: string, data: T): void => {
    store.current.set(key, { data, timestamp: Date.now() });

    // Limita o tamanho do cache (máx. 200 entradas)
    if (store.current.size > 200) {
      const first = store.current.keys().next().value;
      if (first !== undefined) store.current.delete(first);
    }
  }, []);

  const has = useCallback((key: string): boolean => {
    const entry = store.current.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > ttlMs) {
      store.current.delete(key);
      return false;
    }
    return true;
  }, [ttlMs]);

  const clear = useCallback((): void => {
    store.current.clear();
  }, []);

  return { get, set, has, clear };
}
