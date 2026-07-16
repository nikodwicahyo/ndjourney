"use client";

export interface QueuedUpload {
  id: string;
  file: File;
  publicId: string;
  resourceType: "image" | "video" | "raw" | "auto";
  status: "pending" | "uploading" | "complete" | "error" | "cancelled" | "interrupted" | "retrying";
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
  // Never auto-retry a user-initiated abort.
  if (e.isAborted) return null;
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
    albumId?: string
  ): Promise<QueuedUpload> {
    const id = existingId || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const upload: QueuedUpload = {
      id,
      file,
      publicId,
      resourceType,
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

  resetToPending(id: string): boolean {
    const task = this.queue.find((t) => t.upload.id === id);
    if (!task || (task.upload.status !== "error" && task.upload.status !== "cancelled" && task.upload.status !== "interrupted")) {
      return false;
    }

    this.clearRetryTimer(id);
    task.upload.status = "pending";
    task.upload.error = undefined;
    task.upload.attempts = 0;
    task.upload.progress = {
      loaded: 0,
      total: task.upload.file.size,
      percent: 0,
      speed: 0,
      eta: 0,
    };
    this.options.onProgress(task.upload);
    this.process();
    return true;
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
    return this.queue.length > 0 && this.queue.every((t) =>
      t.upload.status === "complete" || t.upload.status === "error" || t.upload.status === "cancelled" || t.upload.status === "interrupted"
    );
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.process();
  }

  cancel(id: string): boolean {
    const task = this.queue.find((t) => t.upload.id === id);
    if (!task) return false;

    const wasUploading = task.upload.status === "uploading";
    if (wasUploading) {
      const controller = this.abortControllers.get(id);
      controller?.abort();
    }

    this.clearRetryTimer(id);
    task.upload.status = "cancelled";
    this.options.onProgress(task.upload);
    if (wasUploading) {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
    task.resolve(task.upload);
    this.process();
    return true;
  }

  cancelAll(): void {
    this.boundRetryTimers.forEach((t) => clearTimeout(t));
    this.boundRetryTimers.clear();
    this.queue.forEach((task) => {
      if (task.upload.status === "uploading" || task.upload.status === "pending" || task.upload.status === "retrying") {
        const controller = this.abortControllers.get(task.upload.id);
        controller?.abort();
        task.upload.status = "cancelled";
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
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((t) => t.upload.id === id);
    if (index === -1) return false;

    const task = this.queue[index];
    this.clearRetryTimer(id);
    if (task.upload.status === "uploading") {
      const controller = this.abortControllers.get(id);
      controller?.abort();
    }
    if (task.upload.status === "pending" || task.upload.status === "retrying") {
      task.resolve(task.upload);
    }
    if (task.upload.status === "uploading") {
      this.activeCount = Math.max(0, this.activeCount - 1);
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
      if (task.upload.status === "pending" || task.upload.status === "uploading" || task.upload.status === "retrying") {
        task.upload.status = "cancelled";
        task.resolve(task.upload);
      }
    });
    this.queue = [];
    this.abortControllers.clear();
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
    const attempts = (task.upload.attempts || 0) + 1;
    task.upload.attempts = attempts;

    if (attempts > MAX_AUTO_RETRIES) {
      task.upload.status = "error";
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
        const nextTask = this.queue.find(
          (t) => t.upload.status === "pending" || t.upload.status === "retrying"
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
        }
      );

      upload.result = result;
      upload.status = "complete";
      upload.completedAt = Date.now();
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
        upload.status = "cancelled";
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.abortControllers.delete(upload.id);
        task.resolve(upload);
        this.process();
        return;
      }

      if (reason === "unknown" && !controller.signal.aborted) {
        upload.status = "error";
        upload.error = err.message;
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
    const allDone = this.queue.every(
      (t) => t.upload.status === "complete" || t.upload.status === "error" || t.upload.status === "cancelled" || t.upload.status === "interrupted"
    );

    if (allDone) {
      this.isProcessing = false;
      this.options.onAllComplete(this.queue.map((t) => t.upload));
    }
  }

  getStats(): { total: number; pending: number; uploading: number; complete: number; error: number; cancelled: number; interrupted: number; retrying: number } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.upload.status === "pending").length,
      uploading: this.queue.filter((t) => t.upload.status === "uploading").length,
      complete: this.queue.filter((t) => t.upload.status === "complete").length,
      error: this.queue.filter((t) => t.upload.status === "error").length,
      cancelled: this.queue.filter((t) => t.upload.status === "cancelled").length,
      interrupted: this.queue.filter((t) => t.upload.status === "interrupted").length,
      retrying: this.queue.filter((t) => t.upload.status === "retrying").length,
    };
  }
}

let singleton: UploadQueue | null = null;

export function getUploadQueue(options?: Partial<UploadQueueOptions>): UploadQueue {
  if (!singleton) {
    singleton = new UploadQueue({
      maxConcurrency: 5,
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
