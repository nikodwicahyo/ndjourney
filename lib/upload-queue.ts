"use client";

import type { UploadSession } from "./chunked-upload";
import { SIMPLE_UPLOAD_MAX_BYTES } from "./upload-config";

export interface QueuedUpload {
  id: string;
  file: File;
  publicId: string;
  resourceType: "image" | "video" | "raw" | "auto";
  status: "pending" | "uploading" | "complete" | "error" | "cancelled" | "interrupted" | "retrying" | "paused";
  /** Album / visibility chosen for this upload, so a later retry can persist it. */
  albumId?: string;
  isPublic?: boolean;
  progress: {
    loaded: number;
    total: number;
    percent: number;
    speed: number;
    eta: number;
  };
  error?: string;
  attempts?: number;
  result?: {
    url: string;
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    duration?: number;
    thumbnailUrl: string;
    isVideo?: boolean;
  };
  startedAt?: number;
  completedAt?: number;
  /**
   * Chunked-upload session state, kept across retries so an interrupted upload
   * resumes from the last committed chunk instead of restarting at 0.
   */
  session?: UploadSession;
  /**
   * Chunk count this attempt resumed from (0 = fresh). Distinct from
   * `session` (which exists as soon as any chunk commits) so the UI only says
   * "resuming" when a retry actually continued previous progress.
   */
  resumeFrom?: number;
  /**
   * A pause has been requested but the upload is finishing its current chunk so
   * the bytes commit instead of being thrown away. Flips to `status: "paused"`
   * at the next chunk boundary.
   */
  pausing?: boolean;
}

export interface UploadQueueOptions {
  maxConcurrency: number;
  chunkSize: number;
  folder: string;
  onProgress: (upload: QueuedUpload) => void;
  onComplete: (upload: QueuedUpload) => void;
  onError: (upload: QueuedUpload, error: Error) => void;
  onAllComplete: (uploads: QueuedUpload[]) => void;
}

interface UploadTask {
  upload: QueuedUpload;
  resolve: (value: QueuedUpload) => void;
  reject: (reason: Error) => void;
  albumId?: string;
}

const MAX_AUTO_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

type RetryableReason = "timeout" | "network" | "rate-limited" | "unknown";

function classifyRetryable(error: Error | undefined): RetryableReason | null {
  if (!error) return "unknown";
  const e = error as Error & {
    isAborted?: boolean;
    isTimeout?: boolean;
    isNetworkError?: boolean;
    status?: number;
  };
  // Never auto-retry a user-initiated abort — either our flag or a raw
  // AbortError that escaped without it (e.g. a checked `signal.aborted`).
  if (e.isAborted || e.name === "AbortError") return null;
  if (e.status === 429 || /too many requests|429/i.test(error.message)) return "rate-limited";
  if (e.isTimeout || e.isNetworkError || /failed to fetch|network|timeout|terputus|habis/i.test(error.message)) {
    return "timeout";
  }
  return "unknown";
}

function backoffMs(attempts: number): number {
  const ms = BASE_BACKOFF_MS * Math.pow(2, Math.min(attempts, 4));
  const jitter = Math.random() * 0.3 * ms;
  return Math.min(MAX_BACKOFF_MS, Math.floor(ms + jitter));
}

export class UploadQueue {
  private queue: UploadTask[] = [];
  private activeCount = 0;
  private options: UploadQueueOptions;
  private abortControllers = new Map<string, AbortController>();
  /** Ids the user explicitly paused — distinguishes a pause-abort from a cancel. */
  private pausedIds = new Set<string>();
  private isProcessing = false;
  private isPaused = false;
  private completedCount = 0;
  private boundRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: UploadQueueOptions) {
    this.options = options;
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
    this.boundRetryTimers.forEach((t) => clearTimeout(t));
    this.boundRetryTimers.clear();
    this.pausedIds.clear();
  }

  /** Replaces the UI callbacks (used by React to stay subscribed to the singleton). */
  setListeners(listeners: Partial<UploadQueueOptions>): void {
    if (listeners.onProgress) this.options.onProgress = listeners.onProgress;
    if (listeners.onComplete) this.options.onComplete = listeners.onComplete;
    if (listeners.onError) this.options.onError = listeners.onError;
    if (listeners.onAllComplete) this.options.onAllComplete = listeners.onAllComplete;
  }

  private handleOnline = () => {
    this.resume();
    this.retryAllEligible();
  };

  private handleVisibility = () => {
    if (document.visibilityState === "visible") {
      this.resume();
      this.retryAllEligible();
    }
  };

  add(
    file: File,
    publicId: string,
    resourceType: "image" | "video" | "raw" | "auto",
    existingId?: string,
    albumId?: string,
    isPublic?: boolean
  ): Promise<QueuedUpload> {
    const id = existingId || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const upload: QueuedUpload = {
      id,
      file,
      publicId,
      resourceType,
      albumId,
      isPublic,
      status: "pending",
      attempts: 0,
      progress: {
        loaded: 0,
        total: file.size,
        percent: 0,
        speed: 0,
        eta: 0,
      },
    };

    return new Promise((resolve, reject) => {
      this.queue.push({ upload, resolve, reject, albumId });
      this.process();
    });
  }

  addMultiple(
    files: File[],
    publicIds: string[],
    resourceTypes: ("image" | "video" | "raw" | "auto")[],
    albumIds?: (string | undefined)[]
  ): Promise<QueuedUpload>[] {
    return files.map((file, index) =>
      this.add(file, publicIds[index], resourceTypes[index], undefined, albumIds?.[index])
    );
  }

  getAll(): QueuedUpload[] {
    return this.queue.map((t) => t.upload);
  }

  getById(id: string): QueuedUpload | undefined {
    const task = this.queue.find((t) => t.upload.id === id);
    return task?.upload;
  }

  /**
   * Re-queues a failed/cancelled/interrupted/paused upload, keeping its resume
   * session. Returns a promise that settles when *this* attempt finishes — the
   * promise from the original `add()` already settled when the first attempt
   * stopped, so a manual resume/retry needs its own to know whether to persist
   * the result. Returns null if the item is not resumable.
   */
  resetToPending(id: string): Promise<QueuedUpload> | null {
    const task = this.queue.find((t) => t.upload.id === id);
    const resumable =
      task &&
      (task.upload.status === "error" ||
        task.upload.status === "cancelled" ||
        task.upload.status === "interrupted" ||
        task.upload.status === "paused");
    if (!task || !resumable) {
      return null;
    }

    this.clearRetryTimer(id);
    this.pausedIds.delete(id);
    task.upload.status = "pending";
    task.upload.error = undefined;
    task.upload.attempts = 0;
    task.upload.pausing = false;
    // Keep upload.session — a manual retry resumes from the last committed
    // chunk. Show that progress immediately instead of snapping back to 0.
    const resumedBytes = task.upload.session?.uploadedBytes ?? 0;
    const total = task.upload.file.size;
    task.upload.progress = {
      loaded: resumedBytes,
      total,
      percent: total > 0 ? Math.round((resumedBytes / total) * 100) : 0,
      speed: 0,
      eta: 0,
    };

    const done = new Promise<QueuedUpload>((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });

    this.options.onProgress(task.upload);
    this.process();
    return done;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getPendingCount(): number {
    return this.queue.filter((t) => t.upload.status === "pending").length;
  }

  getCompletedCount(): number {
    return this.completedCount;
  }

  getTotalCount(): number {
    return this.queue.length;
  }

  isComplete(): boolean {
    return this.queue.length > 0 && this.queue.every((t) => this.isTerminal(t.upload.status));
  }

  /** Statuses where an item has settled and no further work happens without user action. */
  private isTerminal(status: QueuedUpload["status"]): boolean {
    return (
      status === "complete" ||
      status === "error" ||
      status === "cancelled" ||
      status === "interrupted" ||
      status === "paused"
    );
  }

  /**
   * Pauses an in-flight or queued upload without losing transferred bytes.
   *
   * Chunked uploads stop at the next *committed* chunk boundary: the current
   * chunk is allowed to finish (status `pausing`), so everything sent so far is
   * kept and `Lanjutkan` resumes from that boundary. Single-request uploads
   * (≤ SIMPLE_UPLOAD_MAX_BYTES) have no boundary, so they are aborted outright.
   *
   * Settles the batch promise for this item so the surrounding `uploadFiles`
   * await can't hang; a resume gets a fresh promise via `resetToPending`.
   */
  pauseUpload(id: string): boolean {
    const task = this.queue.find((t) => t.upload.id === id);
    if (!task) return false;
    const status = task.upload.status;
    if (status !== "uploading" && status !== "retrying" && status !== "pending") return false;

    this.pausedIds.add(id);
    this.clearRetryTimer(id);

    if (status === "uploading") {
      task.upload.pausing = true;
      if (task.upload.file.size <= SIMPLE_UPLOAD_MAX_BYTES) {
        // One request, no chunk boundary — the only way to stop is to abort.
        this.abortControllers.get(id)?.abort();
      }
      // Chunked: the uploader checks shouldStop between chunks and finalises.
      this.options.onProgress(task.upload);
      return true;
    }

    // Nothing in flight — pause immediately.
    task.upload.status = "paused";
    task.upload.pausing = false;
    task.upload.progress = { ...task.upload.progress, speed: 0, eta: 0 };
    this.options.onProgress(task.upload);
    task.resolve(task.upload);
    this.process();
    return true;
  }

  /**
   * Finalises an attempt as paused: keeps the resume session (so `Lanjutkan`
   * continues from the last committed chunk) and snaps the displayed progress
   * back to those committed bytes.
   */
  private finalizePaused(task: UploadTask, wasActive: boolean): void {
    const { upload } = task;
    upload.status = "paused";
    upload.pausing = false;
    upload.error = undefined;
    const committed = upload.session?.uploadedBytes ?? upload.progress.loaded;
    upload.progress.loaded = Math.min(committed, upload.progress.total);
    upload.progress.percent =
      upload.progress.total > 0
        ? Math.round((upload.progress.loaded / upload.progress.total) * 100)
        : 0;
    upload.progress = { ...upload.progress, speed: 0, eta: 0 };
    if (wasActive) this.activeCount = Math.max(0, this.activeCount - 1);
    this.options.onProgress(upload);
    task.resolve(upload);
    this.process();
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.process();
  }

  cancelAll(): void {
    this.boundRetryTimers.forEach((t) => clearTimeout(t));
    this.boundRetryTimers.clear();
    this.pausedIds.clear();
    this.queue.forEach((task) => {
      if (task.upload.status === "uploading") {
        task.upload.status = "cancelled";
        task.upload.pausing = false;
        this.options.onProgress(task.upload);
        // catch finalises the abort (decrement + settle)
        this.abortControllers.get(task.upload.id)?.abort();
        return;
      }
      if (task.upload.status === "pending" || task.upload.status === "retrying" || task.upload.status === "paused") {
        task.upload.status = "cancelled";
        task.upload.pausing = false;
        this.options.onProgress(task.upload);
        task.resolve(task.upload);
      }
    });
    this.activeCount = 0;
  }

  /** Marks in-flight / pending uploads as interrupted (e.g. on hard reload the File blob is gone). */
  interruptAll(reason = "Upload terhenti. Ketuk untuk coba lagi."): void {
    this.boundRetryTimers.forEach((t) => clearTimeout(t));
    this.boundRetryTimers.clear();
    this.queue.forEach((task) => {
      if (task.upload.status === "uploading" || task.upload.status === "pending" || task.upload.status === "retrying") {
        const controller = this.abortControllers.get(task.upload.id);
        controller?.abort();
        task.upload.status = "interrupted";
        task.upload.error = reason;
        this.options.onProgress(task.upload);
        task.resolve(task.upload);
      }
    });
    this.activeCount = 0;
  }

  /**
   * Removes only successfully completed items, keeping error/interrupted ones
   * so the user can retry them. Safe to call automatically when uploads finish.
   */
  clearCompleted(): void {
    this.queue = this.queue.filter((t) => t.upload.status !== "complete");
    this.completedCount = this.queue.filter((t) => t.upload.status === "complete").length;
  }

  /** Removes every item (completed, failed, interrupted) from the queue. */
  clearAllItems(): void {
    this.queue = [];
    this.completedCount = 0;
    this.pausedIds.clear();
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((t) => t.upload.id === id);
    if (index === -1) return false;

    const task = this.queue[index];
    this.clearRetryTimer(id);
    this.pausedIds.delete(id);
    task.upload.pausing = false;

    if (task.upload.status === "uploading") {
      // Drop the row immediately; executeUpload's catch finalises the abort
      // (decrement + settle) even though the task left the queue.
      task.upload.status = "cancelled";
      this.abortControllers.get(id)?.abort();
      this.queue.splice(index, 1);
      return true;
    }

    if (task.upload.status === "pending" || task.upload.status === "retrying" || task.upload.status === "paused") {
      task.resolve(task.upload);
    }

    this.queue.splice(index, 1);
    return true;
  }

  clearAll(): void {
    this.boundRetryTimers.forEach((t) => clearTimeout(t));
    this.boundRetryTimers.clear();
    this.queue.forEach((task) => {
      if (task.upload.status === "uploading") {
        const controller = this.abortControllers.get(task.upload.id);
        controller?.abort();
      }
      if (task.upload.status === "pending" || task.upload.status === "uploading" || task.upload.status === "retrying" || task.upload.status === "paused") {
        task.upload.status = "cancelled";
        task.upload.pausing = false;
        task.resolve(task.upload);
      }
    });
    this.queue = [];
    this.abortControllers.clear();
    this.pausedIds.clear();
    this.activeCount = 0;
    this.completedCount = 0;
    this.isProcessing = false;
    this.isPaused = false;
  }

  private clearRetryTimer(id: string) {
    const t = this.boundRetryTimers.get(id);
    if (t) {
      clearTimeout(t);
      this.boundRetryTimers.delete(id);
    }
  }

  private scheduleRetry(task: UploadTask, reason: RetryableReason) {
    // A pause was requested while this chunk was failing/stalling — honour it
    // instead of retrying behind the user's back.
    if (this.pausedIds.has(task.upload.id)) {
      this.pausedIds.delete(task.upload.id);
      this.abortControllers.delete(task.upload.id);
      this.finalizePaused(task, true);
      return;
    }

    const attempts = (task.upload.attempts || 0) + 1;
    task.upload.attempts = attempts;

    if (attempts > MAX_AUTO_RETRIES) {
      task.upload.status = "error";
      task.upload.pausing = false;
      const msg =
        reason === "rate-limited"
          ? "Terlalu banyak permintaan. Coba lagi nanti."
          : "Gagal mengupload setelah beberapa percobaan.";
      task.upload.error = msg;
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.abortControllers.delete(task.upload.id);
      task.reject(new Error(msg));
      this.options.onError(task.upload, new Error(msg));
      this.options.onProgress(task.upload);
      this.process();
      return;
    }

    task.upload.status = "retrying";
    task.upload.error = undefined;
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.abortControllers.delete(task.upload.id);
    this.options.onProgress(task.upload);

    const delay = reason === "rate-limited" ? Math.min(MAX_BACKOFF_MS, 60000) : backoffMs(attempts);

    const timer = setTimeout(() => {
      this.boundRetryTimers.delete(task.upload.id);
      if (task.upload.status !== "retrying") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        this.scheduleRetry(task, reason);
        return;
      }
      this.process();
    }, delay);
    this.boundRetryTimers.set(task.upload.id, timer);
  }

  private retryAllEligible() {
    const eligible = this.queue.filter(
      (t) => t.upload.status === "retrying" && this.boundRetryTimers.has(t.upload.id)
    );
    eligible.forEach((t) => {
      const timer = this.boundRetryTimers.get(t.upload.id);
      if (timer) {
        clearTimeout(timer);
        this.boundRetryTimers.delete(t.upload.id);
        if (t.upload.status === "retrying") this.process();
      }
    });
  }

  private process(): void {
    if (this.isProcessing || this.isPaused) return;

    this.isProcessing = true;
    try {
      while (this.activeCount < this.options.maxConcurrency) {
        // retrying tasks with a pending backoff timer are NOT eligible —
        // the timer (or retryAllEligible) owns them. Picking them here double-executes.
        const nextTask = this.queue.find(
          (t) =>
            t.upload.status === "pending" ||
            (t.upload.status === "retrying" && !this.boundRetryTimers.has(t.upload.id))
        );
        if (!nextTask) break;

        this.activeCount++;
        this.executeUpload(nextTask);
      }
    } finally {
      this.isProcessing = false;
    }

    if (this.activeCount === 0 && this.queue.length > 0) {
      this.checkAllComplete();
    }
  }

  private async executeUpload(task: UploadTask): Promise<void> {
    const { upload } = task;
    const controller = new AbortController();
    this.abortControllers.set(upload.id, controller);

    upload.status = "uploading";
    upload.startedAt = Date.now();
    upload.resumeFrom = upload.session?.completedChunks ?? 0;
    this.options.onProgress(upload);

    try {
      const { uploadFileSimple } = await import("@/lib/chunked-upload");

      const result = await uploadFileSimple(
        upload.file,
        (progress) => {
          const elapsed = (Date.now() - (upload.startedAt ?? Date.now())) / 1000;
          const speed = progress.speed > 0
            ? progress.speed
            : elapsed > 0 && progress.loaded > 0
              ? progress.loaded / elapsed
              : progress.status === "uploading" && elapsed > 0
                ? progress.loaded / elapsed
                : 0;
          upload.progress = {
            loaded: progress.loaded,
            total: progress.total,
            percent: progress.progress,
            speed,
            eta: speed > 0 ? (progress.total - progress.loaded) / speed : 0,
          };
          upload.status = progress.status === "complete" ? "complete" : "uploading";
          if (progress.status === "retrying") upload.status = "retrying";
          this.options.onProgress(upload);
        },
        controller.signal,
        {
          CHUNK_SIZES: {
            small: this.options.chunkSize,
            medium: this.options.chunkSize * 2,
            large: this.options.chunkSize * 4,
            xlarge: this.options.chunkSize * 10,
          },
          CHUNK_THRESHOLDS: {
            small: 50 * 1024 * 1024,
            medium: 200 * 1024 * 1024,
            large: 500 * 1024 * 1024,
          },
          MAX_RETRIES: 3,
          RETRY_DELAY_MS: 1000,
          PROGRESS_THROTTLE_MS: 200,
          DEFAULT_CONCURRENCY: this.options.maxConcurrency,
        },
        {
          // Resume this file's chunked-upload session across retries; persist
          // the latest session on the item so the next attempt continues it.
          resume: upload.session,
          onSession: (session) => {
            upload.session = session ?? undefined;
          },
          // Orderly pause: stop at the next committed chunk boundary so no
          // transferred bytes are discarded.
          shouldStop: () => this.pausedIds.has(upload.id),
        }
      );

      upload.result = result;
      upload.status = "complete";
      upload.completedAt = Date.now();
      // A pause requested during the *final* chunk arrives too late to stop —
      // clear it so the row doesn't stay labelled "Menjeda…" on a done upload.
      upload.pausing = false;
      this.pausedIds.delete(upload.id);
      upload.progress.percent = 100;
      upload.progress.loaded = upload.progress.total;
      upload.progress.speed = 0;
      upload.progress.eta = 0;

      this.activeCount--;
      this.completedCount++;
      this.abortControllers.delete(upload.id);

      task.resolve(upload);
      this.options.onComplete(upload);
      this.options.onProgress(upload);

      this.process();
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Upload gagal");
      const reason = classifyRetryable(err);

      if (reason === null) {
        const wasPaused = this.pausedIds.has(upload.id);
        this.pausedIds.delete(upload.id);
        this.abortControllers.delete(upload.id);
        if (wasPaused) {
          this.finalizePaused(task, true);
          return;
        }
        this.activeCount = Math.max(0, this.activeCount - 1);
        upload.status = "cancelled";
        upload.pausing = false;
        upload.progress = { ...upload.progress, speed: 0, eta: 0 };
        this.options.onProgress(upload);
        // Settle this attempt's promise so the surrounding batch doesn't hang;
        // a resume gets a fresh promise via resetToPending.
        task.resolve(upload);
        this.process();
        return;
      }

      if (reason === "unknown" && !controller.signal.aborted) {
        upload.status = "error";
        upload.error = err.message;
        upload.pausing = false;
        this.pausedIds.delete(upload.id);
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.abortControllers.delete(upload.id);
        task.reject(err);
        this.options.onError(upload, err);
        this.options.onProgress(upload);
        this.process();
        return;
      }

      this.scheduleRetry(task, reason);
    }
  }

  private checkAllComplete(): void {
    const allDone = this.queue.every((t) => this.isTerminal(t.upload.status));

    if (allDone) {
      this.isProcessing = false;
      this.options.onAllComplete(this.queue.map((t) => t.upload));
    }
  }

  getStats(): { total: number; pending: number; uploading: number; complete: number; error: number; cancelled: number; interrupted: number; retrying: number; paused: number } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.upload.status === "pending").length,
      uploading: this.queue.filter((t) => t.upload.status === "uploading").length,
      complete: this.queue.filter((t) => t.upload.status === "complete").length,
      error: this.queue.filter((t) => t.upload.status === "error").length,
      cancelled: this.queue.filter((t) => t.upload.status === "cancelled").length,
      interrupted: this.queue.filter((t) => t.upload.status === "interrupted").length,
      retrying: this.queue.filter((t) => t.upload.status === "retrying").length,
      paused: this.queue.filter((t) => t.upload.status === "paused").length,
    };
  }
}

let singleton: UploadQueue | null = null;

export function getUploadQueue(options?: Partial<UploadQueueOptions>): UploadQueue {
  if (!singleton) {
    singleton = new UploadQueue({
      // 3 matches server bulk CONCURRENCY + DEFAULT_CONCURRENCY; 5 tripped sign/server rate limits on 50-file batches
      maxConcurrency: 3,
      chunkSize: 5 * 1024 * 1024,
      folder: "ndjourney-web",
      onProgress: () => {},
      onComplete: () => {},
      onError: () => {},
      onAllComplete: () => {},
      ...options,
    });
  }
  return singleton;
}

export function createUploadQueue(options: Partial<UploadQueueOptions> = {}): UploadQueue {
  return getUploadQueue(options);
}
