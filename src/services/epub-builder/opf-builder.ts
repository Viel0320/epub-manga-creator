import getTemplateStandardOpf from 'template/standard.opf'
import { getPageLayoutInfo } from 'utils/page-layout'
import { EpubBookData } from './types'
import { htmlToEscape, getNumberStr } from './utils'

export interface OpfBuildResult {
  opfContent: string
  pageItemStr: string[]
  imageItemStr: string[]
  itemRefStr: string[]
}

/**
 * 构建 standard.opf 文件
 */
export const buildStandardOpfDocument = (
  data: EpubBookData,
  opfWidth: string,
  opfHeight: string
): OpfBuildResult => {
  const coverAlone = data.coverPosition === 'alone'
  const imageItemStr: string[] = []
  const pageItemStr: string[] = []
  const itemRefStr: string[] = []

  // use the same spread grouping as page-builder (single source of truth)
  const refPairs = data.spreadPairs
  const refPairMap = new Map<number, boolean | undefined>()
  for (const pair of refPairs) {
    if (pair.length === 1) {
      refPairMap.set(pair[0], undefined)
    } else {
      refPairMap.set(pair[0], true)
      refPairMap.set(pair[1], false)
    }
  }

  data.pages.forEach((pageItem, i) => {
    const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
    const imageFileName = (i === 0 ? '' : 'i_') + numStr

    if (pageItem.blank) {
      pageItemStr.push(
        `<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg"></item>`
      )
    } else {
      const mimeType = data.blobs[pageItem.blobID].blob.type
      pageItemStr.push(
        `<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg" fallback="${imageFileName}"></item>`
      )
      imageItemStr.push(
        `<item id="${imageFileName}" href="image/${imageFileName}.${mimeType.slice(6)}" media-type="${mimeType}"${
          i === 0 ? ' properties="cover-image"' : ''
        }></item>`
      )
    }

    if (i !== 0) {
      const refFirst = refPairMap.get(i)
      const isSinglePage = refFirst === undefined
      const layout = getPageLayoutInfo({
        pageIndex: i,
        coverPosition: data.coverPosition,
        pageDirection: data.pageDirection,
        pageFitSetting: data.pageFit,
        customSpread: pageItem.customSpread,
        isFirstInPair: refFirst,
        isSingle: isSinglePage
      })
      // EPUB 3 spine vocabulary only defines page-spread-left/right;
      // "center" requires the rendition: prefix to pass epubcheck
      const spreadDir = isSinglePage ? 'center' : layout.spread
      const spreadProperty = spreadDir === 'center'
        ? 'rendition:page-spread-center'
        : `page-spread-${spreadDir}`
      itemRefStr.push(
        `<itemref linear="yes" idref="p_${numStr}" properties="${spreadProperty}"></itemref>`
      )
    }
  })

  if (coverAlone) {
    pageItemStr.splice(0, 1)
  } else {
    itemRefStr.unshift(
      `<itemref linear="yes" idref="p_cover" properties="rendition:page-spread-center"></itemref>`
    )
  }

  const bookTitle = htmlToEscape(data.bookTitle.trim())

  const authorsStr = data.bookAuthors
    .filter(name => name.trim())
    .map((name, i) => {
      return [
        `<dc:creator id="creator${i + 1}">${htmlToEscape(name.trim())}</dc:creator>`,
        `<meta refines="#creator${i + 1}" property="role" scheme="marc:relators">aut</meta>`,
        `<meta refines="#creator${i + 1}" property="display-seq">${i + 1}</meta>`
      ].join('\n')
    })
    .join('\n')

  const contributorsStr = (data.bookContributors || [])
    .map((item, i) => {
      if (!item.name.trim()) return ''
      return [
        `<dc:contributor id="contrib${i + 1}">${htmlToEscape(item.name.trim())}</dc:contributor>`,
        `<meta refines="#contrib${i + 1}" property="role" scheme="marc:relators">${item.role}</meta>`
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n')

  const descriptionStr = data.bookDescription.trim()
    ? `<dc:description>${htmlToEscape(data.bookDescription.trim())}</dc:description>`
    : ''

  const dateStr = data.bookDate.trim()
    ? `<dc:date>${htmlToEscape(data.bookDate.trim())}</dc:date>`
    : ''

  let collectionStr = ''
  if (data.bookSeriesName.trim()) {
    collectionStr = [
      `<meta property="belongs-to-collection" id="c01">${htmlToEscape(
        data.bookSeriesName.trim()
      )}</meta>`,
      `<meta refines="#c01" property="collection-type">series</meta>`,
      data.bookSeriesVolume.trim()
        ? `<meta refines="#c01" property="group-position">${htmlToEscape(
            data.bookSeriesVolume.trim()
          )}</meta>`
        : ''
    ]
      .filter(Boolean)
      .join('\n')
  }

  const isbnStr = data.bookISBN.trim()
    ? `<dc:identifier id="isbn-id">urn:isbn:${htmlToEscape(data.bookISBN.trim())}</dc:identifier>`
    : ''

  const primaryWritingMode =
    data.pageDirection === 'right' ? 'horizontal-rl' : 'horizontal-lr'

  let templateStandardOpf = getTemplateStandardOpf()

  templateStandardOpf = templateStandardOpf
    .replace('{{uuid}}', () => htmlToEscape(data.bookID))
    .replace('<!-- isbn -->', () => isbnStr)
    .replace('{{title}}', () => bookTitle)
    .replace('<!-- creator-list -->', () => authorsStr)
    .replace('{{subject}}', () => htmlToEscape(data.bookSubject))
    .replace('{{publisher}}', () => htmlToEscape(data.bookPublisher))
    .replace('{{language}}', () => htmlToEscape(data.bookLanguage || 'ja'))
    .replace('<!-- contributor-list -->', () => contributorsStr)
    .replace('<!-- description -->', () => descriptionStr)
    .replace('<!-- date -->', () => dateStr)
    .replace('<!-- collection-info -->', () => collectionStr)
    .replace('{{primaryWritingMode}}', primaryWritingMode)
    .replace('{{createTime}}', new Date().toISOString())
    .replace(new RegExp('{{width}}', 'gm'), opfWidth)
    .replace(new RegExp('{{height}}', 'gm'), opfHeight)
    .replace('<!-- item-image -->', () => imageItemStr.join('\n'))
    .replace('<!-- item-xhtml -->', () => pageItemStr.join('\n'))
    .replace('<!-- itemref-xhtml -->', () => itemRefStr.join('\n'))
    .replace(
      '{{direction}}',
      data.pageDirection === 'right' ? ' page-progression-direction="rtl"' : ''
    )

  return {
    opfContent: templateStandardOpf,
    pageItemStr,
    imageItemStr,
    itemRefStr
  }
}
