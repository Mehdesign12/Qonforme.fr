import type { TopicCategory } from "@/lib/ai/seo-topics"
import { CATEGORY_CONFIG } from "@/lib/blog-utils"

interface Props {
  category: TopicCategory
  size?: "sm" | "md"
}

/**
 * Colored pill badge for article categories.
 * Server-compatible (no "use client" needed).
 */
export default function CategoryBadge({ category, size = "sm" }: Props) {
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["guide"]

  const sizeClasses = size === "md"
    ? "text-xs px-3 py-1"
    : "text-[11px] px-2 py-0.5"

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${config.color} ${config.bg} ${config.border} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}
