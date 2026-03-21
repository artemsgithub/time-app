import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  LogIn,
  LogOut,
  Download,
  Trash2,
  CircleDot,
  Pencil,
  X,
  History,
  ChevronDown,
  ChevronRight,
  StickyNote,
} from 'lucide-react'

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  })
}

function formatTableTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatHours(ms) {
  if (ms <= 0) return '0.00'
  const hours = ms / (1000 * 60 * 60)
  return hours.toFixed(2)
}

function formatDuration(ms) {
  if (ms <= 0) return '0h 0m'
  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

function formatWeekLabel(weekStart) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.toLocaleDateString('en-US', opts)}`
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CHANGELOG = [
  { version: 'v1.6.6.1', note: 'Fix NaN in Day Total row of CSV exports (operator precedence bug in dayMs reduce).' },
  { version: 'v1.6.6', note: 'Export All: organized by month → week → day; all CSV exports include day notes and H:MM clock times (no seconds); fixed CSV quoting for fields with commas.' },
  { version: 'v1.6.5.7', note: 'Nest note icon inside Total Hours cell in Weekly Summary; remove extra column. Favicon color changed to deep orange (#ea580c).' },
  { version: 'v1.6.5.6', note: 'Replace type=time with HH/MM select dropdowns — native iOS wheel picker, no overflow' },
  { version: 'v1.6.5.5', note: 'Replace type=time inputs with type=text (24h HH:MM) — iOS native time picker ignores CSS width constraints' },
  { version: 'v1.6.5.4', note: 'Fix Edit Entry modal inputs overflowing card right edge on iOS (overflow-hidden + minWidth:0)' },
  { version: 'v1.6.5.3', note: 'Fix Edit Entry modal: stack Clock In/Out inputs vertically to prevent iOS border merge' },
  { version: 'v1.6.5.2', note: 'Edit button in Time Log header unlocks per-row pencil + delete icons; clean by default' },
  { version: 'v1.6.5.1', note: 'Nest edit icon in Total Hours; always-visible pencil on touch; fix note Save bug; fix Safari iOS zoom on inputs' },
  { version: 'v1.6.5', note: 'Per-entry edit modal; day notes on weekly summary + history; stronger haptics; removed ripple' },
  { version: 'v1.6.4.1', note: 'Fix day-level hours display in history (operator precedence bug)' },
  { version: 'v1.6.4', note: 'History week day accordions; version changelog modal' },
  { version: 'v1.6.3', note: 'Haptic feedback (Clock In: firm buzz; Clock Out: double tap) and ripple burst animation' },
  { version: 'v1.6.2', note: 'Fix month CSV export; history opens collapsed; delete individual entries in edit mode' },
  { version: 'v1.6.1', note: 'Scoped CSV exports (week / all-time / per-month); Clear Data moved to bottom' },
  { version: 'v1.6',   note: 'History modal with monthly + weekly accordions; Time Log scoped to current week' },
  { version: 'v1.5.2', note: 'Reduce Time Log cell padding to fix mobile horizontal scroll' },
  { version: 'v1.5.1', note: 'Compact date/time format in Time Log for mobile readability' },
  { version: 'v1.5',   note: 'Weekly summary table; inline entry editing' },
  { version: 'v1.4.2', note: 'Inline editing for time log entries' },
  { version: 'v1.4.1', note: 'iOS home screen support (apple-touch-icon)' },
  { version: 'v1.4',   note: 'Clock SVG favicon' },
  { version: 'v1.3',   note: 'Persist clock data in localStorage across reloads' },
  { version: 'v1.2',   note: 'Version display in header; localStorage lazy init fix' },
  { version: 'v1.0',   note: 'Initial release — clock in/out, time log, total hours' },
]

function getDateKey(date) {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  )
}

function getWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function getWeekDays(date) {
  const monday = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function groupEntriesByMonthAndWeek(entries) {
  const monthMap = {}
  for (const entry of entries) {
    const d = entry.clockIn
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const weekStart = getWeekStart(d)
    const weekKey = getDateKey(weekStart)
    const ms = entry.clockOut.getTime() - entry.clockIn.getTime()

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        key: monthKey,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalMs: 0,
        weeks: {},
      }
    }
    monthMap[monthKey].totalMs += ms

    if (!monthMap[monthKey].weeks[weekKey]) {
      monthMap[monthKey].weeks[weekKey] = {
        key: weekKey,
        weekStart,
        totalMs: 0,
        entries: [],
      }
    }
    monthMap[monthKey].weeks[weekKey].totalMs += ms
    monthMap[monthKey].weeks[weekKey].entries.push(entry)
  }

  return Object.values(monthMap)
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((month) => ({
      ...month,
      weeks: Object.values(month.weeks).sort((a, b) => b.key.localeCompare(a.key)),
    }))
}

const STORAGE_KEY = 'timeapp_data'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      isClockedIn: data.isClockedIn ?? false,
      currentClockIn: data.currentClockIn ? new Date(data.currentClockIn) : null,
      entries: (data.entries ?? []).map((e) => ({
        clockIn: new Date(e.clockIn),
        clockOut: new Date(e.clockOut),
      })),
      dayNotes: data.dayNotes ?? {},
    }
  } catch {
    return null
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function HourMinuteSelect({ value, onChange }) {
  const [h, m] = (value || '00:00').split(':')
  return (
    <div className="flex items-center gap-2">
      <select
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        style={{ fontSize: '16px' }}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {HOURS.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-gray-400 font-semibold text-lg select-none">:</span>
      <select
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        style={{ fontSize: '16px' }}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {MINUTES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  )
}

export default function App() {
  const [now, setNow] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(() => loadFromStorage()?.isClockedIn ?? false)
  const [currentClockIn, setCurrentClockIn] = useState(() => loadFromStorage()?.currentClockIn ?? null)
  const [entries, setEntries] = useState(() => loadFromStorage()?.entries ?? [])
  const [showConfirm, setShowConfirm] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null) // { origIndex, entry }
  const [editEntryDraft, setEditEntryDraft] = useState({ clockIn: '', clockOut: '' })
  const [editEntryError, setEditEntryError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [openMonths, setOpenMonths] = useState(new Set())
  const [openWeeks, setOpenWeeks] = useState(new Set())
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)
  const [openDays, setOpenDays] = useState(new Set())
  const [dayNotes, setDayNotes] = useState(() => loadFromStorage()?.dayNotes ?? {})
  const [noteModalDate, setNoteModalDate] = useState(null) // YYYY-MM-DD | null
  const [noteDraft, setNoteDraft] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ isClockedIn, currentClockIn, entries, dayNotes })
    )
  }, [isClockedIn, currentClockIn, entries, dayNotes])

  const handleToggle = useCallback(() => {
    const timestamp = new Date()
    const clockingIn = !isClockedIn

    // Haptic feedback — escalating triple pulse for in, descending for out
    if (navigator.vibrate) {
      navigator.vibrate(clockingIn ? [100, 50, 150, 50, 250] : [250, 50, 150, 50, 100])
    }

    if (clockingIn) {
      setCurrentClockIn(timestamp)
      setIsClockedIn(true)
    } else {
      setEntries((prev) => [
        ...prev,
        { clockIn: currentClockIn, clockOut: timestamp },
      ])
      setCurrentClockIn(null)
      setIsClockedIn(false)
    }
  }, [isClockedIn, currentClockIn])

  const totalMs = entries.reduce(
    (sum, e) => sum + (e.clockOut.getTime() - e.clockIn.getTime()),
    0
  )

  const currentSessionMs =
    isClockedIn && currentClockIn ? now.getTime() - currentClockIn.getTime() : 0

  const todayKey = getDateKey(now)

  const dailyTotals = entries.reduce((acc, e) => {
    const key = getDateKey(e.clockIn)
    acc[key] = (acc[key] || 0) + (e.clockOut.getTime() - e.clockIn.getTime())
    return acc
  }, {})

  const weekDays = getWeekDays(now)
  const weekStartKey = getDateKey(weekDays[0])
  const weekEndKey = getDateKey(weekDays[6])
  const weekTotalMs = weekDays.reduce((sum, d) => sum + (dailyTotals[getDateKey(d)] || 0), 0)

  const currentWeekEntries = entries.filter((e) => {
    const key = getDateKey(e.clockIn)
    return key >= weekStartKey && key <= weekEndKey
  })

  const csvField = (val) => {
    const s = String(val ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const downloadCSV = (rows, filename) => {
    const csv = rows.map((r) => r.map(csvField).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCsvDate = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const handleExportWeekCSV = useCallback(() => {
    const rows = [
      [`Week of ${formatShortDate(weekDays[0])} – ${formatShortDate(weekDays[6])}`],
      [],
      ['Date', 'Clock In', 'Clock Out', 'Hours', 'Notes'],
    ]
    // Group by day so notes appear on the first entry per day
    const dayMap = {}
    currentWeekEntries.forEach((e) => {
      const key = getDateKey(e.clockIn)
      if (!dayMap[key]) dayMap[key] = []
      dayMap[key].push(e)
    })
    Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, dayEntries]) => {
        const note = dayNotes[key] || ''
        const dayMs = dayEntries.reduce((sum, e) => sum + (e.clockOut - e.clockIn), 0)
        dayEntries.forEach((e, i) => {
          rows.push([
            i === 0 ? formatCsvDate(e.clockIn) : '',
            formatTableTime(e.clockIn),
            formatTableTime(e.clockOut),
            formatHours(e.clockOut - e.clockIn),
            i === 0 ? note : '',
          ])
        })
        if (dayEntries.length > 1) {
          rows.push(['', '', 'Day Total', formatHours(dayMs), ''])
        }
      })
    rows.push([])
    rows.push(['', '', 'Week Total', formatHours(weekTotalMs), ''])
    downloadCSV(rows, `time-log-week-${weekStartKey}.csv`)
  }, [currentWeekEntries, weekTotalMs, weekDays, weekStartKey, dayNotes])

  const handleExportAllCSV = useCallback(() => {
    const rows = [['TimeApp — Full Export'], []]
    const months = groupEntriesByMonthAndWeek(entries)
    const sortedMonths = [...months].reverse()

    sortedMonths.forEach((month) => {
      rows.push([`Month: ${month.label}`])
      rows.push([])

      const sortedWeeks = [...month.weeks].reverse()
      sortedWeeks.forEach((week) => {
        rows.push([`Week: ${formatWeekLabel(week.weekStart)}`])
        rows.push(['Date', 'Clock In', 'Clock Out', 'Hours', 'Notes'])

        // Group entries by day, sorted ascending
        const dayMap = {}
        week.entries.forEach((e) => {
          const key = getDateKey(e.clockIn)
          if (!dayMap[key]) dayMap[key] = []
          dayMap[key].push(e)
        })

        Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([key, dayEntries]) => {
            const note = dayNotes[key] || ''
            const dayMs = dayEntries.reduce((sum, e) => sum + (e.clockOut - e.clockIn), 0)
            dayEntries.forEach((e, i) => {
              rows.push([
                i === 0 ? formatCsvDate(e.clockIn) : '',
                formatTableTime(e.clockIn),
                formatTableTime(e.clockOut),
                formatHours(e.clockOut - e.clockIn),
                i === 0 ? note : '',
              ])
            })
            if (dayEntries.length > 1) {
              rows.push(['', '', 'Day Total', formatHours(dayMs), ''])
            }
          })

        rows.push(['', '', 'Week Total', formatHours(week.totalMs), ''])
        rows.push([])
      })

      rows.push(['', '', 'Month Total', formatHours(month.totalMs), ''])
      rows.push([])
    })

    rows.push(['', '', 'Grand Total', formatHours(totalMs), ''])
    downloadCSV(rows, `time-log-all-${formatShortDate(new Date()).replace(/\//g, '-')}.csv`)
  }, [entries, totalMs, dayNotes])

  const handleExportMonthCSV = useCallback((month) => {
    const rows = [[`Month: ${month.label}`], []]
    const sortedWeeks = [...month.weeks].reverse()
    sortedWeeks.forEach((week) => {
      rows.push([`Week: ${formatWeekLabel(week.weekStart)}`])
      rows.push(['Date', 'Clock In', 'Clock Out', 'Hours', 'Notes'])
      const dayMap = {}
      week.entries.forEach((e) => {
        const key = getDateKey(e.clockIn)
        if (!dayMap[key]) dayMap[key] = []
        dayMap[key].push(e)
      })
      Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, dayEntries]) => {
          const note = dayNotes[key] || ''
          const dayMs = dayEntries.reduce((sum, e) => sum + e.clockOut - e.clockIn, 0)
          dayEntries.forEach((e, i) => {
            rows.push([
              i === 0 ? formatCsvDate(e.clockIn) : '',
              formatTableTime(e.clockIn),
              formatTableTime(e.clockOut),
              formatHours(e.clockOut - e.clockIn),
              i === 0 ? note : '',
            ])
          })
          if (dayEntries.length > 1) {
            rows.push(['', '', 'Day Total', formatHours(dayMs), ''])
          }
        })
      rows.push([])
      rows.push(['', '', 'Week Total', formatHours(week.totalMs), ''])
      rows.push([])
    })
    rows.push(['', '', 'Month Total', formatHours(month.totalMs), ''])
    downloadCSV(rows, `time-log-${month.label.toLowerCase().replace(' ', '-')}.csv`)
  }, [dayNotes])

  const handleOpenEditEntry = (origIndex, entry) => {
    const pad = (n) => String(n).padStart(2, '0')
    setEditingEntry({ origIndex, entry })
    setEditEntryDraft({
      clockIn: `${pad(entry.clockIn.getHours())}:${pad(entry.clockIn.getMinutes())}`,
      clockOut: `${pad(entry.clockOut.getHours())}:${pad(entry.clockOut.getMinutes())}`,
    })
    setEditEntryError(null)
  }

  const handleSaveEntryEdit = useCallback(() => {
    const { origIndex, entry } = editingEntry
    const [inH, inM] = editEntryDraft.clockIn.split(':').map(Number)
    const [outH, outM] = editEntryDraft.clockOut.split(':').map(Number)
    if (isNaN(inH) || isNaN(outH)) { setEditEntryError('Invalid time'); return }
    const newIn = new Date(entry.clockIn)
    newIn.setHours(inH, inM, 0, 0)
    const newOut = new Date(entry.clockOut)
    newOut.setHours(outH, outM, 0, 0)
    if (newOut <= newIn) { setEditEntryError('Clock-out must be after clock-in'); return }
    setEntries((prev) => {
      const next = [...prev]
      next[origIndex] = { clockIn: newIn, clockOut: newOut }
      return next
    })
    setEditingEntry(null)
  }, [editingEntry, editEntryDraft])

  const handleDeleteEntry = useCallback(() => {
    setEntries((prev) => prev.filter((_, i) => i !== deleteConfirmIndex))
    setDeleteConfirmIndex(null)
  }, [deleteConfirmIndex])

  const handleClearData = useCallback(() => {
    setEntries([])
    setCurrentClockIn(null)
    setIsClockedIn(false)
    setShowConfirm(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleOpenHistory = () => {
    setOpenMonths(new Set())
    setOpenWeeks(new Set())
    setShowHistory(true)
  }

  const toggleMonth = (key) => {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleWeek = (key) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleDay = (key) => {
    setOpenDays((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleOpenNoteModal = (dateKey) => {
    setNoteModalDate(dateKey)
    setNoteDraft(dayNotes[dateKey] ?? '')
  }

  const handleSaveNote = (textOverride) => {
    const trimmed = (textOverride ?? noteDraft).trim()
    setDayNotes((prev) => {
      if (!trimmed) {
        const next = { ...prev }
        delete next[noteModalDate]
        return next
      }
      return { ...prev, [noteModalDate]: trimmed }
    })
    setNoteModalDate(null)
  }

  const historyData = groupEntriesByMonthAndWeek(entries)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">TimeApp{' '}
              <button
                onClick={() => setShowChangelog(true)}
                className="text-lg font-normal text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                title="View changelog"
              >v1.6.6.1</button>
            </h1>
          </div>
          <p className="text-gray-500">Work Hours Tracker</p>
        </div>

        {/* Live Clock */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 text-center">
          <p className="text-sm text-gray-500 mb-1">{formatDate(now)}</p>
          <p className="text-4xl font-mono font-semibold text-gray-900 tracking-wide">
            {formatTime(now)}
          </p>
        </div>

        {/* Status + Toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <CircleDot
                className={`w-5 h-5 ${isClockedIn ? 'text-green-500' : 'text-red-500'}`}
              />
              <div>
                <p className="font-medium text-gray-900">
                  {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                </p>
                {isClockedIn && currentClockIn && (
                  <p className="text-sm text-gray-500">
                    Since {formatTime(currentClockIn)} &mdash;{' '}
                    {formatDuration(currentSessionMs)}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle button */}
            <button
              onClick={handleToggle}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-lg transition-colors cursor-pointer ${
                  isClockedIn
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isClockedIn ? (
                  <>
                    <LogOut className="w-5 h-5" />
                    Clock Out
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Clock In
                  </>
                )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleOpenHistory}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={handleExportWeekCSV}
            disabled={currentWeekEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Week
          </button>
        </div>

        {/* Weekly Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Summary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wider">
                  <th className="px-6 py-3">Day</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weekDays.map((d, i) => {
                  const key = getDateKey(d)
                  const isToday = key === todayKey
                  const isFuture = key > todayKey
                  const ms = dailyTotals[key] || 0
                  const hasNote = !!dayNotes[key]
                  return (
                    <tr key={key} className={isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-3 font-medium ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {DAY_NAMES[i]}
                        {isToday && <span className="ml-2 text-xs font-normal text-blue-400">today</span>}
                      </td>
                      <td className={`px-6 py-3 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                        {formatShortDate(d)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-mono ${ms > 0 ? (isToday ? 'text-blue-700 font-semibold' : 'text-gray-900') : 'text-gray-300'}`}>
                            {ms > 0 ? formatHours(ms) : (isFuture ? '—' : '0.00')}
                          </span>
                          {!isFuture && (
                            <button
                              onClick={() => handleOpenNoteModal(key)}
                              className="p-1 rounded transition-colors cursor-pointer"
                              title={hasNote ? 'Edit note' : 'Add note'}
                            >
                              <StickyNote className={`w-4 h-4 ${hasNote ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-6 py-3 text-gray-900">Week Total</td>
                  <td className="px-6 py-3 text-right font-mono text-blue-600">{formatHours(weekTotalMs)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Clear all data?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                This will permanently remove all time entries. This action
                cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearData}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Entry Modal */}
        {editingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Edit Entry</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {DAY_NAMES[editingEntry.entry.clockIn.getDay() === 0 ? 6 : editingEntry.entry.clockIn.getDay() - 1]},{' '}
                    {formatShortDate(editingEntry.entry.clockIn)}
                  </p>
                </div>
                <button
                  onClick={() => setEditingEntry(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Clock In</label>
                    <HourMinuteSelect
                      value={editEntryDraft.clockIn}
                      onChange={(v) => { setEditEntryDraft((p) => ({ ...p, clockIn: v })); setEditEntryError(null) }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Clock Out</label>
                    <HourMinuteSelect
                      value={editEntryDraft.clockOut}
                      onChange={(v) => { setEditEntryDraft((p) => ({ ...p, clockOut: v })); setEditEntryError(null) }}
                    />
                  </div>
                </div>
                {editEntryError && (
                  <p className="text-xs text-red-600">{editEntryError}</p>
                )}
                {!editEntryError && editEntryDraft.clockIn && editEntryDraft.clockOut && (() => {
                  const [ih, im] = editEntryDraft.clockIn.split(':').map(Number)
                  const [oh, om] = editEntryDraft.clockOut.split(':').map(Number)
                  const ms = (oh * 60 + om - (ih * 60 + im)) * 60000
                  return ms > 0 ? (
                    <p className="text-xs text-gray-400">{formatHours(ms)} hrs</p>
                  ) : null
                })()}
              </div>
              <div className="flex items-center justify-between px-6 pb-5">
                <button
                  onClick={() => { setDeleteConfirmIndex(editingEntry.origIndex); setEditingEntry(null) }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingEntry(null)}
                    className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEntryEdit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Changelog Modal */}
        {showChangelog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Changelog</h2>
                <button
                  onClick={() => setShowChangelog(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {CHANGELOG.map(({ version, note }) => (
                  <li key={version} className="flex gap-4 px-6 py-3">
                    <span className="font-mono text-sm text-blue-600 shrink-0 w-14">{version}</span>
                    <span className="text-sm text-gray-600">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Day Note Modal */}
        {noteModalDate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setNoteModalDate(null) }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Note</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {DAY_NAMES[new Date(noteModalDate + 'T12:00:00').getDay() === 0 ? 6 : new Date(noteModalDate + 'T12:00:00').getDay() - 1]},{' '}
                    {formatShortDate(new Date(noteModalDate + 'T12:00:00'))}
                  </p>
                </div>
                <button
                  onClick={() => setNoteModalDate(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-4">
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note for this day…"
                  rows={4}
                  style={{ fontSize: '16px' }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              <div className="flex items-center justify-between px-6 pb-5">
                {dayNotes[noteModalDate] ? (
                  <button
                    onClick={() => handleSaveNote('')}
                    className="text-sm text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    onClick={() => setNoteModalDate(null)}
                    className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveNote()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Entry Confirmation */}
        {deleteConfirmIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete this entry?</h2>
              <p className="text-sm text-gray-500 mb-6">
                This will permanently remove the entry. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmIndex(null)}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteEntry}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-gray-900">History</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportAllCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                    title="Export all data to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export All
                  </button>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                {historyData.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No history yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {historyData.map((month) => (
                      <div key={month.key}>
                        {/* Month row */}
                        <div className="flex items-center border-b border-gray-100 last:border-0">
                          <button
                            onClick={() => toggleMonth(month.key)}
                            className="flex-1 flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                          >
                            {openMonths.has(month.key) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            <span className="font-semibold text-gray-900 flex-1">{month.label}</span>
                            <span className="font-mono text-sm text-indigo-600">{formatHours(month.totalMs)} hrs</span>
                          </button>
                          <button
                            onClick={() => handleExportMonthCSV(month)}
                            className="p-2 mr-3 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
                            title={`Export ${month.label} to CSV`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Weeks */}
                        {openMonths.has(month.key) && (
                          <div className="border-t border-gray-100">
                            {month.weeks.map((week) => (
                              <div key={week.key} className="bg-gray-50/60">
                                {/* Week row */}
                                <button
                                  onClick={() => toggleWeek(week.key)}
                                  className="w-full flex items-center gap-3 pl-10 pr-6 py-3 hover:bg-gray-100/70 transition-colors cursor-pointer text-left"
                                >
                                  {openWeeks.has(week.key) ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  )}
                                  <span className="text-sm text-gray-700 flex-1">{formatWeekLabel(week.weekStart)}</span>
                                  <span className="font-mono text-sm text-gray-600">{formatHours(week.totalMs)} hrs</span>
                                </button>

                                {/* Week — day accordions */}
                                {openWeeks.has(week.key) && (() => {
                                  // Group entries by date key
                                  const dayMap = {}
                                  week.entries.forEach((e) => {
                                    const dk = getDateKey(e.clockIn)
                                    if (!dayMap[dk]) dayMap[dk] = []
                                    dayMap[dk].push(e)
                                  })
                                  const dayKeys = Object.keys(dayMap).sort()
                                  return (
                                    <div className="border-t border-gray-100">
                                      {dayKeys.map((dk) => {
                                        const dayEntries = dayMap[dk]
                                        const dayMs = dayEntries.reduce((s, e) => s + (e.clockOut - e.clockIn), 0)
                                        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dk + 'T12:00:00').getDay()]
                                        const isOpen = openDays.has(dk)
                                        return (
                                          <div key={dk} className="bg-white">
                                            {/* Day row */}
                                            <div className="flex items-center hover:bg-gray-50 transition-colors">
                                              <button
                                                onClick={() => toggleDay(dk)}
                                                className="flex-1 flex items-center gap-3 pl-14 pr-3 py-2.5 cursor-pointer text-left"
                                              >
                                                {isOpen ? (
                                                  <ChevronDown className="w-3 h-3 text-gray-300 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                                                )}
                                                <span className="text-xs font-medium text-gray-700 w-8 shrink-0">{dayName}</span>
                                                <span className="text-xs text-gray-400 flex-1">{formatShortDate(new Date(dk + 'T12:00:00'))}</span>
                                                <span className="font-mono text-xs text-gray-500">{formatHours(dayMs)} hrs</span>
                                              </button>
                                              <button
                                                onClick={() => handleOpenNoteModal(dk)}
                                                className="p-2 mr-2 rounded cursor-pointer transition-colors"
                                                title={dayNotes[dk] ? 'Edit note' : 'Add note'}
                                              >
                                                <StickyNote className={`w-3.5 h-3.5 ${dayNotes[dk] ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`} />
                                              </button>
                                            </div>

                                            {/* Day entries */}
                                            {isOpen && (
                                              <div className="border-t border-gray-50 overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="bg-gray-50 text-left text-gray-400 uppercase tracking-wider">
                                                      <th className="pl-20 pr-3 py-1.5">Clock In</th>
                                                      <th className="px-3 py-1.5">Clock Out</th>
                                                      <th className="px-3 py-1.5 text-right">Hours</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-50">
                                                    {dayEntries.map((e, i) => {
                                                      const ms = e.clockOut - e.clockIn
                                                      return (
                                                        <tr key={i} className="bg-white">
                                                          <td className="pl-20 pr-3 py-1.5 text-gray-500">{formatTableTime(e.clockIn)}</td>
                                                          <td className="px-3 py-1.5 text-gray-500">{formatTableTime(e.clockOut)}</td>
                                                          <td className="px-3 py-1.5 text-right font-mono text-gray-700">{formatHours(ms)}</td>
                                                        </tr>
                                                      )
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Time Log */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Time Log</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
              </p>
            </div>
            {currentWeekEntries.length > 0 && (
              isEditMode ? (
                <button
                  onClick={() => setIsEditMode(false)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )
            )}
          </div>

          {currentWeekEntries.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No entries this week. Clock in to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wider">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Clock In</th>
                    <th className="px-3 py-3">Clock Out</th>
                    <th className="px-3 py-3 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentWeekEntries.map((e, i) => {
                    // find origIndex in entries[]
                    const origIndex = entries.indexOf(e)
                    const sessionMs = e.clockOut.getTime() - e.clockIn.getTime()
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-gray-900">{formatShortDate(e.clockIn)}</td>
                        <td className="px-3 py-3 text-gray-700">{formatTableTime(e.clockIn)}</td>
                        <td className="px-3 py-3 text-gray-700">{formatTableTime(e.clockOut)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-mono text-gray-900">{formatHours(sessionMs)}</span>
                            {isEditMode && (
                              <>
                                <button
                                  onClick={() => handleOpenEditEntry(origIndex, e)}
                                  className="p-1 ml-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmIndex(origIndex)}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-3 py-3 text-gray-900">Week Total</td>
                    <td className="px-3 py-3 text-right font-mono text-blue-600">{formatHours(weekTotalMs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Clear Data */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={entries.length === 0 && !isClockedIn}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  )
}
