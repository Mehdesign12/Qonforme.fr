'use client'

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3 py-1 text-base text-[var(--q-ink)] transition-[border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--q-placeholder)] focus-visible:border-[var(--q-accent)] focus-visible:shadow-[0_0_0_4px_var(--q-focus)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--q-sunken)] disabled:opacity-70 aria-invalid:border-[var(--q-danger)] aria-invalid:shadow-[0_0_0_4px_var(--q-danger-bg)] md:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
