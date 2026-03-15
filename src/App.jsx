import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  LogIn,
  LogOut,
  Download,
  Trash2,
  CircleDot,
  Pencil,
  Check,
  X,
  History,
  ChevronDown,
  ChevronRight,
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
    }
  } catch {
    return null
  }
}

export default function App() {
  const [now, setNow] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(() => loadFromStorage()?.isClockedIn ?? false)
  const [currentClockIn, setCurrentClockIn] = useState(() => loadFromStorage()?.currentClockIn ?? null)
  const [entries, setEntries] = useState(() => loadFromStorage()?.entries ?? [])
  const [showConfirm, setShowConfirm] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editDrafts, setEditDrafts] = useState([])
  const [editErrors, setEditErrors] = useState([])
  const [editEntryIndices, setEditEntryIndices] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [openMonths, setOpenMonths] = useState(new Set())
  const [openWeeks, setOpenWeeks] = useState(new Set())
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ isClockedIn, currentClockIn, entries })
    )
  }, [isClockedIn, currentClockIn, entries])

  const handleToggle = useCallback(() => {
    const timestamp = new Date()
    if (!isClockedIn) {
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

  const downloadCSV = (rows, filename) => {
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportWeekCSV = useCallback(() => {
    const rows = [
      [`Week of ${formatShortDate(weekDays[0])} – ${formatShortDate(weekDays[6])}`],
      [],
      ['Date', 'Clock In', 'Clock Out', 'Total Hours'],
    ]
    currentWeekEntries.forEach((e) => {
      rows.push([
        formatShortDate(e.clockIn),
        formatTime(e.clockIn),
        formatTime(e.clockOut),
        formatHours(e.clockOut.getTime() - e.clockIn.getTime()),
      ])
    })
    rows.push([])
    rows.push(['', '', 'Week Total', formatHours(weekTotalMs)])
    downloadCSV(rows, `time-log-week-${weekStartKey}.csv`)
  }, [currentWeekEntries, weekTotalMs, weekDays, weekStartKey])

  const handleExportAllCSV = useCallback(() => {
    const rows = [['Date', 'Clock In', 'Clock Out', 'Total Hours']]
    entries.forEach((e) => {
      rows.push([
        formatShortDate(e.clockIn),
        formatTime(e.clockIn),
        formatTime(e.clockOut),
        formatHours(e.clockOut.getTime() - e.clockIn.getTime()),
      ])
    })
    rows.push([])
    rows.push(['', '', 'Grand Total', formatHours(totalMs)])

    const wDays = getWeekDays(new Date())
    const dTotals = entries.reduce((acc, e) => {
      const key = getDateKey(e.clockIn)
      acc[key] = (acc[key] || 0) + (e.clockOut.getTime() - e.clockIn.getTime())
      return acc
    }, {})
    const wTotalMs = wDays.reduce((sum, d) => sum + (dTotals[getDateKey(d)] || 0), 0)

    rows.push([])
    rows.push([`Weekly Summary — Week of ${formatShortDate(wDays[0])} – ${formatShortDate(wDays[6])}`])
    rows.push(['Day', 'Date', 'Total Hours'])
    wDays.forEach((d, i) => {
      const ms = dTotals[getDateKey(d)] || 0
      rows.push([DAY_NAMES[i], formatShortDate(d), ms > 0 ? formatHours(ms) : '0.00'])
    })
    rows.push([])
    rows.push(['', 'Week Total', formatHours(wTotalMs)])
    downloadCSV(rows, `time-log-all-${formatShortDate(new Date()).replace(/\//g, '-')}.csv`)
  }, [entries, totalMs])

  const handleExportMonthCSV = useCallback((month) => {
    const rows = [[`Month: ${month.label}`], []]
    month.weeks.forEach((week) => {
      rows.push([`Week: ${formatWeekLabel(week.weekStart)}`])
      rows.push(['Date', 'Clock In', 'Clock Out', 'Total Hours'])
      week.entries.forEach((e) => {
        rows.push([
          formatShortDate(e.clockIn),
          formatTime(e.clockIn),
          formatTime(e.clockOut),
          formatHours(e.clockOut.getTime() - e.clockIn.getTime()),
        ])
      })
      rows.push([])
      rows.push(['', '', 'Week Total', formatHours(week.totalMs)])
      rows.push([])
    })
    rows.push(['', '', 'Month Total', formatHours(month.totalMs)])
    downloadCSV(rows, `time-log-${month.label.toLowerCase().replace(' ', '-')}.csv`)
  }, [])

  const handleEditConfirm = useCallback(() => {
    const indices = []
    const cwEntries = []
    entries.forEach((e, i) => {
      const key = getDateKey(e.clockIn)
      if (key >= weekStartKey && key <= weekEndKey) {
        indices.push(i)
        cwEntries.push(e)
      }
    })
    setEditEntryIndices(indices)
    setEditDrafts(cwEntries.map((e) => ({
      clockIn: toDatetimeLocal(e.clockIn),
      clockOut: toDatetimeLocal(e.clockOut),
    })))
    setEditErrors(cwEntries.map(() => null))
    setIsEditing(true)
    setShowEditConfirm(false)
  }, [entries, weekStartKey, weekEndKey])

  const handleDraftChange = useCallback((i, field, value) => {
    setEditDrafts((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
    setEditErrors((prev) => {
      const next = [...prev]
      next[i] = null
      return next
    })
  }, [])

  const handleSaveEdits = useCallback(() => {
    const errors = editDrafts.map((d) => {
      const cin = new Date(d.clockIn)
      const cout = new Date(d.clockOut)
      if (!d.clockIn || isNaN(cin.getTime())) return 'Invalid clock-in time'
      if (!d.clockOut || isNaN(cout.getTime())) return 'Invalid clock-out time'
      if (cout <= cin) return 'Clock-out must be after clock-in'
      return null
    })
    if (errors.some((e) => e !== null)) {
      setEditErrors(errors)
      return
    }
    setEntries((prev) => {
      const next = [...prev]
      editEntryIndices.forEach((origIdx, draftIdx) => {
        next[origIdx] = {
          clockIn: new Date(editDrafts[draftIdx].clockIn),
          clockOut: new Date(editDrafts[draftIdx].clockOut),
        }
      })
      return next
    })
    setIsEditing(false)
    setEditDrafts([])
    setEditErrors([])
    setEditEntryIndices([])
  }, [editDrafts, editEntryIndices])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditDrafts([])
    setEditErrors([])
    setEditEntryIndices([])
  }, [])

  const handleDeleteEntry = useCallback(() => {
    const draftIdx = deleteConfirmIndex
    const origIdx = editEntryIndices[draftIdx]
    setEntries((prev) => prev.filter((_, i) => i !== origIdx))
    setEditDrafts((prev) => prev.filter((_, i) => i !== draftIdx))
    setEditErrors((prev) => prev.filter((_, i) => i !== draftIdx))
    setEditEntryIndices((prev) =>
      prev.filter((_, i) => i !== draftIdx).map((idx) => (idx > origIdx ? idx - 1 : idx))
    )
    setDeleteConfirmIndex(null)
  }, [deleteConfirmIndex, editEntryIndices])

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

  const historyData = groupEntriesByMonthAndWeek(entries)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">TimeApp <span className="text-lg font-normal text-gray-400">v1.6.2</span></h1>
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
                  return (
                    <tr
                      key={key}
                      className={
                        isToday
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className={`px-6 py-3 font-medium ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {DAY_NAMES[i]}
                        {isToday && <span className="ml-2 text-xs font-normal text-blue-400">today</span>}
                      </td>
                      <td className={`px-6 py-3 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                        {formatShortDate(d)}
                      </td>
                      <td className={`px-6 py-3 text-right font-mono ${ms > 0 ? (isToday ? 'text-blue-700 font-semibold' : 'text-gray-900') : 'text-gray-300'}`}>
                        {ms > 0 ? formatHours(ms) : (isFuture ? '—' : '0.00')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-6 py-3 text-gray-900">Week Total</td>
                  <td className="px-6 py-3 text-right font-mono text-blue-600">
                    {formatHours(weekTotalMs)}
                  </td>
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

        {/* Edit Confirmation Dialog */}
        {showEditConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Edit time entries?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                All entries will become editable. Review your changes carefully before saving — edits will overwrite the original data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEditConfirm(false)}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Edit Entries
                </button>
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

                                {/* Week entries table */}
                                {openWeeks.has(week.key) && (
                                  <div className="border-t border-gray-100 overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-white text-left text-gray-400 uppercase tracking-wider">
                                          <th className="pl-14 pr-3 py-2">Date</th>
                                          <th className="px-3 py-2">Clock In</th>
                                          <th className="px-3 py-2">Clock Out</th>
                                          <th className="px-3 py-2 text-right">Hours</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {week.entries.map((e, i) => {
                                          const ms = e.clockOut.getTime() - e.clockIn.getTime()
                                          return (
                                            <tr key={i} className="bg-white">
                                              <td className="pl-14 pr-3 py-2 text-gray-500">{formatShortDate(e.clockIn)}</td>
                                              <td className="px-3 py-2 text-gray-500">{formatTableTime(e.clockIn)}</td>
                                              <td className="px-3 py-2 text-gray-500">{formatTableTime(e.clockOut)}</td>
                                              <td className="px-3 py-2 text-right font-mono text-gray-700">{formatHours(ms)}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
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
              isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowEditConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit entries"
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
                    {isEditing && <th className="px-2 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentWeekEntries.map((e, i) => {
                    if (isEditing) {
                      const draft = editDrafts[i] ?? { clockIn: '', clockOut: '' }
                      const cin = new Date(draft.clockIn)
                      const cout = new Date(draft.clockOut)
                      const draftMs = !isNaN(cin) && !isNaN(cout) ? cout - cin : 0
                      const error = editErrors[i]
                      return (
                        <>
                          <tr key={i} className={error ? 'bg-red-50' : 'bg-yellow-50/40'}>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              {draft.clockIn ? formatShortDate(new Date(draft.clockIn)) : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="datetime-local"
                                step="1"
                                value={draft.clockIn}
                                onChange={(ev) => handleDraftChange(i, 'clockIn', ev.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="datetime-local"
                                step="1"
                                value={draft.clockOut}
                                onChange={(ev) => handleDraftChange(i, 'clockOut', ev.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900 text-sm">
                              {draftMs > 0 ? formatHours(draftMs) : '—'}
                            </td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => setDeleteConfirmIndex(i)}
                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                          {error && (
                            <tr key={`err-${i}`} className="bg-red-50">
                              <td colSpan={5} className="px-3 pb-2 text-xs text-red-600">
                                {error}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    }
                    const sessionMs = e.clockOut.getTime() - e.clockIn.getTime()
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-gray-900">
                          {formatShortDate(e.clockIn)}
                        </td>
                        <td className="px-3 py-3 text-gray-700">
                          {formatTableTime(e.clockIn)}
                        </td>
                        <td className="px-3 py-3 text-gray-700">
                          {formatTableTime(e.clockOut)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-900">
                          {formatHours(sessionMs)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-3 py-3 text-gray-900">
                      Week Total
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-blue-600">
                      {formatHours(weekTotalMs)}
                    </td>
                    {isEditing && <td />}
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
