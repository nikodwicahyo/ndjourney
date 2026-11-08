import { toast } from "sonner";

const TOAST_DURATION = 4000;

export function startMutationToast(message: string): string | number {
  return toast.loading(message, { duration: Infinity });
}

export function settleMutationToast(
  id: string | number,
  type: "success" | "error",
  message: string,
): void {
  if (type === "error") {
    toast.error(message, { id, duration: TOAST_DURATION });
    return;
  }
  toast.success(message, { id, duration: TOAST_DURATION });
}
