// Both official public services cap traffic at 1 request/second and forbid
// bursts. One shared queue keeps this app under that limit for OSRM and
// Nominatim alike (a stricter, but simpler, single limit).
// Sources:
// - https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
// - https://operations.osmfoundation.org/policies/nominatim/
const MIN_INTERVAL_MS = 1100;

let chain: Promise<void> = Promise.resolve();
let lastAt = 0;

/** Serialize upstream calls; never fire two public-OSM requests inside one second. */
export function pacedFetch(url: string, init: RequestInit): Promise<Response> {
  const run = chain.then(async () => {
    // Clamp: a clock jump (or fake timers in tests) must never produce a
    // multi-year wait.
    const wait = Math.max(
      0,
      Math.min(MIN_INTERVAL_MS, MIN_INTERVAL_MS - (Date.now() - lastAt)),
    );
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastAt = Date.now();
    return fetch(url, init);
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
