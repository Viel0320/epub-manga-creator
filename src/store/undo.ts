import { makeAutoObservable, runInAction } from "mobx"
import { StoreBook } from "store/book"
import { ContentItem } from "store/contents"
import { StoreBlobs, formatBlobItem } from "store/blobs"
import type { StoreMain } from "store/main"

export interface UndoRecord {
  pages: StoreBook.PageItem[]
  contentsList: ContentItem[]
  pageSize: [number, number]
  pageSizeMode: 'manual' | 'auto'
  selectedPageIndex: number | null
  removedBlobs: Record<string, StoreBlobs.ImageBlob>
  createdBlobIDs: string[]
}

export class UndoStore {
  record: UndoRecord | null = null

  constructor() {
    makeAutoObservable(this)
  }

  get canUndo(): boolean {
    return this.record !== null
  }

  saveRecord(record: UndoRecord) {
    this.record = record
  }

  clearRecord() {
    this.record = null
  }

  async restore(mainStore: StoreMain) {
    if (!this.record) return

    const {
      pages,
      contentsList,
      pageSize,
      pageSizeMode,
      selectedPageIndex,
      removedBlobs,
      createdBlobIDs,
    } = this.record

    // 1. Remove created blobs (e.g. from page split)
    createdBlobIDs.forEach((id) => {
      mainStore.blobs.remove(id)
    })

    // 2. Restore removed blobs (e.g. from page remove or split)
    for (const [blobID, blobItem] of Object.entries(removedBlobs)) {
      try {
        const restoredItem = await formatBlobItem(blobItem.blob)
        runInAction(() => {
          mainStore.blobs.blobs[blobID] = restoredItem
        })
      } catch (err) {
        console.error(`Failed to restore blob ${blobID}:`, err)
      }
    }

    // 3. Restore book, contents, and UI states
    runInAction(() => {
      mainStore.book.pages = pages
      mainStore.contents.updateList(contentsList)
      mainStore.book.pageSize = pageSize
      mainStore.book.pageSizeMode = pageSizeMode
      mainStore.ui.selectPageIndex(selectedPageIndex)
      this.record = null
    })
  }
}

export default UndoStore
