import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "NextGen Coders Team Workspace",
  description: "Training courses for NextGen Coders volunteers and instructors.",
  // Plain static path (public/apple-touch-icon.png) so iPhones always find it for "Add to Home Screen".
  icons: { apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, title: "NGC Workspace", statusBarStyle: "default" },
}

// Runs before the page paints so dark mode doesn't flash white first.
const themeScript = `try{var t=localStorage.getItem("ngc.theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
