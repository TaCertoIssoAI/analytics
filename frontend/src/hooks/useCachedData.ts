import React, { useState, useEffect } from 'react';

interface UseCachedDataResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isRefetching: boolean;
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

  const isMounted = React.useRef(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);

  const fetchData = async (forceUpdate = false) => {
    try {
      if (forceUpdate) {
        setIsRefetching(true);
      } else {
        const cached = localStorage.getItem(key);
        if (!cached) {
            setLoading(true);
        } else {
            setLoading(false);
        }
      }

      const freshData = await fetcher();

      if (isMounted.current) {
        setData(freshData);
        localStorage.setItem(key, JSON.stringify(freshData));
        setLoading(false);
        setIsRefetching(false);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error(`Error fetching data for key "${key}":`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        setIsRefetching(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, [key, fetcher]);

  const refetch = async () => {
    await fetchData(true);
  };

  return { data, loading, error, refetch, isRefetching };
}
