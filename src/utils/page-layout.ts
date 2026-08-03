import { StoreBook } from 'store/book'

export type CustomSpreadType = StoreBook.CustomSpreadType

export interface PageLayoutInfoOptions {
  pageIndex: number
  pages?: Array<{ customSpread?: CustomSpreadType }>
  coverPosition: 'first-page' | 'alone'
  pageDirection: 'left' | 'right'
  pageFitSetting?: 'contain' | 'cover' | 'fill'
  customSpread?: CustomSpreadType
  pageShow?: 'two' | 'one'
  isFirstInPair?: boolean
  isSingle?: boolean
}

export interface PageLayoutInfo {
  spread: 'left' | 'right' | 'center'
  par: string
}

export function getSpreadPairs(
  pages: Array<{ customSpread?: CustomSpreadType }>,
  coverPosition: 'first-page' | 'alone',
  pageShow: 'two' | 'one' = 'two'
): Array<number[]> {
  const result: Array<number[]> = []
  if (!pages || pages.length === 0) return result

  result.push([0])
  let i = 1

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
  const { pageIndex, pages, coverPosition, pageDirection, pageFitSetting, customSpread, pageShow, isFirstInPair, isSingle } = options

  let spread: 'left' | 'right' | 'center'

  if (isSingle || customSpread === 'center' || pageIndex === 0) {
    spread = 'center'
  } else if (isFirstInPair !== undefined) {
    if (pageDirection === 'right') {
      spread = isFirstInPair ? 'right' : 'left'
    } else {
      spread = isFirstInPair ? 'left' : 'right'
    }
  } else if (pages && Array.isArray(pages)) {
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
    const isSelfCenter = pageIndex === 0 || ((customSpread as string) === 'center')
    if (isSelfCenter) {
      spread = 'center'
    } else {
      const baseIndex = pageIndex - 1
      const pairSlot = Math.max(0, baseIndex) % 2
      if (pageDirection === 'right') {
        spread = pairSlot === 0 ? 'right' : 'left'
      } else {
        spread = pairSlot === 0 ? 'left' : 'right'
      }
    }
  }

  let par = 'none'
  if (pageFitSetting !== 'fill') {
    par = 'xMidYMid'
    if (pageFitSetting === 'cover') {
      par += ' slice'
    } else {
      par += ' meet'
    }
  }

  return {
    spread,
    par,
  }
}
