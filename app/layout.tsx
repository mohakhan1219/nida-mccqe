import type { Metadata, Viewport } from "next"
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { WorkspaceProvider } from "@/lib/data/workspace-context"
import { AppShell } from "@/components/app-shell"
import { RegisterSW } from "@/components/register-sw"
import "./globals.css"

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const heading = Libre_Baskerville({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Dr. Nida's MCCQE1 Journey",
  description: "From MBBS to Canadian Physician 🇨🇦",
  applicationName: "Dr. Nida's MCCQE1 Journey",
  appleWebApp: {
    capable: true,
    title: "MCCQE1 Journey",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
}

export const viewport: Viewport = {
  themeColor: "#1f4a52",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} h-full light`}
    >
      <body className="min-h-full text-foreground">
        <TooltipProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
          <Toaster />
          <RegisterSW />
        </TooltipProvider>
      </body>
    </html>
  )
}
