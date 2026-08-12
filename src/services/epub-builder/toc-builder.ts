import getTemplateNavigationDocumentsXhtml from 'template/navigation-documents.xhtml'
import { EpubContentItem } from './types'
import { fillTemplate, htmlToEscape, getNumberStr } from './utils'

/**
 * 构建 EPUB 目录导航文档 (navigation-documents.xhtml)
 */
export const buildTocNavigationDocument = (
  contentsList: EpubContentItem[],
  coverAlone: boolean
): string => {
  let template = getTemplateNavigationDocumentsXhtml()

  // 在 "alone" 模式下，封面不属于阅读顺序，因此页面索引整体平移
  template = fillTemplate(
    template,
    '{{startPage}}',
    coverAlone ? 'p_0000.xhtml' : 'p_cover.xhtml'
  )

  const tocItems = contentsList
    .filter((item): item is EpubContentItem & { pageIndex: number } => item.pageIndex !== null)
    .sort((a, b) => a.pageIndex - b.pageIndex)

  if (tocItems.length === 0) {
    // the EPUB nav spec requires at least one <li> inside the toc <ol>
    const fallbackHref = coverAlone ? 'text/p_0000.xhtml' : 'text/p_cover.xhtml'
    return fillTemplate(
      template,
      '<!-- navigation-list -->',
      `<li><a href="${fallbackHref}">Start of Content</a></li>`
    )
  }

  // normalize levels so nesting deepens at most one step at a time and the
  // first entry starts at 0; a raw jump (e.g. 0 -> 2) would otherwise emit
  // <ol><ol> without a wrapping <li>, which is invalid in the EPUB nav doc
  let prevRawLevel = 0
  let prevNormLevel = 0
  const normalizedLevels = tocItems.map((item, idx) => {
    const raw = item.level || 0
    let norm: number
    if (idx === 0) {
      norm = 0
    } else if (raw > prevRawLevel) {
      norm = prevNormLevel + 1
    } else if (raw === prevRawLevel) {
      norm = prevNormLevel
    } else {
      norm = Math.min(raw, prevNormLevel)
    }
    prevRawLevel = raw
    prevNormLevel = norm
    return norm
  })

  const lines: string[] = []
  let currentLevel = 0

  for (let idx = 0; idx < tocItems.length; idx++) {
    const item = tocItems[idx]
    const level = normalizedLevels[idx]
    const pageIndex = item.pageIndex
    const title = htmlToEscape(item.title)

    // page i (i >= 1) is always exported as p_{i-1}.xhtml regardless of the
    // cover mode; in "alone" mode the cover has no xhtml page, so entries
    // pointing at page 0 fall back to the first content page
    let href: string
    if (pageIndex === 0) {
      href = coverAlone ? 'text/p_0000.xhtml' : 'text/p_cover.xhtml'
    } else {
      href = `text/p_${getNumberStr(pageIndex - 1, 4)}.xhtml`
    }

    while (currentLevel < level) {
      lines.push('<ol>')
      currentLevel++
    }
    while (currentLevel > level) {
      lines.push('</ol></li>')
      currentLevel--
    }

    lines.push(`<li><a href="${href}">${title}</a>`)
    if (level === currentLevel) {
      const nextLevel = idx + 1 < tocItems.length ? normalizedLevels[idx + 1] : null
      if (nextLevel === null || nextLevel <= level) {
        lines.push('</li>')
      }
    }
  }

  while (currentLevel > 0) {
    lines.push('</ol></li>')
    currentLevel--
  }

  const nestedTocHtml = lines.join('\n')

  return fillTemplate(template, '<!-- navigation-list -->', nestedTocHtml)
}
