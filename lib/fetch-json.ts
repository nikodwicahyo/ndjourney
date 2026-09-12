/**
 * Client-side JSON fetch for React Query hooks.
 * Throws with server message on !ok so UI error states work;
 * returns [] fallback only when caller explicitly wants it.
 */
// ponytail: one fetch path for hooks; stops silent empty-list swallowing.
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return (json as { data: T }).data ?? (json as T);
}

export async function fetchJsonList<T>(url: string, init?: RequestInit): Promise<T[]> {
  const data = await fetchJson<T[] | undefined>(url, init);
  return (data ?? []) as T[];
}
