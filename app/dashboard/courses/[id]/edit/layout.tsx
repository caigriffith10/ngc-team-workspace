import { requireAdminPage } from "@/lib/session"

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  return children
}
