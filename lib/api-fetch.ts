import { signOut } from "next-auth/react";

const AUTH_ERROR_CODES = [401, 403];

function isAuthError(status: number) {
  return AUTH_ERROR_CODES.includes(status);
}

function getAuthErrorMessage(status: number): string {
  if (status === 401) return "Sesi berakhir. Silakan login kembali.";
  if (status === 403) return "Kamu tidak memiliki akses.";
  return "";
}

async function handleAuthError(status: number) {
  const message = getAuthErrorMessage(status);
  const { toast } = await import("sonner");
  toast.error(message, {
    duration: 5000,
    action: {
      label: "Login",
      onClick: () => signOut({ callbackUrl: "/login?reason=expired" }),
    },
  });
  await signOut({ redirect: false });
  window.location.href = "/login?reason=expired&callbackUrl=" + encodeURIComponent(window.location.pathname);
}

type ApiOptions = RequestInit & {
  ignoreAuthError?: boolean;
};

export async function apiFetch<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const { ignoreAuthError, ...fetchOptions } = options;

  const res = await fetch(url, {
    credentials: "include",
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    if (!ignoreAuthError && isAuthError(res.status)) {
      await handleAuthError(res.status);
      throw new Error(getAuthErrorMessage(res.status));
    }

    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export async function apiFetchRaw(url: string, options: ApiOptions = {}): Promise<Response> {
  const { ignoreAuthError, ...fetchOptions } = options;

  const res = await fetch(url, {
    credentials: "include",
    ...fetchOptions,
  });

  if (!res.ok && !ignoreAuthError && isAuthError(res.status)) {
    await handleAuthError(res.status);
    throw new Error(getAuthErrorMessage(res.status));
  }

  return res;
}
