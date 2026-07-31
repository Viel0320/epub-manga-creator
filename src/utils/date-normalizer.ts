/**
 * 自动规范化手填日期字符串为标准 ISO 日期格式 (YYYY-MM-DD, YYYY-MM, YYYY)
 */
export function normalizeDateString(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()
  if (!trimmed) return ''

  // 1. 如果已符合标准 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // 2. 如果已符合标准 YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // 3. 如果仅为 4 位年份 YYYY
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed
  }

  // 4. 替换常见的分割符（点、斜杠、年月日汉字等）为统一杠字符
  // 例：2026年7月31日 -> 2026-7-31
  let normalized = trimmed
    .replace(/[年/._\s]+/g, '-')
    .replace(/[月日]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // 5. 匹配纯数字 YYYYMMDD (8位) 或 YYYYMM (6位)
  if (/^\d{8}$/.test(normalized)) {
    const y = normalized.slice(0, 4)
    const m = normalized.slice(4, 6)
    const d = normalized.slice(6, 8)
    return formatValidDateParts(y, m, d)
  }

  if (/^\d{6}$/.test(normalized)) {
    const y = normalized.slice(0, 4)
    const m = normalized.slice(4, 6)
    return formatValidDateParts(y, m)
  }

  // 6. 处理已拆分为数字的部分 (Y-M-D 或 Y-M)
  const parts = normalized.split('-').filter(Boolean)
  if (parts.length >= 1) {
    const y = parts[0]
    const m = parts[1]
    const d = parts[2]

    if (/^\d{4}$/.test(y)) {
      return formatValidDateParts(y, m, d)
    }
  }

  // 无法解析时，返回原文本
  return trimmed
}

function formatValidDateParts(yearStr: string, monthStr?: string, dayStr?: string): string {
  const year = parseInt(yearStr, 10)
  if (isNaN(year) || year < 1000 || year > 9999) {
    return yearStr
  }

  let result = yearStr

  if (monthStr !== undefined) {
    let month = parseInt(monthStr, 10)
    if (!isNaN(month)) {
      month = Math.max(1, Math.min(12, month))
      result += `-${String(month).padStart(2, '0')}`

      if (dayStr !== undefined) {
        let day = parseInt(dayStr, 10)
        if (!isNaN(day)) {
          day = Math.max(1, Math.min(31, day))
          result += `-${String(day).padStart(2, '0')}`
        }
      }
    }
  }

  return result
}
