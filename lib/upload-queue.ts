"use client";

export interface QueuedUpload {
  id: string;
  file: File;
  publicId: string;
  resourceType: "image" | "video" | "auto";
  status: "pending" | "uploading" | "complete" | "error" | "cancelled";
  progress: {
    loaded: number;
    total: number;
    percent: number;
    speed: number;
    eta: number;
  };
  error?: string;
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
}

export class UploadQueue {
  private queue: UploadTask[] = [];
  private activeCount = 0;
  private options: UploadQueueOptions;
  private abortControllers = new Map<string, AbortController>();
  private isProcessing = false;
  private isPaused = false;
  private completedCount = 0;

  constructor(options: UploadQueueOptions) {
    this.options = options;
  }

  add(
    file: File,
    publicId: string,
    resourceType: "image" | "video" | "auto"
  ): Promise<QueuedUpload> {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const upload: QueuedUpload = {
      id,
      file,
      publicId,
      resourceType,
      status: "pending",
      progress: {
        loaded: 0,
        total: file.size,
        percent: 0,
        speed: 0,
        eta: 0,
      },
    };

    return new Promise((resolve, reject) => {
      this.queue.push({ upload, resolve, reject });
      this.process();
    });
  }

  addMultiple(files: File[], publicIds: string[], resourceTypes: ("image" | "video" | "auto")[]): Promise<QueuedUpload>[] {
    return files.map((file, index) => this.add(file, publicIds[index], resourceTypes[index]));
  }

  getAll(): QueuedUpload[] {
    return this.queue.map((t) => t.upload);
  }

  getById(id: string): QueuedUpload | undefined {
    const task = this.queue.find((t) => t.upload.id === id);
    return task?.upload;
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
      t.upload.status === "complete" || t.upload.status === "error" || t.upload.status === "cancelled"
    );
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.process();
  }

  cancel(id: string): boolean {
    const task = this.queue.find((t) => t.upload.id === id);
    if (!task) return false;

    if (task.upload.status === "uploading") {
      const controller = this.abortControllers.get(id);
      controller?.abort();
    }

    task.upload.status = "cancelled";
    this.options.onProgress(task.upload);
    return true;
  }

  cancelAll(): void {
    this.queue.forEach((task) => {
      if (task.upload.status === "uploading" || task.upload.status === "pending") {
        const controller = this.abortControllers.get(task.upload.id);
        controller?.abort();
        task.upload.status = "cancelled";
        this.options.onProgress(task.upload);
      }
    });
  }

  clearCompleted(): void {
    this.queue = this.queue.filter(
      (t) => t.upload.status !== "complete" && t.upload.status !== "error"
    );
    this.completedCount = this.queue.filter((t) => t.upload.status === "complete").length;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((t) => t.upload.id === id);
    if (index === -1) return false;

    const task = this.queue[index];
    if (task.upload.status === "uploading") {
      const controller = this.abortControllers.get(id);
      controller?.abort();
    }

    this.queue.splice(index, 1);
    return true;
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;

    this.isProcessing = true;
    try {
      while (this.activeCount < this.options.maxConcurrency) {
        const nextTask = this.queue.find((t) => t.upload.status === "pending");
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
          upload.progress = {
            loaded: progress.loaded,
            total: progress.total,
            percent: progress.progress,
            speed: progress.speed,
            eta: progress.eta,
          };
          upload.status = progress.status === "complete" ? "complete" : "uploading";
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
          SINGLE_FILE_MAX_SIZE: 25 * 1024 * 1024,
          MAX_RETRIES: 1,
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
      const err = error instanceof Error ? error : new Error("Upload failed");
      
      if (controller.signal.aborted) {
        upload.status = "cancelled";
        task.resolve(upload);
      } else {
        upload.status = "error";
        upload.error = err.message;
        
        this.activeCount--;
        this.abortControllers.delete(upload.id);
        
        task.reject(err);
        this.options.onError(upload, err);
        this.options.onProgress(upload);
        
        this.process();
      }
    }
  }

  private checkAllComplete(): void {
    const allDone = this.queue.every(
      (t) => t.upload.status === "complete" || t.upload.status === "error" || t.upload.status === "cancelled"
    );
    
    if (allDone) {
      this.isProcessing = false;
      this.options.onAllComplete(this.queue.map((t) => t.upload));
    }
  }

  getStats(): { total: number; pending: number; uploading: number; complete: number; error: number; cancelled: number } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.upload.status === "pending").length,
      uploading: this.queue.filter((t) => t.upload.status === "uploading").length,
      complete: this.queue.filter((t) => t.upload.status === "complete").length,
      error: this.queue.filter((t) => t.upload.status === "error").length,
      cancelled: this.queue.filter((t) => t.upload.status === "cancelled").length,
    };
  }
}

export function createUploadQueue(options: Partial<UploadQueueOptions> = {}): UploadQueue {
  const defaultOptions: UploadQueueOptions = {
    maxConcurrency: 5,
    chunkSize: 5 * 1024 * 1024,
    folder: "ndjourney-web",
    onProgress: () => {},
    onComplete: () => {},
    onError: () => {},
    onAllComplete: () => {},
    ...options,
  };
  
  return new UploadQueue(defaultOptions);
}