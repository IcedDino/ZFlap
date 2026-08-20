import { useState } from 'react'
import { Copy, Dices, Play, RotateCcw } from 'lucide-react'
import { generateRegexStrings } from '../../lib/regexTools'
import type { SimState } from '../../hooks/useSimulator'
import s from './RegexWorkspace.module.css'

interface Props { regex:string; input:string; sim:SimState; onRegex:(value:string)=>void; onInput:(value:string)=>void; onRun:()=>void; onReset:()=>void }
export default function RegexWorkspace({regex,input,sim,onRegex,onInput,onRun,onReset}:Props){
  const [generated,setGenerated]=useState<string[]>([]); const [generationError,setGenerationError]=useState<string|null>(null)
  const generate=()=>{const result=generateRegexStrings(regex,16);setGenerated(result.values);setGenerationError(result.error)}
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value)}catch{/* unavailable */}}
  return <main className={s.workspace}>
    <section className={s.card} aria-label="Regular expression editor">
      <div className={s.header}><div><span className={s.eyebrow}>Language definition</span><h1 className={s.title}>Regular Expression</h1><p>Write an expression, test a string, and generate example strings from the same language.</p></div><span className={s.badge}>REGEX</span></div>
      <label className={s.label}>Expression</label>
      <div className={s.expressionWrap}><input className={s.expression} value={regex} onChange={e=>onRegex(e.target.value)} placeholder="(a|b)*abb" spellCheck={false} aria-label="Regular expression"/></div>
      {sim.regexError&&<p className={s.error}>{sim.regexError}</p>}
      <div className={s.columns}>
        <div className={s.testPanel}><div className={s.panelHeader}><label className={s.label}>Test string</label><span className={s.resultDot} data-status={sim.status}/></div><textarea className={s.testInput} value={input} onChange={e=>onInput(e.target.value)} placeholder="Insert your test string here" spellCheck={false} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();onRun()}}}/><div className={s.actions}><button className={s.primary} onClick={onRun}><Play size={14}/>Test string</button><button className={s.secondary} onClick={onReset}><RotateCcw size={14}/>Reset</button>{sim.status==='accepted'&&<span className={s.accepted}>✓ Accepted</span>}{sim.status==='rejected'&&<span className={s.rejected}>✕ Rejected</span>}</div></div>
        <div className={s.generatorPanel}><div className={s.panelHeader}><div><label className={s.label}>Generate strings</label><p className={s.hint}>Examples accepted by the expression.</p></div><button className={s.iconButton} onClick={generate} title="Generate examples" aria-label="Generate examples"><Dices size={16}/></button></div><div className={s.generatedList}>{generationError&&<p className={s.error}>{generationError}</p>}{!generationError&&generated.length===0&&<p className={s.empty}>Press generate to create examples.</p>}{generated.map((value,index)=><button key={`${value}-${index}`} className={s.generatedItem} onClick={()=>copy(value)} title="Copy string"><code>{value||'ε'}</code><Copy size={12}/></button>)}</div></div>
      </div>
      <div className={s.syntax}><span>Supports</span><code>groups</code><code>| alternation</code><code>* + ?</code><code>{'{m,n}'}</code><code>[a-z]</code><code>\\d \\w \\s</code></div>
    </section>
  </main>
}
