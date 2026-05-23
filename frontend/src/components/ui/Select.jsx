import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from './Icon'

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Chọn',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const normalizedOptions = useMemo(
    () => options.map((option) => (
      typeof option === 'string' ? { value: option, label: option } : option
    )),
    [options]
  )
  const selected = normalizedOptions.find((option) => String(option.value) === String(value))

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const choose = (nextValue) => {
    onChange?.(nextValue)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 shadow-sm transition-all inline-flex items-center justify-between gap-3 hover:border-emerald-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-emerald-600' : ''}`}
        />
      </button>

      {open && (
        <div className={`absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-elevated animate-scale-in ${menuClassName}`}>
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">Không có lựa chọn</div>
          ) : (
            normalizedOptions.map((option) => {
              const active = String(option.value) === String(value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => choose(option.value)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {active && <Check size={15} className="shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
