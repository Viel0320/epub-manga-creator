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
    return fillTemplate(template, '<!-- navigation-list -->', '')
  }

  const lines: string[] = []
  let currentLevel = 0

  for (let idx = 0; idx < tocItems.length; idx++) {
    const item = tocItems[idx]
    const level = item.level || 0
    const pageIndex = item.pageIndex
    const title = htmlToEscape(item.title)

    let href: string
    if (!coverAlone && pageIndex === 0) {
      href = 'text/p_cover.xhtml'
    } else {
      href = `text/p_${getNumberStr(coverAlone ? pageIndex : pageIndex - 1, 4)}.xhtml`
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
      const nextItem = tocItems[idx + 1]
      if (!nextItem || (nextItem.level || 0) <= level) {
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
