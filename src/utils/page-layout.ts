export interface PageLayoutInfoOptions {
  pageIndex: number
  pages?: Array<{ customSpread?: 'center' | 'auto' }>
  coverPosition: 'first-page' | 'alone'
  pageDirection: 'left' | 'right'
  pagePositionSetting: 'center' | 'between'
  pageFitSetting?: 'stretch' | 'fit' | 'fill'
  customSpread?: 'center' | 'auto'
}

export interface PageLayoutInfo {
  spread: 'left' | 'right' | 'center'
  align: 'left' | 'right' | 'center'
  par: string
  objectPosition: string
}

export function getPageLayoutInfo(options: PageLayoutInfoOptions): PageLayoutInfo {
  const { pageIndex, pages, coverPosition, pageDirection, pagePositionSetting, pageFitSetting, customSpread } = options

  let spread: 'left' | 'right' | 'center'

  const isSelfCenter = (pageIndex === 0 && (coverPosition === 'first-page' || coverPosition === 'alone')) ||
                       (pageIndex !== 0 && customSpread === 'center')

  if (isSelfCenter) {
    spread = 'center'
  } else {
    let centerCountBefore = 0
    if (pages && Array.isArray(pages)) {
      for (let k = 1; k < pageIndex; k++) {
        const item = pages[k]
        if (item && item.customSpread === 'center') {
          centerCountBefore++
        }
      }
    }

    const baseIndex = pageIndex - 1
    const effectivePos = baseIndex - centerCountBefore

    if (pageDirection === 'right') {
      spread = effectivePos % 2 === 0 ? 'right' : 'left'
    } else {
      spread = effectivePos % 2 === 0 ? 'left' : 'right'
    }
  }

  let align: 'left' | 'right' | 'center' = 'center'
  if (pagePositionSetting === 'between' && spread !== 'center') {
    align = spread === 'left' ? 'right' : 'left'
  }

  let parAlign = 'xMidYMid'
  if (align === 'left') {
    parAlign = 'xMinYMid'
  } else if (align === 'right') {
    parAlign = 'xMaxYMid'
  }

  let par = 'none'
  if (pageFitSetting !== 'stretch') {
    par = parAlign
    if (pageFitSetting === 'fit') {
      par += ' meet'
    } else if (pageFitSetting === 'fill') {
      par += ' slice'
    } else {
      par += ' meet'
    }
  }

  let objectPosition = 'center center'
  if (align === 'left') {
    objectPosition = 'left center'
  } else if (align === 'right') {
    objectPosition = 'right center'
  }

  return {
    spread,
    align,
    par,
    objectPosition,
  }
}
