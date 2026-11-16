import { redirect } from "next/navigation"
import LoginScreen from "@/components/LoginScreen"
import { getUser } from "@/lib/session"

// Someone who is already signed in (for example with "Remember me") goes straight to the dashboard.
export default async function Home() {
  if (await getUser()) redirect("/dashboard")
  return <LoginScreen />
}
