import { useEffect, useState } from 'react'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

const DISMISSED_KEY = 'regionea:pwa-install-dismissed'
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || navigatorWithStandalone.standalone === true
}

function wasRecentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY))
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS
}

function isIosSafari() {
  const userAgent = navigator.userAgent
  const ios = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [iosEligible, setIosEligible] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return
    setIosEligible(isIosSafari())
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstallEvent(null)
      setIosEligible(false)
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (!installEvent && !iosEligible) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setInstallEvent(null)
    setIosEligible(false)
  }

  const install = async () => {
    if (!installEvent) {
      setShowIosHelp(true)
      return
    }
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  return (
    <aside className="install-prompt" aria-label="Instalar Regionea Atlas">
      <button className="install-dismiss" onClick={dismiss} aria-label="Cerrar sugerencia de instalación">×</button>
      <img src="/favicon.svg" alt="" aria-hidden="true" />
      <div>
        <strong>Lleva el atlas contigo</strong>
        <span>{showIosHelp ? 'Pulsa Compartir y después «Añadir a pantalla de inicio».' : 'Instala Regionea Atlas para abrirlo como una app.'}</span>
      </div>
      {!showIosHelp && <button className="install-action" onClick={install}>{installEvent ? 'Instalar' : 'Cómo instalarla'}</button>}
    </aside>
  )
}
