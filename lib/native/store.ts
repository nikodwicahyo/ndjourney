/** No-op subscribe for client-only snapshots read through useSyncExternalStore. */
export function noopSubscribe(): () => void {
  return () => {};
}
