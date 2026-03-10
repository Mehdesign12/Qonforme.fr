"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn("relative w-full", className)}
      {...props}
    >
      {/* ── Couche aurora animée ── */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
          showRadialGradient &&
            "[mask-image:radial-gradient(ellipse_100%_80%_at_50%_-10%,black_30%,transparent_90%)]"
        )}
      >
        <div
          className={cn(
            "absolute inset-[-20%] opacity-50",
            // Gradient blanc pour le mode light (invert)
            "[--white-gradient:repeating-linear-gradient(100deg,#ffffff_0%,#ffffff_7%,transparent_10%,transparent_12%,#ffffff_16%)]",
            // Couleurs aurora : bleu, indigo, violet, cyan
            "[--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#818cf8_15%,#93c5fd_20%,#c4b5fd_25%,#60a5fa_30%)]",
            "bg-[image:var(--white-gradient),var(--aurora)]",
            "bg-[length:300%_300%,200%_200%]",
            "bg-[position:50%_50%,50%_50%]",
            "blur-[8px] invert",
            // Pseudo-élément animé
            "after:absolute after:inset-0 after:content-['']",
            "after:bg-[image:var(--white-gradient),var(--aurora)]",
            "after:bg-[length:200%_200%,150%_150%]",
            "after:animate-aurora",
            "after:mix-blend-difference"
          )}
        />
      </div>

      {children}
    </div>
  );
};
