"use client"

/** fetch wrapper: sends JSON, throws Error(message) on failure, sends signed-out users to the login screen. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !url.startsWith("/api/login")) {
    window.location.href = "/"
    throw new Error("Signed out.")
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong.")
  return data as T
}

export const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
