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
    <div className={cn("relative w-full bg-white", className)} {...props}>
      {/* ── Couche aurora ── */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
          showRadialGradient &&
            "[mask-image:radial-gradient(ellipse_120%_70%_at_60%_0%,black_20%,transparent_80%)]"
        )}
      >
        {/*
          Technique : on pose le gradient aurora directement en couleurs douces
          sans invert ni blur excessif → visible immédiatement sur fond blanc.
        */}
        <div
          className={cn(
            "absolute inset-0 animate-aurora",
            "bg-[linear-gradient(125deg,#EFF6FF_0%,#EEF2FF_20%,#F5F3FF_35%,#E0F2FE_50%,#EFF6FF_65%,#F0FDF4_80%,#EEF2FF_100%)]",
            "bg-[length:400%_400%]",
            "opacity-100"
          )}
        />
        {/* Deuxième couche légèrement décalée pour l'effet de mouvement */}
        <div
          className={cn(
            "absolute inset-0 animate-aurora",
            "bg-[radial-gradient(ellipse_80%_50%_at_20%_-20%,rgba(37,99,235,0.12)_0%,transparent_60%),radial-gradient(ellipse_60%_40%_at_80%_10%,rgba(124,58,237,0.10)_0%,transparent_50%),radial-gradient(ellipse_50%_60%_at_50%_100%,rgba(16,185,129,0.06)_0%,transparent_70%)]",
            "[animation-delay:4s]"
          )}
        />
      </div>

      {children}
    </div>
  );
};
