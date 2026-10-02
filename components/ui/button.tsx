"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Boutons du canevas (« Fondations visuelles › Composants ») :
 * 40 px, rayon 10, DM Sans 600 14 px ; primaire bleu Qonforme avec reflet
 * intérieur, secondaire blanc bordé, discret sans fond, destructif bordé rouge.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:shadow-[0_0_0_4px_var(--q-focus)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-[var(--q-danger)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--q-accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_-4px_rgba(37,99,235,.6)] hover:bg-[#1D4ED8]",
        outline:
          "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-ink)] shadow-[0_1px_2px_rgba(10,17,34,.05)] hover:bg-[var(--q-sunken)] aria-expanded:bg-[var(--q-sunken)]",
        secondary:
          "bg-[var(--q-sunken)] text-[var(--q-ink)] hover:bg-[var(--q-hover)] aria-expanded:bg-[var(--q-hover)]",
        ghost:
          "text-[var(--q-text-2)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)] aria-expanded:bg-[var(--q-hover)]",
        destructive:
          "border-[var(--q-danger-line)] bg-[var(--q-surface)] text-[var(--q-danger)] hover:bg-[var(--q-danger-bg)]",
        link: "text-[var(--q-accent-strong)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        xs: "h-7 gap-1 rounded-[8px] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[34px] gap-1.5 rounded-[9px] px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 rounded-[14px] px-5 text-[15px]",
        icon: "size-10",
        "icon-xs": "size-7 rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[34px] rounded-[9px]",
        "icon-lg": "size-12 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
