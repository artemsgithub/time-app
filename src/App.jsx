import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  LogIn,
  LogOut,
  Download,
  Trash2,
  CircleDot,
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
  const saved = loadFromStorage()
  const [now, setNow] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(saved?.isClockedIn ?? false)
  const [currentClockIn, setCurrentClockIn] = useState(saved?.currentClockIn ?? null)
  const [entries, setEntries] = useState(saved?.entries ?? [])
  const [showConfirm, setShowConfirm] = useState(false)

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
            <h1 className="text-3xl font-bold text-gray-900">TimeApp</h1>
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

        {/* History Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Time Log
            </h2>
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
                    const sessionMs =
                      e.clockOut.getTime() - e.clockIn.getTime()
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
