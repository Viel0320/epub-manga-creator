import { StoreBook } from 'store/book'

export type CustomSpreadType = StoreBook.CustomSpreadType

export interface PageLayoutInfoOptions {
  pageIndex: number
  pages?: Array<{ customSpread?: CustomSpreadType }>
  coverPosition: 'first-page' | 'alone'
  pageDirection: 'left' | 'right'
  pagePositionSetting: 'center' | 'between'
  pageFitSetting?: 'stretch' | 'fit' | 'fill'
  customSpread?: CustomSpreadType
  pageShow?: 'two' | 'one'
}

export interface PageLayoutInfo {
  spread: 'left' | 'right' | 'center'
  align: 'left' | 'right' | 'center'
  par: string
  objectPosition: string
}

export function getSpreadPairs(
  pages: Array<{ customSpread?: CustomSpreadType }>,
  coverPosition: 'first-page' | 'alone',
  pageShow: 'two' | 'one' = 'two'
): Array<number[]> {
  const result: Array<number[]> = []
  if (!pages || pages.length === 0) return result

  let i = 0
  if (coverPosition === 'first-page') {
    result.push([0])
    i = 1
  }

  while (i < pages.length) {
    const p1 = pages[i]

    if (p1.customSpread === 'center') {
      result.push([i])
      i++
      continue
    }

    const pNext = i + 1 < pages.length ? pages[i + 1] : null

    if (p1.customSpread === 'bind-next') {
      if (pNext && pNext.customSpread !== 'center') {
        result.push([i, i + 1])
        i += 2
      } else {
        result.push([i])
        i++
      }
      continue
    }

    if (pNext && pNext.customSpread === 'bind-prev') {
      result.push([i, i + 1])
      i += 2
      continue
    }

    const pAfterNext = i + 2 < pages.length ? pages[i + 2] : null

    if (pNext && pAfterNext && pAfterNext.customSpread === 'bind-prev') {
      result.push([i])
      i++
      continue
    }

    if (pNext && pNext.customSpread === 'bind-next') {
      result.push([i])
      i++
      continue
    }

    if (pNext && pNext.customSpread === 'center') {
      result.push([i])
      i++
      continue
    }

    if (pNext && pageShow === 'two') {
      result.push([i, i + 1])
      i += 2
    } else {
      result.push([i])
      i++
    }
  }

  return result
}

export function getPageLayoutInfo(options: PageLayoutInfoOptions): PageLayoutInfo {
  const { pageIndex, pages, coverPosition, pageDirection, pagePositionSetting, pageFitSetting, customSpread, pageShow } = options

  let spread: 'left' | 'right' | 'center'

  if (pages && Array.isArray(pages)) {
    const pairs = getSpreadPairs(pages, coverPosition, pageShow || 'two')
    const pair = pairs.find(p => p.includes(pageIndex))

    if (!pair || pair.length === 1) {
      spread = 'center'
    } else {
      const firstInPair = pair[0] === pageIndex
      if (pageDirection === 'right') {
        spread = firstInPair ? 'right' : 'left'
      } else {
        spread = firstInPair ? 'left' : 'right'
      }
    }
  } else {
    const isSelfCenter = (pageIndex === 0 && coverPosition === 'first-page') || ((customSpread as string) === 'center')
    if (isSelfCenter) {
      spread = 'center'
    } else {
      const baseIndex = coverPosition === 'first-page' ? pageIndex - 1 : pageIndex
      const pairSlot = Math.max(0, baseIndex) % 2
      if (pageDirection === 'right') {
        spread = pairSlot === 0 ? 'right' : 'left'
      } else {
        spread = pairSlot === 0 ? 'left' : 'right'
      }
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
