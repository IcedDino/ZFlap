import { MousePointer2, Circle, Spline, Trash2, Undo2, Redo2, Target, Flag } from 'lucide-react'
import s from './FloatingToolbar.module.css'

export type Tool = 'select' | 'state' | 'transition' | 'delete' | 'final' | 'initial'

interface Props {
  activeTool: Tool
  onToolChange: (t: Tool) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  hidden?: boolean
}

const TOOLS: { id: Tool; Icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: 'select',     Icon: MousePointer2, label: 'Select',         shortcut: 'S' },
  { id: 'state',      Icon: Circle,        label: 'Add state',      shortcut: 'A' },
  { id: 'transition', Icon: Spline,        label: 'Add transition', shortcut: 'T' },
  { id: 'final',      Icon: Target,        label: 'Toggle final',   shortcut: 'F' },
  { id: 'initial',   Icon: Flag,          label: 'Set initial',    shortcut: 'I' },
  { id: 'delete',    Icon: Trash2,        label: 'Delete',         shortcut: 'D' },
]

export default function FloatingToolbar({
  activeTool, onToolChange, canUndo, canRedo, onUndo, onRedo, hidden,
}: Props) {
  return (
    <div className={`${s.root} ${hidden ? s.rootHidden : ''}`}>
      <div className={s.group}>
        {TOOLS.map(({ id, Icon, label, shortcut }) => (
          <button
            key={id}
            className={`${s.btn} ${activeTool === id ? s.btnActive : ''} ${id === 'delete' ? s.btnDanger : ''}`}
            title={`${label} (${shortcut})`}
            onClick={() => onToolChange(id)}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>

      <div className={s.divider} />

      <div className={s.group}>
        <button
          className={s.btn}
          title="Undo (⌘Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={17} />
        </button>
        <button
          className={s.btn}
          title="Redo (⌘⇧Z)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={17} />
        </button>
      </div>
    </div>
  )
}
