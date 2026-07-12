import { Heart } from "lucide-react";

type SectionHeadingProps = {
  children: React.ReactNode;
  id?: string;
};

export default function SectionHeading({ children, id }: SectionHeadingProps) {
  return (
    <div id={id} className="mb-8 flex items-center gap-3 px-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-primary/20" />
      <div className="flex shrink-0 items-center gap-2">
        <Heart className="h-3.5 w-3.5 fill-primary/40 text-primary/40" />
        <span className="font-heading text-sm font-semibold tracking-wide text-foreground">
          {children}
        </span>
        <Heart className="h-3.5 w-3.5 fill-primary/40 text-primary/40" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent via-primary/30" />
    </div>
  );
}
