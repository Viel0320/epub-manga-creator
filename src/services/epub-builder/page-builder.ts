import getTemplatePageXhtml from 'template/page.xhtml'
import getTemplatePageImgXhtml from 'template/page_img.xhtml'
import { getPageLayoutInfo } from 'utils/page-layout'
import { getModePageSize, getPageEffectiveSize } from 'utils/page-size'
import { EpubBookData } from './types'
import { fillTemplate, htmlToEscape, getNumberStr } from './utils'

export interface GeneratedPageFile {
  path: string
  content: string | Blob
}

export interface GeneratedPagesResult {
  opfWidth: string
  opfHeight: string
  textFiles: GeneratedPageFile[]
  imageFiles: GeneratedPageFile[]
}

/**
 * 构建 EPUB 中所有的 XHTML 页面文件与图片资源文件
 */
export const buildPageFiles = (data: EpubBookData): GeneratedPagesResult => {
  const templatePageXhtml = getTemplatePageXhtml()
  const templatePageImgXhtml = getTemplatePageImgXhtml()
  const coverAlone = data.coverPosition === 'alone'
  const fitMode = data.pageFit
  const bookTitle = htmlToEscape(data.bookTitle.trim())

  const modeSize = getModePageSize(data.pages, data.blobs as any, data.pageSize)
  const opfPageSize = data.pageSizeMode === 'auto' ? modeSize : data.pageSize
  const opfWidth = opfPageSize[0] + ''
  const opfHeight = opfPageSize[1] + ''

  const layoutPairs = data.spreadPairs
  const layoutPairMap = new Map<number, boolean | undefined>()
  for (const pair of layoutPairs) {
    if (pair.length === 1) {
      layoutPairMap.set(pair[0], undefined)
    } else {
      layoutPairMap.set(pair[0], true)
      layoutPairMap.set(pair[1], false)
    }
  }

  const textFiles: GeneratedPageFile[] = []
  const imageFiles: GeneratedPageFile[] = []

  if (data.imgTag === 'svg') {
    data.pages.forEach((pageItem, i) => {
      const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
      const blobItem = pageItem.blank ? null : data.blobs[pageItem.blobID]
      const effSize = getPageEffectiveSize(
        pageItem,
        blobItem as any,
        data.pageSizeMode,
        data.pageSize,
        modeSize
      )
      const pageViewPortWidth = effSize[0] + ''
      const pageViewPortHeight = effSize[1] + ''

      if (pageItem.blank) {
        if (i === 0 && coverAlone) {
          return
        }
        textFiles.push({
          path: `OEBPS/text/p_${numStr}.xhtml`,
          content: fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
            .replace('{{par}}', 'xMidYMid meet')
            .replace('{{image}}', '')
        })
        return
      }

      const blob = data.blobs[pageItem.blobID].blob
      const ext = blob.type.slice(6)
      const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

      imageFiles.push({
        path: `OEBPS/image/${imageFileName}`,
        content: blob
      })

      if (i === 0 && coverAlone) {
        // standalone cover: image only, no xhtml page
        return
      }

      const layoutFirst = layoutPairMap.get(i)
      const layout = getPageLayoutInfo({
        pageIndex: i,
        coverPosition: data.coverPosition,
        pageDirection: data.pageDirection,
        pagePositionSetting: data.pagePosition,
        pageFitSetting: data.pageFit,
        customSpread: pageItem.customSpread,
        isFirstInPair: layoutFirst,
        isSingle: layoutFirst === undefined
      })

      textFiles.push({
        path: `OEBPS/text/p_${numStr}.xhtml`,
        content: fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
          .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
          .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
          .replace('{{par}}', layout.par)
          .replace(
            '{{image}}',
            `<image width="100%" height="100%" preserveAspectRatio="${layout.par}" xlink:href="../image/${imageFileName}" />`
          )
      })
    })
  } else {
    // imgTag === 'img'
    data.pages.forEach((pageItem, i) => {
      const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
      const blobItem = pageItem.blank ? null : data.blobs[pageItem.blobID]
      const effSize = getPageEffectiveSize(
        pageItem,
        blobItem as any,
        data.pageSizeMode,
        data.pageSize,
        modeSize
      )
      const pageViewPortWidth = effSize[0] + ''
      const pageViewPortHeight = effSize[1] + ''

      if (pageItem.blank) {
        if (i === 0 && coverAlone) {
          return
        }
        textFiles.push({
          path: `OEBPS/text/p_${numStr}.xhtml`,
          content: fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
            .replace(
              `<img src="{{imageSource}}" style="{{style}}"/>`,
              '<div style="width:100%;height:100%;"></div>'
            )
        })
        return
      }

      const blob = data.blobs[pageItem.blobID].blob
      const ext = blob.type.slice(6)
      const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

      imageFiles.push({
        path: `OEBPS/image/${imageFileName}`,
        content: blob
      })

      if (i === 0 && coverAlone) {
        // standalone cover: image only, no xhtml page
        return
      }

      const layoutFirst = layoutPairMap.get(i)
      const layout = getPageLayoutInfo({
        pageIndex: i,
        coverPosition: data.coverPosition,
        pageDirection: data.pageDirection,
        pagePositionSetting: data.pagePosition,
        pageFitSetting: data.pageFit,
        customSpread: pageItem.customSpread,
        isFirstInPair: layoutFirst,
        isSingle: layoutFirst === undefined
      })

      let imgStyle = 'object-fit:contain'
      if (fitMode === 'fill') {
        imgStyle = 'object-fit:fill'
      } else if (fitMode === 'cover') {
        imgStyle = 'object-fit:cover'
      }

      textFiles.push({
        path: `OEBPS/text/p_${numStr}.xhtml`,
        content: fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
          .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
          .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
          .replace('{{imageSource}}', `../image/${imageFileName}`)
          .replace('{{style}}', imgStyle)
      })
    })
  }

  return {
    opfWidth,
    opfHeight,
    textFiles,
    imageFiles
  }
}
