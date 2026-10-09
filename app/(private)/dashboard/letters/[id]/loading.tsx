import LetterDetailSkeleton from "@/components/letters/LetterDetailSkeleton";

export default function LetterDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <LetterDetailSkeleton />
    </div>
  );
}
