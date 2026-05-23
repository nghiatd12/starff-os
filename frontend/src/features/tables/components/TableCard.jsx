import { Armchair, UtensilsCrossed, Hourglass, CalendarCheck, Clock, MapPin, Users } from '@/components/ui/Icon'

const TABLE_STATUS_CONFIG = {
  empty: {
    label: 'Trống',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-500',
    dot: 'bg-slate-300',
    pulse: false,
  },
  occupied: {
    label: 'Có khách',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  waiting: {
    label: 'Chờ thanh toán',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    pulse: true,
  },
  reserved: {
    label: 'Đặt trước',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    pulse: false,
  },
}

const STATUS_ICON = {
  empty: Armchair,
  occupied: UtensilsCrossed,
  waiting: Hourglass,
  reserved: CalendarCheck,
}

const ZONE_LABELS = {
  indoor: 'Trong nhà',
  outdoor: 'Ngoài trời',
  vip: 'Phòng VIP',
}

const formatElapsed = (minutes = 0) => {
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hours}h ${mins}p` : `${hours}h`
}

export default function TableCard({ table, isSelected, onClick }) {
  const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.empty
  const IconComp = STATUS_ICON[table.status] || Armchair
  const hasOrder = table.status !== 'empty'
  const zoneLabel = ZONE_LABELS[table.zone] || table.zone || 'Chưa có khu vực'

  return (
    <button
      onClick={onClick}
      className={`${cfg.bg} border ${cfg.border} rounded-3xl p-4 text-left transition-all duration-200 hover:shadow-card relative h-[170px] flex flex-col
        ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-card' : 'hover:-translate-y-0.5'}
        ${cfg.pulse ? 'pulse-live' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200/50 flex items-center justify-center flex-shrink-0">
          <IconComp size={16} className={cfg.text} />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-500">
          <MapPin size={10} />
          {zoneLabel}
        </div>
      </div>

      {hasOrder && (
        <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      )}

      <div className="mt-3 flex-1">
        <p className={`font-bold text-sm ${cfg.text}`}>{table.name}</p>

        {hasOrder ? (
          <div className="mt-1.5 space-y-0.5">
            <p className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</p>
            <div className="flex items-center gap-1.5">
              <Users size={11} className="text-slate-400" />
              <span className="text-[11px] text-slate-500">{table.guests || 1} khách</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-slate-400" />
              <span className="text-[11px] text-slate-500">{formatElapsed(table.elapsedMinutes)}</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1.5">Sẵn sàng phục vụ</p>
        )}
      </div>
    </button>
  )
}
