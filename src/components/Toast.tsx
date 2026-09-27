import { useEffect, useState } from 'react'

const TOAST_TIMEOUT_MS = 7500

export default function Toast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), TOAST_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      <div className={"toast" + (visible ? " show" : "")}>{message}</div>
    </div>
  )
}


