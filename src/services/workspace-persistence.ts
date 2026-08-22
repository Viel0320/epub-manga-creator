import { autorun, runInAction, toJS } from 'mobx'
import { db } from 'utils/db'
import { getLocale } from 'i18n'
import type { StoreBook } from 'store/book'
import type Book from 'store/book'
import type Contents from 'store/contents'
import type { StoreMain } from 'store/main'

export interface WorkspaceSnapshot {
  pages: StoreBook.PageItem[]
  bookInfo: StoreBook.BookInfoSet & { bookID: string }
  pageSettings: {
    pageSize: [number, number]
    pageSizeMode?: Book['pageSizeMode']
    pageShow: Book['pageShow']
    pageFit: Book['pageFit']
    pageBackgroundColor: Book['pageBackgroundColor']
    pageDirection: Book['pageDirection']
    coverPosition: Book['coverPosition']
    imgTag: Book['imgTag']
  }
  contents: { list: Contents['list'] }
  savedAt: number
}

export async function restoreWorkspaceFromDB(store: StoreMain): Promise<void> {
  store.ui.setLoading(true)
  try {
    const backup = (await db.getMetadata('active_book')) as WorkspaceSnapshot | null
    if (!backup || !Array.isArray(backup.pages) || backup.pages.length === 0) {
      return
    }

    const blobIDs: string[] = []
    const blobList: Blob[] = []

    let failedCount = 0
    const imagePages = backup.pages.filter(page => !page.blank && page.blobID)
    const readResults = await Promise.all(
      imagePages.map(async page => {
        try {
          return { blobID: page.blobID, blob: await db.getBlob(page.blobID) }
        } catch (err) {
          console.error(`Failed to read blob ${page.blobID} from IndexedDB:`, err)
          return { blobID: page.blobID, blob: null }
        }
      })
    )
    for (const result of readResults) {
      if (result.blob) {
        blobIDs.push(result.blobID)
        blobList.push(result.blob)
      } else {
        failedCount++
      }
    }

    let restoredIDs: string[] = []
    if (blobList.length > 0) {
      const pushResult = await store.blobs.push(blobList, blobIDs)
      restoredIDs = pushResult.succeededIDs
      failedCount += pushResult.failedCount
    }

    // failed pages compact the list, so TOC entries carrying the original
    // page indices must be remapped to the surviving pages (mirrors the
    // epub import path in store/main.ts)
    const available = new Set(restoredIDs)
    const pageIndexMap = new Map<number, number>()
    let compactedIndex = 0
    backup.pages.forEach((page, originalIndex) => {
      if (page.blank || available.has(page.blobID)) {
        pageIndexMap.set(originalIndex, compactedIndex++)
      }
    })

    runInAction(() => {
      store.book.pages = backup.pages
        .filter(page => page.blank || available.has(page.blobID))
        .map((page, i) => ({ ...page, index: i }))

      if (backup.bookInfo) {
        const info = backup.bookInfo
        store.book.bookID = info.bookID || store.book.bookID
        store.book.bookTitle = info.bookTitle || ''
        store.book.bookAuthors = info.bookAuthors?.length ? info.bookAuthors : ['']
        store.book.bookSubject = info.bookSubject || ''
        store.book.bookPublisher = info.bookPublisher || ''
        store.book.bookLanguage = info.bookLanguage || 'ja'
        store.book.bookSeriesName = info.bookSeriesName || ''
        store.book.bookSeriesVolume = info.bookSeriesVolume || ''
        store.book.bookDescription = info.bookDescription || ''
        store.book.bookDate = info.bookDate || ''
        store.book.bookContributors = Array.isArray(info.bookContributors) ? info.bookContributors : []
        store.book.bookISBN = info.bookISBN || ''
      }

      if (backup.pageSettings) {
        const s = backup.pageSettings
        if (Array.isArray(s.pageSize)) store.book.pageSize = s.pageSize
        if (s.pageSizeMode) store.book.pageSizeMode = s.pageSizeMode
        if (s.pageShow) store.book.pageShow = s.pageShow
        if (s.pageFit) {
          const legacyMap: Record<string, 'contain' | 'cover' | 'fill'> = {
            fit: 'contain',
            fill: 'cover',
            stretch: 'fill'
          }
          store.book.pageFit = legacyMap[s.pageFit] || (s.pageFit as any)
        }
        if (s.pageBackgroundColor) store.book.pageBackgroundColor = s.pageBackgroundColor
        if (s.pageDirection) store.book.pageDirection = s.pageDirection
        if (s.coverPosition) store.book.coverPosition = s.coverPosition
        if (s.imgTag) store.book.imgTag = s.imgTag
      }

      if (backup.contents && Array.isArray(backup.contents.list)) {
        // entries whose page failed to restore become unlinked (null)
        store.contents.updateList(
          backup.contents.list.map(item => ({
            ...item,
            pageIndex: item.pageIndex === null ? null : (pageIndexMap.get(item.pageIndex) ?? null)
          }))
        )
      }

      store.ui.firstImport = false
      restoredIDs.forEach(id => store.savedBlobIDs.add(id))

      const locale = getLocale(store.ui.lang)
      // 报告用户视角的页数：独立封面不计入编号
      const restoredCount = store.book.pages.length - (store.book.coverPosition === 'alone' ? 1 : 0)
      if (failedCount > 0) {
        store.ui.showToast(locale.main.restoredPartial(restoredIDs.length, failedCount), 'warning', 5000)
      } else {
        store.ui.showToast(locale.main.restoredSuccess(restoredCount), 'success', 5000)
      }
    })
  } finally {
    store.ui.setLoading(false)
  }
}

export async function syncWorkspaceToDB(store: StoreMain, snapshot: WorkspaceSnapshot): Promise<void> {
  try {
    await db.saveMetadata('active_book', snapshot)

    const referenced = new Set(
      snapshot.pages.filter(page => !page.blank && page.blobID).map(page => page.blobID)
    )

    // persist blobs that aren't saved yet
    for (const id of Array.from(referenced)) {
      if (!store.savedBlobIDs.has(id)) {
        const item = store.blobs.blobs[id]
        if (item) {
          await db.saveBlob(id, item.blob)
          store.savedBlobIDs.add(id)
        }
      }
    }

    // drop blobs that are no longer referenced by any page
    for (const id of Array.from(store.savedBlobIDs)) {
      if (!referenced.has(id)) {
        await db.deleteBlob(id)
        store.savedBlobIDs.delete(id)
      }
    }
  } catch (err) {
    console.error('Auto-save failed:', err)
  }
}

export function initWorkspaceAutoSave(store: StoreMain): () => void {
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  const disposer = autorun(() => {
    if (!store.isAutoSaveActive) {
      return
    }

    // subscribe to blob additions too, so blobs finished formatting after the
    // pages were pushed still get persisted
    void Object.keys(store.blobs.blobs).length

    const snapshot: WorkspaceSnapshot = {
      pages: toJS(store.book.pages),
      bookInfo: {
        bookID: store.book.bookID,
        bookTitle: store.book.bookTitle,
        bookAuthors: toJS(store.book.bookAuthors),
        bookSubject: store.book.bookSubject,
        bookPublisher: store.book.bookPublisher,
        bookLanguage: store.book.bookLanguage,
        bookSeriesName: store.book.bookSeriesName,
        bookSeriesVolume: store.book.bookSeriesVolume,
        bookDescription: store.book.bookDescription,
        bookDate: store.book.bookDate,
        bookContributors: toJS(store.book.bookContributors),
        bookISBN: store.book.bookISBN,
      },
      pageSettings: {
        pageSize: toJS(store.book.pageSize),
        pageSizeMode: store.book.pageSizeMode,
        pageShow: store.book.pageShow,
        pageFit: store.book.pageFit,
        pageBackgroundColor: store.book.pageBackgroundColor,
        pageDirection: store.book.pageDirection,
        coverPosition: store.book.coverPosition,
        imgTag: store.book.imgTag,
      },
      contents: { list: toJS(store.contents.list) },
      savedAt: Date.now(),
    }

    if (autoSaveTimer !== null) {
      clearTimeout(autoSaveTimer)
    }
    autoSaveTimer = setTimeout(() => syncWorkspaceToDB(store, snapshot), 800)
  })

  return disposer
}
