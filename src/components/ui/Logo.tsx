import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@/utils/cn";

interface LogoProps {
  variant?: "image" | "icon";
  href?: string;
  noLink?: boolean;
  className?: string;
  imgClassName?: string;
  iconClassName?: string;
  textClassName?: string;
  iconSize?: number;
}

export default function Logo({
  variant = "icon",
  href = "/",
  noLink = false,
  className,
  imgClassName,
  iconClassName,
  textClassName,
  iconSize = 20,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      {variant === "image" ? (
        <img
          src="/eazi-studio.png"
          alt="Eazi Studio Logo"
          className={cn("h-12 md:h-20 object-contain", imgClassName)}
        />
      ) : (
        <>
          <div className={cn("p-2 rounded-lg bg-linear-to-br from-[#E00C1D] to-[#ff6a3d] flex items-center justify-center shrink-0", iconClassName)}>
            <Video size={iconSize} className="text-white" />
          </div>
          <span className={cn("text-foreground dark:text-white font-bold text-xl tracking-tight", textClassName)}>
            Eazi Studio
          </span>
        </>
      )}
    </div>
  );

  if (noLink) {
    return content;
  }

  return (
    <Link href={href} className="inline-block cursor-pointer">
      {content}
    </Link>
  );
}
