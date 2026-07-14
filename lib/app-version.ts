const STORAGE_VERSION_KEY = 'ndjourney-storage-version';
const CURRENT_STORAGE_VERSION = 2;

export function checkStorageVersion(): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_VERSION_KEY);
    if (stored !== String(CURRENT_STORAGE_VERSION)) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('ndjourney-') ||
           key.startsWith('spin-') ||
           key.startsWith('tod-') ||
           key.startsWith('dailylovetask-') ||
           key.startsWith('bottle-') ||
           key.startsWith('quotes-'))
        ) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
    }
  } catch {}
}
