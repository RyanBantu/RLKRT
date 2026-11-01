import { useCallback, useEffect, useState } from 'react';
import { ApiError, type ApiErrorKind } from './api/http';

export type Source<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; kind: ApiErrorKind };

/** Runs one data source independently; `key` changes (or retry) re-run it. */
export function useSource<T>(key: string | null, fn: () => Promise<T>): [Source<T>, () => void] {
  const [state, setState] = useState<Source<T>>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!key) {
      setState({ status: 'idle' });
      return;
    }
    let live = true;
    setState({ status: 'loading' });
    fn().then(
      (data) => live && setState({ status: 'ok', data }),
      (e) => live && setState({ status: 'error', kind: e instanceof ApiError ? e.kind : 'http' }),
    );
    return () => {
      live = false;
    };
    // fn is recreated each render; key + nonce decide when to refetch.
  }, [key, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return [state, retry];
}
