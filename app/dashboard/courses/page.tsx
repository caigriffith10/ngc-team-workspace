import { redirect } from "next/navigation"

// Courses now live under Instructor Courses.
export default function CoursesPage() {
  redirect("/dashboard/instructor-courses")
}
