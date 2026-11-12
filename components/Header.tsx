"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

export default function Header({ children, logoHref = "/" }: { children?: React.ReactNode; logoHref?: string }) {
  // Show the navy badge until we confirm the logo file loads.
  const [logoOk, setLogoOk] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setLogoOk(true)
    img.src = "/ngc-logo.png"
  }, [])

  return (
    <header className="site-header">
      <Link href={logoHref} className="logo" aria-label="NextGen Coders">
        {logoOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/ngc-logo.png" alt="NextGen Coders logo" />
        ) : (
          <div className="logo-badge" aria-hidden="true" />
        )}
        <div className="logo-text">
          <div>NextGen</div>
          <div>Coders</div>
        </div>
      </Link>
      {children}
    </header>
  )
}
