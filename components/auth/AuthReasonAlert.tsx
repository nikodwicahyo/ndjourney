"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Timer, ShieldAlert } from "lucide-react";

const messages: Record<string, { icon: typeof AlertCircle; title: string }> = {
  expired: { icon: Timer, title: "Sesi berakhir. Silakan login kembali." },
  unauthorized: { icon: ShieldAlert, title: "Akses ditolak. Silakan login terlebih dahulu." },
};

type Props = {
  reason?: string;
};

export default function AuthReasonAlert({ reason }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reason && messages[reason]) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [reason]);

  if (!visible || !reason || !messages[reason]) return null;

  const { icon: Icon, title } = messages[reason];

  return (
    <div className="flex animate-in fade-in slide-in-from-top-2 items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <Icon className="h-5 w-5 shrink-0" />
      <span>{title}</span>
    </div>
  );
}
