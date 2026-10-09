import LetterDetailSkeleton from "@/components/letters/LetterDetailSkeleton";

export default function PublicLetterDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <LetterDetailSkeleton />
    </div>
  );
}
