const options = [
    { id: 'auto', label: 'Auto' },
    { id: 'nuts0', label: 'NUTS0' },
    { id: 'nuts1', label: 'NUTS1' },
    { id: 'nuts2', label: 'NUTS2' },
    { id: 'nuts3', label: 'NUTS3' },
] as const

type V = typeof options[number]['id']

export default function GranularityDial({ value, onChange }: { value: V, onChange: (v: V) => void }) {
    return (
        <div className="row">
            {options.map(o => (
                <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
                    {o.label}
                </button>
            ))}
        </div>
    )
}