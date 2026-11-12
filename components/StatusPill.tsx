import { CourseStatus, STATUS_LABEL, STATUS_TONE } from "@/lib/status"

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export function StatusPill({ status }: { status: CourseStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
}

export function PublishPill({ published }: { published: boolean }) {
  return published ? <Pill tone="green">Published</Pill> : <Pill tone="gray">Draft</Pill>
}
