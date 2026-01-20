import { useState, useEffect } from 'react';

interface UseCachedDataResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook to fetch data with stale-while-revalidate caching strategy using localStorage.
 * 
 * @param key The localStorage key to store the data.
 * @param fetcher A function that returns a Promise resolving to the data.
 * @param initialValue The initial value to use if no cache is found.
 * @returns An object containing the data, loading state, and error.
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  initialValue: T
): UseCachedDataResult<T> {
  const [data, setData] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // If we have data from cache, we're not "loading" in the blocking sense,
        // but we are fetching in the background. 
        // However, for the UI to know if it should show a spinner (when no cache),
        // we keep loading true initially if no cache, or false if cache exists?
        // Actually, the requirement is "not separate with extensive loading".
        // So if we have cache, we show it.
        
        // We set loading to true only if we don't have cached data to show?
        // Or we can expose a separate 'isRefetching' state if needed.
        // For now, let's stick to a simple loading state that reflects "initial fetch".
        
        const cached = localStorage.getItem(key);
        if (!cached) {
            setLoading(true);
        } else {
            setLoading(false);
        }

        const freshData = await fetcher();

        if (isMounted) {
          setData(freshData);
          localStorage.setItem(key, JSON.stringify(freshData));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Error fetching data for key "${key}":`, err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [key, fetcher]);

  return { data, loading, error };
}
