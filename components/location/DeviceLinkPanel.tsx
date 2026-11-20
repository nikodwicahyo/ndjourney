"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";
import { useMounted } from "@/hooks/useMounted";
import { isNativePlatform } from "@/lib/location/platform";

type Code = { code: string; expiresAt: string };

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** PWA side of native login: mint a short-lived, one-time 6-digit code. */
export default function DeviceLinkPanel() {
  const mounted = useMounted();
  const [data, setData] = useState<Code | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data]);

  const remaining = data ? Math.max(0, Math.ceil((Date.parse(data.expiresAt) - now) / 1000)) : 0;
  useEffect(() => {
    if (data && remaining === 0) setData(null);
  }, [data, remaining]);

  if (!mounted || isNativePlatform()) return null;

  async function mint() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/device-link", { method: "POST", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat kode");
      setData(json.data as Code);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat kode");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    setLoading(true);
    try {
      await fetch("/api/auth/device-link", { method: "DELETE", cache: "no-store" });
      setData(null);
    } catch {
      /* the code expires on its own in 10 minutes anyway */
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 w-full max-w-xl rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-primary/10 p-2 text-primary">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg">Hubungkan perangkat</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Masukkan kode ini di aplikasi NDjourney di HP untuk login dengan akun yang sama.
          </p>
        </div>
      </div>

      {data ? (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className="flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
            <span className="font-mono text-4xl tracking-[0.35em] text-foreground">{data.code}</span>
            <span className="text-sm tabular-nums text-muted-foreground">{mmss(remaining)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.code);
                  setCopied(true);
                } catch {
                  setError("Salinan gagal — ketik kodenya manual.");
                }
              }}
            >
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Tersalin" : "Salin kode"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void revoke()} disabled={loading}>
              Batalkan kode
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button type="button" onClick={() => void mint()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Buat kode perangkat
          </Button>
        </div>
      )}

      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
