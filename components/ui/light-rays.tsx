"use client";

import { cn } from "@/lib/utils";
import React, { useId } from "react";

interface LightRaysProps {
  className?: string;
  /** Nombre de rayons (défaut : 10) */
  rayCount?: number;
  /** Couleur principale des rayons */
  rayColor?: string;
  /** Opacité max d'un rayon (0-1) */
  rayOpacity?: number;
  /** Largeur en % de chaque rayon */
  rayWidth?: number;
  /** Durée animation en secondes */
  duration?: number;
}

/**
 * LightRays — rayons lumineux animés qui émanent du haut.
 * Positionner en absolu à l'intérieur d'un conteneur `relative overflow-hidden`.
 */
export function LightRays({
  className,
  rayCount = 10,
  rayColor = "#ffffff",
  rayOpacity = 0.25,
  rayWidth = 12,
  duration = 6,
}: LightRaysProps) {
  const id = useId();

  const rays = Array.from({ length: rayCount }, (_, i) => {
    // Distribution sur la largeur, légèrement aléatoire mais déterministe
    const seed = (i * 137.508) % 100; // golden angle distribution
    const left = (seed / 100) * 110 - 5; // de -5% à 105%
    const delay = (i * 0.7) % duration;
    const individualOpacity = rayOpacity * (0.5 + ((i * 0.3) % 0.6));
    const width = rayWidth * (0.6 + ((i * 0.4) % 0.8));
    const animDuration = duration * (0.7 + ((i * 0.2) % 0.6));

    return { left, delay, opacity: individualOpacity, width, animDuration };
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradient vertical : opaque en haut, transparent en bas */}
          <linearGradient
            id={`${id}-ray-gradient`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={rayColor} stopOpacity="1" />
            <stop offset="60%" stopColor={rayColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={rayColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {rays.map((ray, i) => (
          <g key={i}>
            <rect
              x={`${ray.left}%`}
              y="-5%"
              width={`${ray.width}%`}
              height="110%"
              fill={`url(#${id}-ray-gradient)`}
              opacity={ray.opacity}
              transform={`skewX(-8)`}
              style={{
                transformOrigin: `${ray.left + ray.width / 2}% 0`,
                animation: `light-ray-pulse-${id}-${i} ${ray.animDuration}s ease-in-out ${ray.delay}s infinite alternate`,
              }}
            />
            <style>{`
              @keyframes light-ray-pulse-${id}-${i} {
                0%   { opacity: ${ray.opacity * 0.4}; transform: skewX(-8deg) scaleX(0.9); }
                50%  { opacity: ${ray.opacity};       transform: skewX(-6deg) scaleX(1.05); }
                100% { opacity: ${ray.opacity * 0.6}; transform: skewX(-10deg) scaleX(0.95); }
              }
            `}</style>
          </g>
        ))}
      </svg>

      {/* Lueur diffuse en haut */}
      <div
        className="absolute inset-x-0 top-0 h-48 opacity-30"
        style={{
          background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${rayColor} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
