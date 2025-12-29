"use client"

import * as React from "react"

const baseStyles =
  "inline-flex items-center justify-center rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102216] focus-visible:ring-[#2bee6c] disabled:cursor-not-allowed disabled:opacity-60"

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-[#2bee6c] text-[#102216] shadow-[0_0_15px_rgba(43,238,108,0.3)] hover:bg-[#2bee6c]/90",
  outline:
    "border border-[#28392e] bg-[#1e2e24] text-white hover:border-[#2bee6c]/30 hover:bg-[#28392e]",
  ghost: "bg-transparent text-gray-400 hover:text-white",
}

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "px-4 py-2 text-sm",
  icon: "size-12 p-0 text-[0px]",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "icon"
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        className={cn(baseStyles, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

