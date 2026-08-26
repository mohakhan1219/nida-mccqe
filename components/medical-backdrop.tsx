import { cn } from "@/lib/utils"

export function MedicalBackdrop({ variant }: { variant: "today" | "journey" }) {
  const today = variant === "today"
  return (
    <div className={cn("page-backdrop", today ? "page-backdrop-today" : "page-backdrop-journey")} aria-hidden>
      {today ? (
        <img
          src="/backdrops/today-atmosphere.webp"
          alt=""
          className="bd-atmosphere"
          width={1920}
          height={1080}
          decoding="async"
        />
      ) : null}
      <div className="bd-wash" />
    </div>
  )
}
