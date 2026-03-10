"use client";

import { cn } from "@/lib/utils";
import React, { useId } from "react";

interface LightRaysProps {
  className?: string;
  rayCount?: number;
  rayColor?: string;
  rayOpacity?: number;
  rayWidth?: number;
  duration?: number;
}

/**
 * LightRays — rayons lumineux animés (CSS pur, compatible SSR/CSP).
 * À placer dans un conteneur `relative overflow-hidden`.
 */
export function LightRays({
  className,
  rayCount = 10,
  rayColor = "#93c5fd",
  rayOpacity = 0.22,
  rayWidth = 10,
  duration = 6,
}: LightRaysProps) {
  const id = useId().replace(/:/g, "");

  const rays = Array.from({ length: rayCount }, (_, i) => {
    const seed = (i * 137.508) % 100;
    const left = (seed / 100) * 105 - 2.5;
    const delay = (i * 0.65) % duration;
    const opacity = rayOpacity * (0.5 + ((i * 0.31) % 0.55));
    const width = rayWidth * (0.55 + ((i * 0.38) % 0.9));
    const dur = duration * (0.65 + ((i * 0.19) % 0.7));
    const skew = -6 - ((i * 3) % 8);
    return { left, delay, opacity, width, dur, skew };
  });

  // keyframes injectés en <style> globale (une seule fois par rendu)
  const css = `
    ${rays.map((r, i) => `
      @keyframes lr-${id}-${i} {
        0%   { opacity: ${(r.opacity * 0.35).toFixed(3)}; transform: skewX(${r.skew}deg) scaleX(0.88); }
        45%  { opacity: ${r.opacity.toFixed(3)};           transform: skewX(${r.skew - 2}deg) scaleX(1.06); }
        100% { opacity: ${(r.opacity * 0.55).toFixed(3)}; transform: skewX(${r.skew + 2}deg) scaleX(0.93); }
      }
    `).join("")}
  `;

  return (
    <>
      {/* Inject keyframes into <head> */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

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
            <linearGradient
              id={`${id}-grad`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop offset="0%"   stopColor={rayColor} stopOpacity="1" />
              <stop offset="55%"  stopColor={rayColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor={rayColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {rays.map((ray, i) => (
            <rect
              key={i}
              x={`${ray.left}%`}
              y="-2%"
              width={`${ray.width}%`}
              height="102%"
              fill={`url(#${id}-grad)`}
              style={{
                animationName: `lr-${id}-${i}`,
                animationDuration: `${ray.dur}s`,
                animationDelay: `${ray.delay}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDirection: "alternate",
                transformOrigin: `${ray.left + ray.width / 2}% 0%`,
              }}
            />
          ))}
        </svg>

        {/* Lueur douce en haut */}
        <div
          className="absolute inset-x-0 top-0 h-52"
          style={{
            background: `radial-gradient(ellipse 70% 35% at 50% -5%, ${rayColor}55 0%, transparent 70%)`,
          }}
        />
      </div>
    </>
  );
}
