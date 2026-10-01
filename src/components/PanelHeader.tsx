type Props = {
  title: string
  kicker: string
  onClose?: () => void
  closeLabel?: string
  headingLevel?: 1 | 2
}

export default function PanelHeader({ title, kicker, onClose, closeLabel = 'Cerrar ficha', headingLevel = 1 }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  return (
    <header className="panel-heading">
      <div className="panel-kicker-row">
        <span className="eyebrow">{kicker}</span>
        {onClose && <button className="icon-button" onClick={onClose} aria-label={closeLabel}>×</button>}
      </div>
      <Heading>{title}</Heading>
    </header>
  )
}
