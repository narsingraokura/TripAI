import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import Navigation from "@/components/Navigation"

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased light", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <Navigation />
        <div className="pb-16 md:pb-0">{children}</div>
      </body>
    </html>
  )
}