import { cn } from "@/lib/utils"

export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-xl border border-input bg-card bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b5a7a%22 stroke-width=%222%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 md:h-10 md:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("mb-1.5 block text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase", className)}>
      {children}
    </label>
  )
}
