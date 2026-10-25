"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLetterDraft,
  isLetterDraftEmpty,
  saveLetterDraft,
  type LetterDraftFields,
} from "@/lib/letter-draft";

const SAVE_DELAY_MS = 800;

/**
 * Autosaves the letter being written to localStorage. The form owns the
 * fields and the initial restore; this hook only mirrors them to storage.
 */
export function useLetterDraft(userId: string, fields: LetterDraftFields) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const fieldsRef = useRef(fields);
  // Set after a successful send so the unmount flush cannot resurrect the draft.
  const disabledRef = useRef(false);

  // Keep the debounced save and the unmount flush reading the latest values
  // without re-registering listeners on every keystroke.
  useEffect(() => {
    fieldsRef.current = fields;
  });

  const persist = useCallback(() => {
    if (disabledRef.current) return;
    if (isLetterDraftEmpty(fieldsRef.current)) return;
    return saveLetterDraft(userId, fieldsRef.current);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLetterDraftEmpty(fieldsRef.current)) {
        // The writer emptied the form: the old draft must not come back.
        if (!disabledRef.current) {
          clearLetterDraft(userId);
          setSavedAt(null);
          setSaveFailed(false);
        }
        return;
      }
      const at = persist();
      if (at === undefined) return;
      setSavedAt(at);
      setSaveFailed(at === null);
    }, SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    userId,
    persist,
    fields.title,
    fields.content,
    fields.mood,
    fields.isTimeCapsule,
    fields.unlockDate,
    fields.unlockTime,
  ]);

  // The debounce window would otherwise eat the last sentence on navigation,
  // tab close, or mobile backgrounding.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      persist();
    };
  }, [persist]);

  /** Throw the saved draft away and keep autosaving the fresh letter. */
  const discard = useCallback(() => {
    disabledRef.current = false;
    clearLetterDraft(userId);
    setSavedAt(null);
    setSaveFailed(false);
  }, [userId]);

  /** The letter is sent: stop autosaving and remove the draft for good. */
  const clear = useCallback(() => {
    disabledRef.current = true;
    clearLetterDraft(userId);
    setSavedAt(null);
    setSaveFailed(false);
  }, [userId]);

  return { savedAt, saveFailed, discard, clear };
}
