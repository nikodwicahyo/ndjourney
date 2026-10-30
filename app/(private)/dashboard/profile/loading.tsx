import { Skeleton } from "@/components/ui";

export default function ProfileLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
    </div>
  );
}