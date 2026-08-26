import Image from "next/image"
import { cn } from "@/lib/utils"

export function NidaPortrait({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <div className={cn("nida-hero-photo pointer-events-none select-none", className)}>
      <Image
        src="/nida-portrait.webp"
        alt="Dr. Nida"
        width={800}
        height={1200}
        priority={priority}
        sizes="(max-width: 768px) 70vw, 340px"
        className="h-full w-full object-contain object-bottom"
      />
    </div>
  )
}

export function NidaAvatar({
  size = 52,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full bg-[oklch(0.94_0.02_85)] shadow-[0_1px_2px_rgba(40,30,20,0.12)] ring-1 ring-primary/15",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/nida-avatar.webp"
        alt="Dr. Nida"
        width={size * 2}
        height={size * 2}
        className="h-full w-full object-cover object-[50%_18%]"
      />
    </span>
  )
}
