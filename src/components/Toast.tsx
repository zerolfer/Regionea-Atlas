import { useEffect, useState } from 'react'

export default function Toast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false)
  const timeoutMs = 2500 * 3

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), timeoutMs)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      <div className={"toast" + (visible ? " show" : "")}>{message}</div>
    </div>
  )
}


