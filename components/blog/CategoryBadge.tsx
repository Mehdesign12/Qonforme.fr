import type { TopicCategory } from "@/lib/ai/seo-topics"
import { CATEGORY_CONFIG } from "@/lib/blog-utils"
import { cn } from "@/lib/utils"

interface Props {
  category: TopicCategory
  size?: "sm" | "md"
  /** Posée sur une photo : fond blanc opaque pour rester lisible. */
  onImage?: boolean
}

/**
 * Pastille de catégorie d'article. Une seule couleur pour toutes les
 * catégories (accent unique du canevas) : le libellé suffit à les distinguer.
 * Compatible serveur (pas de « use client »).
 */
export default function CategoryBadge({ category, size = "sm", onImage = false }: Props) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["guide"]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        size === "md" ? "h-7 px-3 text-[12px]" : "h-6 px-2.5 text-[11.5px]",
        onImage
          ? "bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(10,17,34,.12)]"
          : "bg-q-wash text-q-accent-strong",
      )}
    >
      {config.label}
    </span>
  )
}
