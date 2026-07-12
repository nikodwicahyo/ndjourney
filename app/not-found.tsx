import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-6xl text-primary">404</h1>
        <p className="text-xl text-muted-foreground">
          Halaman yang kamu cari tidak ditemukan
        </p>
        <p className="text-sm text-muted-foreground">
          Mungkin cerita ini belum ditulis &mdash; atau tersesat di dimensi lain
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Kembali ke Home
      </Link>
    </div>
  );
}
