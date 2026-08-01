import { StoreBook } from 'store/book'
import { StoreBlobs } from 'store/blobs'

export function getModePageSize(
  pages: StoreBook.PageItem[],
  blobs: Record<string, StoreBlobs.ImageBlob>,
  fallbackSize: [number, number] = [1200, 1600]
): [number, number] {
  const counts: Record<string, number> = {}
  let maxCount = 0
  let modeSizeStr = ''

  if (Array.isArray(pages)) {
    for (const p of pages) {
      if (!p || p.blank || !p.blobID) continue
      const blobItem = blobs[p.blobID]
      if (blobItem && blobItem.width > 0 && blobItem.height > 0) {
        const key = `${blobItem.width}x${blobItem.height}`
        counts[key] = (counts[key] || 0) + 1
        if (counts[key] > maxCount) {
          maxCount = counts[key]
          modeSizeStr = key
        }
      }
    }
  }

  if (modeSizeStr) {
    const parts = modeSizeStr.split('x').map(Number)
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      return [parts[0], parts[1]]
    }
  }

  return fallbackSize
}

export function getPageEffectiveSize(
  pageItem: StoreBook.PageItem | null | undefined,
  blobItem: StoreBlobs.ImageBlob | null | undefined,
  pageSizeMode: 'manual' | 'auto',
  fallbackPageSize: [number, number],
  modeSize?: [number, number]
): [number, number] {
  if (pageSizeMode === 'auto') {
    if (blobItem && blobItem.width > 0 && blobItem.height > 0) {
      return [blobItem.width, blobItem.height]
    }
    if (modeSize && modeSize[0] > 0 && modeSize[1] > 0) {
      return modeSize
    }
  }

  return fallbackPageSize
}
