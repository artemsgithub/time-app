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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
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

  const handleExportCSV = useCallback(() => {
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

    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-log-${formatShortDate(new Date()).replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries, totalMs])

  const handleEditConfirm = useCallback(() => {
    setEditDrafts(entries.map((e) => ({
      clockIn: toDatetimeLocal(e.clockIn),
      clockOut: toDatetimeLocal(e.clockOut),
    })))
    setEditErrors(entries.map(() => null))
    setIsEditing(true)
    setShowEditConfirm(false)
  }, [entries])

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
    setEntries(editDrafts.map((d) => ({
      clockIn: new Date(d.clockIn),
      clockOut: new Date(d.clockOut),
    })))
    setIsEditing(false)
    setEditDrafts([])
    setEditErrors([])
  }, [editDrafts])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditDrafts([])
    setEditErrors([])
  }, [])

  const handleClearData = useCallback(() => {
    setEntries([])
    setCurrentClockIn(null)
    setIsClockedIn(false)
    setShowConfirm(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">TimeApp <span className="text-lg font-normal text-gray-400">v1.4.2</span></h1>
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
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={entries.length === 0 && !isClockedIn}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear Data
          </button>
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

        {/* History Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Time Log</h2>
            {entries.length > 0 && (
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

          {entries.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No entries yet. Clock in to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wider">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Clock In</th>
                    <th className="px-6 py-3">Clock Out</th>
                    <th className="px-6 py-3 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((e, i) => {
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
                          </tr>
                          {error && (
                            <tr key={`err-${i}`} className="bg-red-50">
                              <td colSpan={4} className="px-3 pb-2 text-xs text-red-600">
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
                        <td className="px-6 py-3 text-gray-900">
                          {formatShortDate(e.clockIn)}
                        </td>
                        <td className="px-6 py-3 text-gray-700">
                          {formatTime(e.clockIn)}
                        </td>
                        <td className="px-6 py-3 text-gray-700">
                          {formatTime(e.clockOut)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {formatHours(sessionMs)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td
                      colSpan={3}
                      className="px-6 py-3 text-gray-900"
                    >
                      Grand Total
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-blue-600">
                      {formatHours(totalMs)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
