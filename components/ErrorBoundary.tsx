"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { Heart } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Heart className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Oops, terjadi kesalahan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Coba refresh halaman atau kembali
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Kembali
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
