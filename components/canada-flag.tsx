import { cn } from "@/lib/utils"

export function CanadaFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 30"
      className={cn("inline-block overflow-hidden rounded-[1px]", className)}
      role="img"
      aria-label="Canada"
      focusable="false"
    >
      <rect width="60" height="30" fill="#fff" />
      <rect width="15" height="30" fill="#D52B1E" />
      <rect x="45" width="15" height="30" fill="#D52B1E" />
      <path
        fill="#D52B1E"
        d="M30 5.4c.35 1.7.85 3.05 1.55 3.2 1.15-1.05 3.25-2.45 4.05-1.5.55.75-.4 2.1-1.05 3.15 1.55-.2 3.9-.1 4.2 1.05.3 1.05-1.9 1.9-3.25 2.4 1.15.75 2.55 2.2 2 3.15-.55.85-2.5.2-3.8-.4.4 1.35.55 3.25-.5 3.65-1.05.4-2-1.55-2.55-2.85-.55 1.3-1.5 3.25-2.55 2.85-1.05-.4-.9-2.3-.5-3.65-1.3.6-3.25 1.25-3.8.4-.55-.95.85-2.4 2-3.15-1.35-.5-3.55-1.35-3.25-2.4.3-1.15 2.65-1.25 4.2-1.05-.65-1.05-1.6-2.4-1.05-3.15.8-.95 2.9-.45 4.05 1.5.7-.15 1.2-1.5 1.55-3.2z"
      />
    </svg>
  )
}

export function BrandSubtitle({ className }: { className?: string }) {
  return (
    <p className={cn("mt-1 text-sm text-muted-foreground", className)}>
      From MBBS to Canadian Physician{" "}
      <CanadaFlag className="mb-px ml-0.5 h-[13px] w-[26px] align-[-1px] shadow-[0_0_0_1px_rgba(40,20,20,0.08)]" />
    </p>
  )
}
