// ── Parser pintar untuk quick-add todo ──────────────────────────────
// Mendukung: #tag, !tinggi/!sedang/!rendah (!penting, !urgent, !low),
// "hari ini", "besok", "lusa", nama hari (senin..minggu), tanggal
// "25/12" atau "25-12", dan jam "14:30" atau "jam 8.30".

export interface ParsedTodo {
  title: string
  tags: string[]
  priority: number | null
  dueDate: Date | null
}

const DAY_MAP: Record<string, number> = {
  minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6,
}

const endOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(23, 59, 0, 0)
  return x
}

export function parseTodoInput(raw: string): ParsedTodo {
  let title = raw
  const tags: string[] = []
  let priority: number | null = null
  let dueDate: Date | null = null
  const now = new Date()

  title = title.replace(/#([\w\u00C0-\u024F-]+)/g, (_m, tg: string) => {
    tags.push(tg.toLowerCase())
    return ' '
  })

  if (/!(tinggi|penting|urgent)\b/i.test(title)) {
    priority = 2
    title = title.replace(/!(tinggi|penting|urgent)\b/gi, ' ')
  }
  if (/!(sedang|medium)\b/i.test(title)) {
    if (priority === null) priority = 1
    title = title.replace(/!(sedang|medium)\b/gi, ' ')
  }
  if (/!(rendah|low)\b/i.test(title)) {
    if (priority === null) priority = 0
    title = title.replace(/!(rendah|low)\b/gi, ' ')
  }

  if (/\bhari\s*ini\b/i.test(title)) {
    dueDate = endOfDay(now)
    title = title.replace(/\bhari\s*ini\b/i, ' ')
  } else if (/\bbesok\b/i.test(title)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    dueDate = endOfDay(d)
    title = title.replace(/\bbesok\b/i, ' ')
  } else if (/\blusa\b/i.test(title)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 2)
    dueDate = endOfDay(d)
    title = title.replace(/\blusa\b/i, ' ')
  } else {
    const m = title.match(/\b(minggu|ahad|senin|selasa|rabu|kamis|jumat|sabtu)\b/i)
    if (m) {
      const target = DAY_MAP[m[1].toLowerCase()]
      const d = new Date(now)
      let diff = (target - d.getDay() + 7) % 7
      if (diff === 0) diff = 7
      d.setDate(d.getDate() + diff)
      dueDate = endOfDay(d)
      title = title.replace(m[0], ' ')
    } else {
      const dm = title.match(/\b(\d{1,2})[\/-](\d{1,2})\b/)
      if (dm) {
        const day = parseInt(dm[1], 10)
        const mon = parseInt(dm[2], 10) - 1
        if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
          let d = new Date(now.getFullYear(), mon, day, 23, 59)
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          if (d < todayStart) d = new Date(now.getFullYear() + 1, mon, day, 23, 59)
          dueDate = d
          title = title.replace(dm[0], ' ')
        }
      }
    }
  }

  const tm = title.match(/\b(?:jam\s*)?(\d{1,2})[:.](\d{2})\b/i)
  if (tm) {
    const h = parseInt(tm[1], 10)
    const mi = parseInt(tm[2], 10)
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      if (!dueDate) {
        const d = new Date(now)
        if (h * 60 + mi <= now.getHours() * 60 + now.getMinutes()) d.setDate(d.getDate() + 1)
        dueDate = d
      }
      dueDate.setHours(h, mi, 0, 0)
      title = title.replace(tm[0], ' ')
    }
  }

  title = title.replace(/\s+/g, ' ').trim()
  return { title, tags, priority, dueDate }
}
