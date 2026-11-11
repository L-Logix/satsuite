import { useEffect, useMemo, useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { motion } from 'framer-motion'
import { BookOpenCheck, Download, FileUp, Globe, GraduationCap, Timer, TrendingUp } from 'lucide-react'
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import {
  calculateDebtStats,
  calculateStreak,
  formatMinutes,
  parsePracticeUrl,
  STORAGE,
  normalizeState,
} from './utils'

const glassCard =
  'bg-white/5 backdrop-blur-lg border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] rounded-2xl p-6 hover:border-white/20 transition-all'

const platformIcon = {
  khan_academy: GraduationCap,
  ixl: BookOpenCheck,
  generic: Globe,
}

const chartColors = {
  khan_academy: '#22d3ee',
  ixl: '#a78bfa',
  generic: '#f97316',
}

const toInputDate = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const countdownText = (targetSatDate) => {
  if (!targetSatDate) return 'Set your SAT target date'
  const now = new Date()
  const target = new Date(targetSatDate)
  if (Number.isNaN(target.getTime())) return 'Set your SAT target date'
  const localNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const localTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const delta = Math.ceil((localTarget.getTime() - localNow.getTime()) / 86400000)
  if (delta < 0) return 'SAT date has passed'
  if (delta === 0) return 'SAT day is today'
  return `${delta} Day${delta > 1 ? 's' : ''} Until Exam`
}

const formatClock = (seconds) => {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function GoalRing({ title, targetMinutes, progressMinutes, complete }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const ratio = targetMinutes > 0 ? Math.min(1, progressMinutes / targetMinutes) : 0

  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 110 110" aria-hidden="true">
        <circle cx="55" cy="55" r={radius} className="stroke-slate-700" strokeWidth="10" fill="none" />
        <motion.circle
          cx="55"
          cy="55"
          r={radius}
          className={complete ? 'stroke-emerald-400' : 'stroke-cyan-400'}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 0.7 }}
          strokeDasharray={circumference}
        />
      </svg>
      <div>
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        <p className="text-xs text-slate-400">
          {Math.floor(progressMinutes / 60)}h / {Math.floor(targetMinutes / 60)}h
        </p>
        <p className={complete ? 'text-xs text-emerald-300' : 'text-xs text-cyan-300'}>
          {complete ? 'Completed' : `${Math.round(ratio * 100)}% complete`}
        </p>
      </div>
    </div>
  )
}

function App() {
  const [state, setState] = useState(() => STORAGE.load())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalHours, setNewGoalHours] = useState('')
  const fileInputRef = useRef(null)
  const pdfRef = useRef(null)
  const [reportGeneratedAt] = useState(() => new Date().toLocaleString())

  const [form, setForm] = useState(() => ({
    date: toInputDate(new Date().toISOString()),
    minutes: '',
    url: '',
  }))

  useEffect(() => {
    STORAGE.save(state)
  }, [state])

  useEffect(() => {
    if (!isRunning) return undefined
    const timerId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timerId)
  }, [isRunning])

  const debtStats = useMemo(() => calculateDebtStats(state), [state])
  const streak = useMemo(() => calculateStreak(state.logs), [state.logs])

  const pieData = useMemo(() => {
    const source = state.logs.reduce(
      (acc, log) => {
        acc[log.platform] += Number(log.minutes) || 0
        return acc
      },
      { khan_academy: 0, ixl: 0, generic: 0 },
    )

    return Object.entries(source)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
  }, [state.logs])

  const sortedLogs = useMemo(
    () =>
      [...state.logs].sort(
        (a, b) => new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime(),
      ),
    [state.logs],
  )

  const debtClass =
    debtStats.debtMinutes > 0
      ? 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]'
      : debtStats.debtMinutes < 0
        ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'
        : 'text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]'

  const submitLog = (event) => {
    event.preventDefault()
    const minutes = Math.max(0, Math.ceil(Number(form.minutes) || 0))
    if (!minutes) return

    const parsed = parsePracticeUrl(form.url)
    const isoDate = new Date(`${form.date}T00:00:00`).toISOString()

    setState((prev) =>
      normalizeState({
        ...prev,
        logs: [
          ...prev.logs,
          {
            id: crypto.randomUUID(),
            dateLogged: isoDate,
            minutes,
            originalUrl: parsed.originalUrl,
            parsedTitle: parsed.parsedTitle,
            platform: parsed.platform,
          },
        ],
      }),
    )

    setForm((prev) => ({ ...prev, minutes: '', url: '' }))
  }

  const applyTimerToForm = () => {
    const minutes = Math.ceil(elapsedSeconds / 60)
    setForm((prev) => ({ ...prev, minutes: String(minutes || 1) }))
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sat-tracker-backup.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const triggerImport = () => fileInputRef.current?.click()

  const onImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = normalizeState(JSON.parse(text))
      setState(parsed)
    } catch {
      window.alert('Invalid backup file.')
    } finally {
      event.target.value = ''
    }
  }

  const exportPdf = () => {
    if (!pdfRef.current) return
    html2pdf()
      .from(pdfRef.current)
      .set({
        margin: 0.4,
        filename: 'SAT_Progress_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#020617' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      })
      .save()
  }

  const addGoal = (event) => {
    event.preventDefault()
    const targetMinutes = Math.max(1, Math.round((Number(newGoalHours) || 0) * 60))
    if (!newGoalTitle.trim() || !targetMinutes) return

    setState((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          id: crypto.randomUUID(),
          title: newGoalTitle.trim(),
          targetMinutes,
          isCompleted: debtStats.totalStudiedMinutes >= targetMinutes,
        },
      ],
    }))

    setNewGoalTitle('')
    setNewGoalHours('')
  }

  const setTargetSatDate = (value) => {
    setState((prev) => ({
      ...prev,
      userSettings: {
        ...prev.userSettings,
        targetSatDate: value ? new Date(`${value}T00:00:00`).toISOString() : null,
      },
    }))
  }

  const dailyGoalMinutes = String(state.userSettings.dailyGoalMinutes)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-6 pb-10 text-slate-100 md:p-10">
      <header className={`${glassCard} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
        <h1 className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-3xl font-bold text-transparent">
          SAT Practice Debt Tracker
        </h1>
        <div className="flex flex-col items-start gap-2 text-sm text-slate-300 md:items-end">
          <span>{countdownText(state.userSettings.targetSatDate)}</span>
          <input
            type="date"
            className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-slate-100"
            value={state.userSettings.targetSatDate ? toInputDate(state.userSettings.targetSatDate) : ''}
            onChange={(event) => setTargetSatDate(event.target.value)}
          />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={`${glassCard} flex flex-col justify-between gap-4`}>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Current Study Debt</p>
          <div className="space-y-2">
            <p className={`text-5xl font-semibold md:text-6xl ${debtClass}`}>
              {debtStats.debtMinutes >= 0 ? '+' : '-'} {Math.abs(debtStats.debtMinutes)}
            </p>
            <p className="text-xl text-slate-300">
              {debtStats.debtMinutes > 0
                ? 'Mins Owed'
                : debtStats.debtMinutes < 0
                  ? 'Mins Banked'
                  : 'Perfectly on track'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
            <div>
              <p className="text-slate-400">Required</p>
              <p>{formatMinutes(debtStats.totalRequiredMinutes)}</p>
            </div>
            <div>
              <p className="text-slate-400">Studied</p>
              <p>{formatMinutes(debtStats.totalStudiedMinutes)}</p>
            </div>
          </div>
        </div>

        <div className={`${glassCard} space-y-4`}>
          <p className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
            <Timer className="h-4 w-4" /> Stopwatch
          </p>
          <p className="font-mono text-5xl text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]">
            {formatClock(elapsedSeconds)}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsRunning(true)}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/30"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => setIsRunning(false)}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/30"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={applyTimerToForm}
              className="rounded-lg bg-violet-500/20 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/30"
            >
              Log Time
            </button>
            <button
              type="button"
              onClick={() => {
                setElapsedSeconds(0)
                setIsRunning(false)
              }}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={`${glassCard} space-y-5`}>
          <h2 className="text-xl font-semibold">Log Practice</h2>
          <form onSubmit={submitLog} className="grid gap-3">
            <label className="text-sm text-slate-300">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-slate-100"
                required
              />
            </label>
            <label className="text-sm text-slate-300">
              Minutes
              <input
                type="number"
                min="1"
                value={form.minutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minutes: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-slate-100"
                required
              />
            </label>
            <label className="text-sm text-slate-300">
              Source URL
              <input
                type="url"
                value={form.url}
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-slate-100"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Daily Goal (minutes)
                <input
                  type="number"
                  min="1"
                  value={dailyGoalMinutes}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      userSettings: {
                        ...prev.userSettings,
                        dailyGoalMinutes: Math.max(1, Number(event.target.value) || 30),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="text-sm text-slate-300">
                Start Date
                <input
                  type="date"
                  value={toInputDate(state.userSettings.startDate)}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      userSettings: {
                        ...prev.userSettings,
                        startDate: new Date(`${event.target.value}T00:00:00`).toISOString(),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-slate-100"
                />
              </label>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
            >
              Add Session
            </button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
            <button
              type="button"
              onClick={triggerImport}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              <FileUp className="h-3.5 w-3.5" /> Import JSON
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Export Report
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={onImport} className="hidden" />
          </div>
        </div>

        <div className={`${glassCard} space-y-5`}>
          <h2 className="text-xl font-semibold">Analytics & Goals</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-900/45 p-3">
              <p className="text-slate-400">Total Hours</p>
              <p className="text-lg text-cyan-300">{(debtStats.totalStudiedMinutes / 60).toFixed(1)}h</p>
            </div>
            <div className="rounded-xl bg-slate-900/45 p-3">
              <p className="text-slate-400">Streak</p>
              <p className="text-lg text-violet-300">{streak} day(s)</p>
            </div>
          </div>

          <div className="h-52 rounded-xl bg-slate-900/45 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length ? pieData : [{ name: 'generic', value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {(pieData.length ? pieData : [{ name: 'generic', value: 1 }]).map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={chartColors[entry.name] || '#64748b'}
                      stroke="rgba(255,255,255,0.12)"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value} mins`}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <form onSubmit={addGoal} className="grid gap-2 rounded-xl border border-white/10 bg-slate-900/35 p-3">
            <p className="text-sm text-slate-300">Add Goal</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Goal title"
                value={newGoalTitle}
                onChange={(event) => setNewGoalTitle(event.target.value)}
                className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="Target hours"
                value={newGoalHours}
                onChange={(event) => setNewGoalHours(event.target.value)}
                className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <button type="submit" className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/30">
              Save Goal
            </button>
          </form>

          <div className="grid gap-3">
            {state.goals.map((goal) => {
              const complete = debtStats.totalStudiedMinutes >= goal.targetMinutes || goal.isCompleted
              return (
                <GoalRing
                  key={goal.id}
                  title={goal.title}
                  targetMinutes={goal.targetMinutes}
                  progressMinutes={debtStats.totalStudiedMinutes}
                  complete={complete}
                />
              )
            })}
          </div>
        </div>
      </section>

      <section className={`${glassCard} flex flex-col gap-3`}>
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <div className="space-y-3">
          {sortedLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No sessions logged yet.</p>
          ) : (
            sortedLogs.map((log) => {
              const Icon = platformIcon[log.platform] || Globe
              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/45 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <div>
                      <p className="text-sm text-slate-100">{log.parsedTitle}</p>
                      <p className="text-xs text-slate-400">{new Date(log.dateLogged).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">+ {log.minutes} mins</span>
                </motion.div>
              )
            })
          )}
        </div>
      </section>

      <section className="pointer-events-none fixed -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <div ref={pdfRef} className="w-[760px] bg-slate-950 p-8 text-white">
          <h2 className="mb-3 text-2xl font-bold">SAT Progress Report</h2>
          <p className="mb-1">Generated: {reportGeneratedAt}</p>
          <p className="mb-1">Debt Status: {debtStats.debtMinutes} minutes</p>
          <p className="mb-1">Total Studied: {debtStats.totalStudiedMinutes} minutes</p>
          <p className="mb-1">Current Streak: {streak} day(s)</p>
          <hr className="my-4 border-white/20" />
          <h3 className="mb-2 text-lg font-semibold">Recent Sessions</h3>
          <ul className="space-y-1 text-sm">
            {sortedLogs.slice(0, 12).map((log) => (
              <li key={log.id}>
                {new Date(log.dateLogged).toLocaleDateString()} • {log.parsedTitle} • +{log.minutes} mins
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App
