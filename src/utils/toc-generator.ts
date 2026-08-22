export interface ContentItem {
  pageIndex: number | null
  title: string
  level: number
}

export interface PageImageInfo {
  index: number
  blobID: string
  fileName: string
  blank: boolean
}

export type TOCGenerateMode = 'smart' | 'folder' | 'interval' | 'filename' | 'page'

/**
 * 生成标题所用的本地化文案。仅用于凭空生成的标题；
 * 从文件名/文件夹名中提取到的标题保留其原文语义。
 */
export interface TOCLabels {
  cover: string
  chapter: (num: number) => string
  page: (num: number) => string
}

const DEFAULT_LABELS: TOCLabels = {
  cover: '封面',
  chapter: (num: number) => `第 ${num} 话`,
  page: (num: number) => `第 ${num} 页`,
}

export interface TOCGenerateOptions {
  mode: TOCGenerateMode
  interval?: number
  labels?: TOCLabels
  /** 传入书籍封面设置：独立封面模式下封面不属于阅读流，生成结果不含
   *  封面条目，页码从第一个内容页的 1 开始（与卡片编号一致） */
  coverPosition?: 'first-page' | 'alone'
}

// Clean file path to extract directory and basename without extension
const cleanExt = (filename: string): string => filename.replace(/\.[^/.]+$/, '')

const getFolderAndName = (fullPath: string): { dir: string; name: string } => {
  const normalized = fullPath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  if (parts.length > 1) {
    return {
      dir: parts.slice(0, -1).join('/'),
      name: parts[parts.length - 1]
    }
  }
  return { dir: '', name: fullPath }
}

// Extract chapter title from filename or folder name
export const extractChapterTitle = (text: string, labels: TOCLabels = DEFAULT_LABELS): string | null => {
  const cleaned = cleanExt(text).trim()
  if (!cleaned) return null

  // 1. Explicit patterns: 第X话 / 第X章 / 第一话 / 卷X
  const matchCn = /第\s*([0-9一二三四五六七八九十百千]+)\s*([话話章節集卷回])(?:\s*(.*))?/i.exec(cleaned)
  if (matchCn) {
    const num = matchCn[1]
    const unit = matchCn[2]
    const extra = matchCn[3] ? matchCn[3].trim() : ''
    return `第${num}${unit}${extra ? ' ' + extra : ''}`
  }

  // 2. English patterns: Chapter X / Ch.X / Vol.X
  const matchEn = /(?:Chapter|Ch\.|Vol\.|Volume|Ep\.|Episode)\s*(\d+)(?:\s*[:-]?\s*(.*))?/i.exec(cleaned)
  if (matchEn) {
    const num = matchEn[1]
    const extra = matchEn[2] ? matchEn[2].trim() : ''
    return `Chapter ${num}${extra ? ' ' + extra : ''}`
  }

  // 3. Short chapter tag c01, c001
  const matchC = /(?:^|[\s_.-])c(\d{1,4})(?:[\s_.-]|$)/i.exec(cleaned)
  if (matchC) {
    return labels.chapter(parseInt(matchC[1], 10))
  }

  // 4. Special keywords (Cover / 封面 / 表紙 / 后记 / 附录 / 彩页 etc.)
  const matchKw = /(Cover|封面|表紙|彩页|卷头|前言|目录|后记|附录|Extra|番外)/i.exec(cleaned)
  if (matchKw) {
    const kw = matchKw[1].toLowerCase()
    if (kw === 'cover' || kw === '封面' || kw === '表紙') return labels.cover
    return matchKw[1]
  }

  return null
}

export const generateTOC = (
  pages: PageImageInfo[],
  options: TOCGenerateOptions = { mode: 'smart' }
): ContentItem[] => {
  const { mode, interval = 10, labels = DEFAULT_LABELS, coverPosition } = options
  const coverOffset = coverPosition === 'alone' ? 1 : 0

  if (!pages || pages.length === 0) {
    return [{ pageIndex: 0, title: labels.cover, level: 0 }]
  }

  const result: ContentItem[] = []
  const addedPages = new Set<number>()

  const addEntry = (pageIndex: number, title: string, level: number = 0) => {
    if (!addedPages.has(pageIndex) && title.trim()) {
      result.push({ pageIndex, title: title.trim(), level })
      addedPages.add(pageIndex)
    }
  }

  if (mode === 'page') {
    for (let i = coverOffset; i < pages.length; i++) {
      const title = i === 0 ? labels.cover : labels.page(i + 1 - coverOffset)
      addEntry(i, title)
    }
    return result
  }

  if (mode === 'interval') {
    const step = Math.max(1, interval)
    // 产品行为：普通封面模式下封面占据"第 1 话"位置（首个内容条目为第 2 话）；
    // 独立封面模式从第一个内容页的"第 1 话"起算
    for (let i = coverOffset; i < pages.length; i += step) {
      const chapterNum = Math.floor((i - coverOffset) / step) + 1
      const title = i === 0 ? labels.cover : labels.chapter(chapterNum)
      addEntry(i, title)
    }
    return result
  }

  if (mode === 'filename') {
    pages.forEach((page, i) => {
      if (coverOffset && i === 0) return
      const { name } = getFolderAndName(page.fileName)
      const cleaned = cleanExt(name) || labels.page(i + 1 - coverOffset)
      addEntry(i, cleaned)
    })
    return result
  }

  if (mode === 'folder') {
    let lastDir = ''
    pages.forEach((page, i) => {
      if (coverOffset && i === 0) return
      const { dir } = getFolderAndName(page.fileName)
      if (dir && dir !== lastDir) {
        // extract last segment of directory path
        const folderName = dir.split('/').pop() || dir
        const title = extractChapterTitle(folderName, labels) || folderName
        addEntry(i, title)
        lastDir = dir
      }
    })
    if (result.length === 0 && pages.length > coverOffset) {
      // standalone-cover books have no cover entry; anchor at the first content page
      addEntry(coverOffset, coverOffset ? labels.page(1) : labels.cover)
    }
    return result
  }

  // Default: 'smart' mode
  // Step 1: Check folder structure transitions first
  let hasFolderStructure = false
  const dirs = pages.map(p => getFolderAndName(p.fileName).dir).filter(Boolean)
  const uniqueDirs = Array.from(new Set(dirs))
  if (uniqueDirs.length > 1) {
    hasFolderStructure = true
    let lastDir = ''
    pages.forEach((page, i) => {
      if (coverOffset && i === 0) return
      const { dir } = getFolderAndName(page.fileName)
      if (dir && dir !== lastDir) {
        const folderName = dir.split('/').pop() || dir
        const title = extractChapterTitle(folderName, labels) || folderName
        addEntry(i, title)
        lastDir = dir
      }
    })
  }

  // Step 2: Check filename chapter regexes
  pages.forEach((page, i) => {
    if (coverOffset && i === 0) return
    const { name } = getFolderAndName(page.fileName)
    const title = extractChapterTitle(name, labels)
    if (title) {
      addEntry(i, title)
    }
  })

  // Step 3: Ensure the first reading page has an entry if nothing matched it
  if (pages.length > coverOffset && !addedPages.has(coverOffset)) {
    const firstName = getFolderAndName(pages[coverOffset]?.fileName || '').name
    const titleFirst = extractChapterTitle(firstName, labels)
      || (coverOffset ? labels.page(1) : labels.cover)
    // Prepend or add at 0
    result.unshift({ pageIndex: coverOffset, title: titleFirst, level: 0 })
    addedPages.add(coverOffset)
  }

  // Sort by pageIndex ascending
  result.sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0))

  return result
}
