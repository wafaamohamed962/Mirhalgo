import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from './useDebouncedValue';

/*
 * List state (tabs, filters, sort, search) in the query string, so "Back" from a detail page
 * restores the list exactly as it was (addition beyond the MW_003 spec). Writes use `replace`:
 * changing a filter never adds a history entry, so Back still leaves the list in one step.
 */

/** One query-string value from a fixed list. The default is not written to the URL. */
export function useQueryParam<T extends string>(
  key: string,
  defaultValue: T,
  allowed: readonly T[],
) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value =
    raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultValue;

  const setValue = useCallback(
    (next: T) =>
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (next === defaultValue) out.delete(key);
          else out.set(key, next);
          return out;
        },
        { replace: true },
      ),
    [key, defaultValue, setParams],
  );
  return [value, setValue] as const;
}

/**
 * A search box backed by `?key=`. Typing stays local and reaches the URL debounced; a URL
 * change from elsewhere (Back, the top-bar order search) fills the box. `search` is the
 * debounced, trimmed text to query with.
 */
export function useQuerySearch(key: string) {
  const [params, setParams] = useSearchParams();
  const urlValue = params.get(key) ?? '';
  const [input, setInput] = useState(urlValue);
  const search = useDebouncedValue(input.trim());
  // the last value this hook wrote: a URL holding it is our own echo, not a new search
  const written = useRef(urlValue);

  useEffect(() => {
    if (urlValue === written.current) return;
    written.current = urlValue;
    setInput(urlValue);
  }, [urlValue]);

  useEffect(() => {
    if (search === written.current) return;
    written.current = search;
    setParams(
      (current) => {
        const out = new URLSearchParams(current);
        if (search) out.set(key, search);
        else out.delete(key);
        return out;
      },
      { replace: true },
    );
  }, [search, key, setParams]);

  return { input, setInput, search };
}
