import { requirePermPage } from "@/lib/session"

// Instructor Attendance is for roles that have the "See Instructor Attendance" permission. Everyone else uses the Schedule.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermPage("viewAttendance", "/dashboard/schedule")
  return children
}
