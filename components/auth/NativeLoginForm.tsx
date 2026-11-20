"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useMounted } from "@/hooks/useMounted";
import { isNativePlatform } from "@/lib/location/platform";
import { getNativeDeviceId } from "@/lib/native/device-id";

/** WebView-only login: no OAuth redirect (it cannot complete in-app). */
export default function NativeLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useMounted();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !mounted) return;
    setError("");
    setLoading(true);

    try {
      const deviceId = isNativePlatform() ? await getNativeDeviceId() : undefined;
      const result = await signIn("device-link", {
        code: code.trim(),
        deviceId,
        redirect: false,
      });

      if (result?.error) {
        setError("Kode tidak valid, kedaluwarsa, atau sudah dipakai. Minta kode baru di aplikasi web.");
        setLoading(false);
        return;
      }

      // refresh() re-runs server components with the new cookie so the
      // global location tracker sees an authenticated session immediately.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div className="space-y-2">
        <Label htmlFor="device-code">Kode dari aplikasi web</Label>
        <Input
          id="device-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          autoFocus
          disabled={loading}
          className="text-center text-2xl tracking-[0.5em]"
          aria-describedby={error ? "device-code-error" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          6 digit, berlaku 10 menit, hanya untuk satu perangkat.
        </p>
      </div>

      {error ? (
        <p id="device-code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={loading || !mounted || code.length !== 6}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Smartphone className="mr-2 h-4 w-4" />
        )}
        Hubungkan Perangkat
      </Button>
    </form>
  );
}
