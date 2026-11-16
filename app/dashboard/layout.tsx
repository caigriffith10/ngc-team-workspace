import { redirect } from "next/navigation"
import DashboardNav from "@/components/DashboardNav"
import ThemeSync from "@/components/ThemeSync"
import { getUser } from "@/lib/session"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/")

  return (
    <div className="dash">
      <ThemeSync theme={user.theme} />
      <DashboardNav role={user.role} />
      {children}
    </div>
  )
}
