import { DestroyRef, computed, inject, signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';
import { ApiError, toApiError } from './api-error';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LoadState<T> {
  status: LoadStatus;
  data: T | undefined;
  error: ApiError | undefined;
}

/**
 * Signal-based wrapper around one API call: tracks loading / data / error and
 * exposes reload(). Previous data stays visible while reloading, so tables do
 * not flash empty after every order. Must be created in an injection context.
 */
export function createLoader<T>(source: () => Observable<T>) {
  const destroyRef = inject(DestroyRef);
  const state = signal<LoadState<T>>({ status: 'idle', data: undefined, error: undefined });
  let subscription: Subscription | undefined;

  function reload(): void {
    subscription?.unsubscribe();
    state.update((s) => ({ ...s, status: 'loading', error: undefined }));
    subscription = source().subscribe({
      next: (data) => state.set({ status: 'ready', data, error: undefined }),
      error: (error: unknown) => state.update((s) => ({ ...s, status: 'error', error: toApiError(error) })),
    });
  }

  destroyRef.onDestroy(() => subscription?.unsubscribe());

  return {
    status: computed(() => state().status),
    data: computed(() => state().data),
    error: computed(() => state().error),
    /** True only for the first load, before any data has arrived. */
    initialLoading: computed(() => state().status === 'loading' && state().data === undefined),
    loading: computed(() => state().status === 'loading'),
    reload,
  };
}

export type Loader<T> = ReturnType<typeof createLoader<T>>;
