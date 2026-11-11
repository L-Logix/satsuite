const STORAGE_KEY = 'sat_practice_debt_tracker_state_v1'

export const DEFAULT_STATE = {
  userSettings: {
    startDate: new Date().toISOString(),
    dailyGoalMinutes: 30,
    targetSatDate: null,
  },
  logs: [],
  goals: [
    {
      id: crypto.randomUUID(),
      title: '50 Hours Total',
      targetMinutes: 3000,
      isCompleted: false,
    },
  ],
}

const hasRequiredShape = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return false
  const { userSettings, logs, goals } = candidate
  return (
    userSettings &&
    typeof userSettings.startDate === 'string' &&
    typeof userSettings.dailyGoalMinutes === 'number' &&
    (typeof userSettings.targetSatDate === 'string' || userSettings.targetSatDate === null) &&
    Array.isArray(logs) &&
    Array.isArray(goals)
  )
}

export const normalizeState = (candidate) => {
  if (!hasRequiredShape(candidate)) return DEFAULT_STATE
  return {
    userSettings: {
      startDate: candidate.userSettings.startDate,
      dailyGoalMinutes: Number(candidate.userSettings.dailyGoalMinutes) || 30,
      targetSatDate: candidate.userSettings.targetSatDate,
    },
    logs: candidate.logs
      .filter((log) => log && typeof log === 'object')
      .map((log) => ({
        id: typeof log.id === 'string' ? log.id : crypto.randomUUID(),
        dateLogged: typeof log.dateLogged === 'string' ? log.dateLogged : new Date().toISOString(),
        minutes: Number(log.minutes) || 0,
        originalUrl: typeof log.originalUrl === 'string' ? log.originalUrl : '',
        parsedTitle: typeof log.parsedTitle === 'string' ? log.parsedTitle : 'Practice Session',
        platform: ['khan_academy', 'ixl', 'generic'].includes(log.platform) ? log.platform : 'generic',
      })),
    goals: candidate.goals
      .filter((goal) => goal && typeof goal === 'object')
      .map((goal) => ({
        id: typeof goal.id === 'string' ? goal.id : crypto.randomUUID(),
        title: typeof goal.title === 'string' ? goal.title : 'Goal',
        targetMinutes: Number(goal.targetMinutes) || 0,
        isCompleted: Boolean(goal.isCompleted),
      })),
  }
}

export const getLocalMidnight = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export const calculateDaysElapsed = (startDate, now = Date.now()) => {
  const start = getLocalMidnight(startDate)
  const today = getLocalMidnight(now)
  if (!start || !today) return 1
  const msInDay = 24 * 60 * 60 * 1000
  const raw = Math.floor((today.getTime() - start.getTime()) / msInDay) + 1
  return Math.max(1, raw)
}

export const calculateDebtStats = (state) => {
  const totalStudiedMinutes = state.logs.reduce((sum, log) => sum + (Number(log.minutes) || 0), 0)
  const daysElapsed = calculateDaysElapsed(state.userSettings.startDate)
  const totalRequiredMinutes = daysElapsed * state.userSettings.dailyGoalMinutes
  const debtMinutes = totalRequiredMinutes - totalStudiedMinutes
  return {
    totalStudiedMinutes,
    totalRequiredMinutes,
    debtMinutes,
    daysElapsed,
  }
}

const toTitleCase = (value) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

export const parsePracticeUrl = (url) => {
  const trimmed = (url || '').trim()
  if (!trimmed) {
    return { platform: 'generic', parsedTitle: 'Manual Entry', originalUrl: '' }
  }

  try {
    const parsed = new URL(trimmed)
    if (/khanacademy\.org/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const slug = [...parts].reverse().find((part) => /[a-z0-9]/i.test(part)) || 'practice'
      const clean = toTitleCase(slug.replace(/-/g, ' ')).replace(/Sat/i, 'SAT')
      return {
        platform: 'khan_academy',
        parsedTitle: `Khan: ${clean}`,
        originalUrl: trimmed,
      }
    }

    if (/ixl\.com/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const skill = [...parts].reverse().find((part) => /[a-z0-9]/i.test(part)) || 'Unknown'
      return {
        platform: 'ixl',
        parsedTitle: `IXL Skill: ${skill.toUpperCase()}`,
        originalUrl: trimmed,
      }
    }

    return {
      platform: 'generic',
      parsedTitle: `Site: ${parsed.hostname.replace(/^www\./, '')}`,
      originalUrl: trimmed,
    }
  } catch {
    return { platform: 'generic', parsedTitle: 'Manual Entry', originalUrl: trimmed }
  }
}

export const calculateStreak = (logs) => {
  if (!logs.length) return 0
  const activeDays = new Set(
    logs
      .filter((log) => Number(log.minutes) > 0)
      .map((log) => {
        const d = getLocalMidnight(log.dateLogged)
        return d ? d.toISOString().slice(0, 10) : null
      })
      .filter(Boolean),
  )

  let streak = 0
  const cursor = getLocalMidnight(Date.now())
  if (!cursor) return 0

  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (!activeDays.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export const formatMinutes = (minutes) => {
  const sign = minutes > 0 ? '+' : ''
  return `${sign}${minutes.toLocaleString()} mins`
}

export const STORAGE = {
  key: STORAGE_KEY,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_STATE
      return normalizeState(JSON.parse(raw))
    } catch {
      return DEFAULT_STATE
    }
  },
  save(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(next)))
  },
}
