import { useCallback, useEffect, useRef, useState } from "react";

type FetchFn<T> = (signal?: AbortSignal) => Promise<T>;

type UsePollingOptions = {
  intervalMs?: number;
  enabled?: boolean;
};

type UsePollingResult<T> = {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  correlationId?: string;
  refresh: () => void;
};

/**
 * Stale-while-revalidate polling hook.
 * - Returns cached `data` while revalidating.
 * - Polls every `intervalMs` when enabled.
 * - Manual `refresh()` triggers immediate revalidation.
 */
export function usePolling<T>(
  fetcher: FetchFn<T>,
  { intervalMs = 60_000, enabled = true }: UsePollingOptions = {},
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [correlationId, setCorrelationId] = useState<string | undefined>(undefined);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const abortRef = useRef<AbortController | null>(null);
  const tickRef = useRef<number>(0);

  const run = useCallback(async (isInitial: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const tick = ++tickRef.current;

    if (isInitial && data === null) {
      setIsLoading(true);
    } else {
      setIsValidating(true);
    }

    try {
      const result = await fetcherRef.current(ctrl.signal);
      if (tick !== tickRef.current) return;
      if (ctrl.signal.aborted) return;
      setData(result);
      setError(null);
      setCorrelationId(undefined);
    } catch (e) {
      if (tick !== tickRef.current) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      // Extract correlationId if ApiError
      const maybe = err as { correlationId?: string };
      if (maybe.correlationId) setCorrelationId(maybe.correlationId);
    } finally {
      if (tick === tickRef.current) {
        setIsLoading(false);
        setIsValidating(false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    void run(false);
  }, [run]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setIsValidating(false);
      return;
    }
    void run(data === null);

    if (intervalMs <= 0) return;
    const id = window.setInterval(() => void run(false), intervalMs);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { data, error, isLoading, isValidating, correlationId, refresh };
}
