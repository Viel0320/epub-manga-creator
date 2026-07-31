export interface ContentItem {
  pageIndex: number | null
  title: string
}

export interface PageImageInfo {
  index: number
  blobID: string
  fileName: string
  blank: boolean
}

export type TOCGenerateMode = 'smart' | 'folder' | 'interval' | 'filename' | 'page'

export interface TOCGenerateOptions {
  mode: TOCGenerateMode
  interval?: number
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
export const extractChapterTitle = (text: string): string | null => {
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
    return `第 ${parseInt(matchC[1], 10)} 话`
  }

  // 4. Special keywords (Cover / 封面 / 表紙 / 后记 / 附录 / 彩页 etc.)
  const matchKw = /(Cover|封面|表紙|彩页|卷头|前言|目录|后记|附录|Extra|番外)/i.exec(cleaned)
  if (matchKw) {
    const kw = matchKw[1].toLowerCase()
    if (kw === 'cover' || kw === '封面' || kw === '表紙') return '封面'
    return matchKw[1]
  }

  return null
}

export const generateTOC = (
  pages: PageImageInfo[],
  options: TOCGenerateOptions = { mode: 'smart' }
): ContentItem[] => {
  if (!pages || pages.length === 0) {
    return [{ pageIndex: 0, title: '封面' }]
  }

  const { mode, interval = 10 } = options
  const result: ContentItem[] = []
  const addedPages = new Set<number>()

  const addEntry = (pageIndex: number, title: string) => {
    if (!addedPages.has(pageIndex) && title.trim()) {
      result.push({ pageIndex, title: title.trim() })
      addedPages.add(pageIndex)
    }
  }

  if (mode === 'page') {
    pages.forEach((_, i) => {
      const title = i === 0 ? '封面' : `第 ${i + 1} 页`
      addEntry(i, title)
    })
    return result
  }

  if (mode === 'interval') {
    const step = Math.max(1, interval)
    for (let i = 0; i < pages.length; i += step) {
      const chapterNum = Math.floor(i / step) + 1
      const title = i === 0 ? '封面' : `第 ${chapterNum} 话`
      addEntry(i, title)
    }
    return result
  }

  if (mode === 'filename') {
    pages.forEach((page, i) => {
      const { name } = getFolderAndName(page.fileName)
      const cleaned = cleanExt(name) || `第 ${i + 1} 页`
      addEntry(i, cleaned)
    })
    return result
  }

  if (mode === 'folder') {
    let lastDir = ''
    pages.forEach((page, i) => {
      const { dir } = getFolderAndName(page.fileName)
      if (dir && dir !== lastDir) {
        // extract last segment of directory path
        const folderName = dir.split('/').pop() || dir
        const title = extractChapterTitle(folderName) || folderName
        addEntry(i, title)
        lastDir = dir
      }
    })
    if (result.length === 0) {
      addEntry(0, '封面')
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
      const { dir } = getFolderAndName(page.fileName)
      if (dir && dir !== lastDir) {
        const folderName = dir.split('/').pop() || dir
        const title = extractChapterTitle(folderName) || folderName
        addEntry(i, title)
        lastDir = dir
      }
    })
  }

  // Step 2: Check filename chapter regexes
  pages.forEach((page, i) => {
    const { name } = getFolderAndName(page.fileName)
    const title = extractChapterTitle(name)
    if (title) {
      addEntry(i, title)
    }
  })

  // Step 3: Ensure page 0 has a title if nothing matched page 0
  if (!addedPages.has(0)) {
    // Check if page 0 image name looks like cover
    const page0Name = getFolderAndName(pages[0]?.fileName || '').name
    const title0 = extractChapterTitle(page0Name) || '封面'
    // Prepend or add at 0
    result.unshift({ pageIndex: 0, title: title0 })
    addedPages.add(0)
  }

  // Sort by pageIndex ascending
  result.sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0))

  return result
}
