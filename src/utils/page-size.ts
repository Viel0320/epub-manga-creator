import { StoreBook } from 'store/book'
import { StoreBlobs } from 'store/blobs'

export const PAGE_SIZE_PRESETS: { name: string; size: [number, number] }[] = [
  { name: 'Kindle', size: [1200, 1600] },
  { name: 'B4', size: [1250, 1765] },
  { name: 'B5', size: [880, 1250] },
  { name: 'A4', size: [1050, 1485] },
  { name: 'A5', size: [742, 1050] },
  { name: 'CG 16:9', size: [1600, 900] },
  { name: 'CG 16:10', size: [1600, 1000] },
]

/** A manual size belongs to a preset when it matches in either orientation,
 *  so swapping width and height keeps the preset selected. */
export function matchPageSizePreset(
  pageSizeMode: 'manual' | 'auto',
  pageSize: [number, number]
): string | null {
  if (pageSizeMode !== 'manual') return null
  const [w, h] = pageSize
  const preset = PAGE_SIZE_PRESETS.find(({ size: [pw, ph] }) =>
    (w === pw && h === ph) || (w === ph && h === pw))
  return preset ? preset.name : null
}

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
