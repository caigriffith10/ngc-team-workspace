import { redirect } from "next/navigation"
import DashboardNav from "@/components/DashboardNav"
import { getUser } from "@/lib/session"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/")

  return (
    <div className="dash">
      <DashboardNav role={user.role} />
      {children}
    </div>
  )
}
