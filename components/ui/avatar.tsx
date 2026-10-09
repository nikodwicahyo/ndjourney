"use client";

import { forwardRef, useState } from "react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";

const Avatar = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

type AvatarImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "width" | "height" | "srcSet" | "loading" | "decoding"
> & {
  src?: string;
  alt?: string;
};

const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, onError, src, alt = "", ...props }, ref) => {
    const [hasError, setHasError] = useState(false);
    if (!src || hasError) return null;
    return (
      <NextImage
        ref={ref}
        src={src}
        alt={alt}
        fill
        sizes="64px"
        className={cn("object-cover", className)}
        onError={(e) => {
          setHasError(true);
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium",
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
