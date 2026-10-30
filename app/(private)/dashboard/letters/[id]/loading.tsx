import { Skeleton } from "@/components/ui";

export default function LetterDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
}