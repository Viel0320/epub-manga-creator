import { autorun, runInAction, toJS } from 'mobx'
import { db } from 'utils/db'
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
    pagePosition: Book['pagePosition']
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
    for (const page of backup.pages) {
      if (page.blank || !page.blobID) {
        continue
      }
      try {
        const blob = await db.getBlob(page.blobID)
        if (blob) {
          blobIDs.push(page.blobID)
          blobList.push(blob)
        } else {
          failedCount++
        }
      } catch (err) {
        failedCount++
        console.error(`Failed to read blob ${page.blobID} from IndexedDB:`, err)
      }
    }

    if (blobList.length > 0) {
      await store.blobs.push(blobList, blobIDs)
    }

    runInAction(() => {
      const available = new Set(blobIDs)
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
        if (s.pagePosition) store.book.pagePosition = s.pagePosition
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
        store.contents.updateList(backup.contents.list)
      }

      store.ui.firstImport = false
      blobIDs.forEach(id => store.savedBlobIDs.add(id))

      if (failedCount > 0) {
        store.ui.showToast(`已恢复 ${blobIDs.length} 页，有 ${failedCount} 页图片损坏无法读取`, 'warning', 5000)
      } else {
        store.ui.showToast(`已成功从本地备份恢复工作区 (${store.book.pages.length} 页)`, 'success', 5000)
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
        pagePosition: store.book.pagePosition,
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
