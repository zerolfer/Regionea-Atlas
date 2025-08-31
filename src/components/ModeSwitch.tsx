import type { Mode } from '../App'

export default function ModeSwitch({value,onChange}:{value:Mode,onChange:(m:Mode)=>void}){
  const modes: Mode[] = ['politico','relieve','transportes']
  return (
    <div className="row">
      {modes.map(m=> (
        <button key={m} className={value===m? 'active':''} onClick={()=>onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  )
}