import { cn } from "@/lib/utils"

export function MedicalBackdrop({ variant }: { variant: "today" | "journey" }) {
  const today = variant === "today"
  return (
    <div className={cn("page-backdrop", today ? "page-backdrop-today" : "page-backdrop-journey")} aria-hidden>
      <img src="/backdrops/anatomy-left.webp" alt="" className="bd-img bd-anatomy" width={900} height={900} decoding="async" />
      {today ? (
        <img src="/backdrops/bookshelf-right.webp" alt="" className="bd-img bd-shelf" width={1100} height={825} decoding="async" />
      ) : null}
      <img src="/backdrops/desk-left.webp" alt="" className="bd-img bd-left" width={1400} height={1867} decoding="async" />
      {today ? (
        <img src="/backdrops/desk-right.webp" alt="" className="bd-img bd-right" width={1400} height={1867} decoding="async" />
      ) : null}
      <svg className="bd-img bd-ecg" viewBox="0 0 640 80" fill="none">
        <path
          d="M0 42 H78 l12-22 10 44 14-52 12 30 8-8 H640"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="bd-wash" />
    </div>
  )
}
