import { SignedImage } from "./signed-image";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedAvatarProps {
  bucket: string;
  path: string | null;
  alt: string;
  verified?: boolean;
  className?: string;
}

export function VerifiedAvatar({
  bucket,
  path,
  alt,
  verified = false,
  className = "h-9 w-9",
}: VerifiedAvatarProps) {
  return (
    <div className={cn("relative inline-block", verified ? "m-[2.5px]" : "m-[1.5px]")}>
      {verified ? (
        <>
          <div
            className="absolute -inset-[2.5px] rounded-full opacity-80"
            style={{ background: "var(--gradient-brasa-h)" }}
          />
          <SignedImage
            bucket={bucket}
            path={path}
            alt={alt}
            className={cn(
              "relative rounded-full object-cover ring-2 ring-background",
              className
            )}
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <BadgeCheck className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </>
      ) : (
        <>
          <div className="absolute -inset-[1.5px] rounded-full border-2 border-border/80" />
          <SignedImage
            bucket={bucket}
            path={path}
            alt={alt}
            className={cn(
              "relative rounded-full object-cover ring-2 ring-background",
              className
            )}
          />
        </>
      )}
    </div>
  );
}
