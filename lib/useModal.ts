"use client"

import { useEffect, useRef } from "react"

const open: symbol[] = [] // stack of open dialogs, so Escape and Tab only act on the top one

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Makes a pop-up behave like a proper dialog: Escape closes it, Tab stays inside it,
 * focus moves into it when it opens and goes back to what was focused before when it closes.
 * Put the returned ref on the element that has role="dialog".
 */
export function useModal<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const me = Symbol("modal")
    open.push(me)
    const before = document.activeElement as HTMLElement | null
    const root = ref.current
    const items = () => (root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : [])
    ;(items()[0] ?? root)?.focus()

    function onKey(e: KeyboardEvent) {
      if (open[open.length - 1] !== me) return
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return }
      if (e.key !== "Tab") return
      const list = items()
      if (list.length === 0) { e.preventDefault(); return }
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      open.splice(open.indexOf(me), 1)
      before?.focus?.()
    }
  }, [])

  return ref
}
