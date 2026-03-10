"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

/**
 * AuroraBackground — fond animé aurora.
 * ⚠️ Ce composant est un simple wrapper relatif, sans hauteur forcée.
 * Il hérite des dimensions de son parent.
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      {...props}
    >
      {/* Couche aurora — positionnée en absolu derrière tout le contenu */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10",
          // Dégradés aurora
          "[--white-gradient:repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)]",
          "[--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)]",
          "bg-[image:var(--white-gradient),var(--aurora)]",
          "bg-[length:300%,200%] bg-[position:50%_50%,50%_50%]",
          "filter blur-[12px] invert",
          "after:absolute after:inset-0 after:content-['']",
          "after:bg-[image:var(--white-gradient),var(--aurora)]",
          "after:bg-[length:200%,100%]",
          "after:animate-aurora",
          "after:mix-blend-difference",
          "opacity-40",
          showRadialGradient &&
            "[mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_40%,transparent_100%)]"
        )}
      />
      {children}
    </div>
  );
};
