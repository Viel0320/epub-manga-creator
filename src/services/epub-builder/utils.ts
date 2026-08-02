/**
 * EPUB 构建通用工具函数
 */

/**
 * 转义 XML/HTML 特殊字符并过滤非法字符
 */
export const htmlToEscape = (str: string): string => {
  if (!str) return ''
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/g, '')
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 模板插值函数，规避 plain-string replace 中 $& 等特殊符识别问题
 */
export const fillTemplate = (template: string, pattern: string | RegExp, value: string): string =>
  template.replace(pattern, () => value)

/**
 * 补零格式化数字（如 1 -> "0001"）
 */
export const getNumberStr = (num: number, zeroCount: number): string => {
  let str = String(num)
  let i = zeroCount - str.length
  while (i-- > 0) {
    str = '0' + str
  }
  return str
}
