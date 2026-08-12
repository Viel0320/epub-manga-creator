import React from 'react';
import { autorun, makeAutoObservable, reaction, runInAction, toJS } from "mobx"
import uuid from 'utils/get-uuid'
import Book, { StoreBook } from 'store/book'
import Ui from 'store/ui'
import Contents from 'store/contents'
import UndoStore from 'store/undo'
import storeBlobs, { Store as Blobs, StoreBlobs, getImageWithBlobURL } from 'store/blobs'
import { db } from 'utils/db'
import { getLocale } from 'i18n'
import { parseEpub } from 'utils/epub-parser'
import { getModePageSize } from 'utils/page-size'
import { getSpreadPairs } from 'utils/page-layout'
import { restoreWorkspaceFromDB, initWorkspaceAutoSave } from 'services/workspace-persistence'
import { EpubBuilder } from 'services/epub-builder'


class Store {
  ui: Ui
  book: Book
  contents: Contents
  blobs: Blobs
  undoStore: UndoStore
  isAutoSaveActive = false

  // blob UUIDs already persisted to IndexedDB (not part of reactive state)
  savedBlobIDs: Set<string> = new Set()

  constructor() {
    this.ui = new Ui()
    this.book = new Book()
    this.contents = new Contents()
    this.blobs = storeBlobs
    this.undoStore = new UndoStore()

    makeAutoObservable(this)

    try {
      const bookSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_BOOK') || '[]')
      const contentSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_CONTENTS') || '[]')

      this.book.savedSets = bookSets
      this.contents.savedSets = contentSets
    } catch {
      // do nothing
    }
  }

  saveUndoSnapshot(removedBlobs: Record<string, StoreBlobs.ImageBlob> = {}, createdBlobIDs: string[] = []) {
    this.undoStore.saveRecord({
      pages: toJS(this.book.pages),
      contentsList: toJS(this.contents.list),
      pageSize: [...this.book.pageSize] as [number, number],
      pageSizeMode: this.book.pageSizeMode,
      selectedPageIndex: this.ui.selectedPageIndex,
      removedBlobs,
      createdBlobIDs,
    })
  }

  resetWorkspace = () => {
    this.book.reset()
    this.contents.reset()
    this.blobs.clear()
    this.ui.selectPageIndex(null)
    this.ui.firstImport = true
    this.ui.fileName = ''
    this.ui.modalBookVisible = false
    this.ui.modalContentVisible = false
    this.ui.modalPageVisible = false
    this.undoStore.clearRecord()
    this.savedBlobIDs.clear()
    db.clearAll().catch(err => console.error('Failed to clear backup:', err))
  }

  setAutoSaveActive = (value: boolean) => {
    this.isAutoSaveActive = value
  }

  get modePageSize(): [number, number] {
    return getModePageSize(this.book.pages, this.blobs.blobs, this.book.pageSize)
  }

  get displayPageSize(): [number, number] {
    return this.book.pageSizeMode === 'auto' ? this.modePageSize : this.book.pageSize
  }

  restoreWorkspace = async () => {
    await restoreWorkspaceFromDB(this)
  }

  async importPageFromImages(fileList: File[]) {
    if (fileList.length === 0) return

    this.setAutoSaveActive(true)
    this.ui.setLoading(true, getLocale(this.ui.lang).loading.importingImages)
    try {
      const uuids = fileList.map(() => uuid())
      // decode first, then create pages only for images that succeeded,
      // so a failed decode can never leave a page without its blob
      const result = await this.blobs.push(fileList, uuids)

      if (result.succeededIDs.length > 0) {
        this.book.pushNewPage(result.succeededIDs)
      }
      if (result.failedCount > 0) {
        this.ui.showToast(getLocale(this.ui.lang).alert.importImagesFailed(result.failedCount), 'warning')
      }
    } finally {
      this.ui.setLoading(false)
    }
  }

  async importFromEpub(file: File) {
    this.ui.setLoading(true, getLocale(this.ui.lang).loading.importingEpub)
    try {
      const result = await parseEpub(file)

      this.resetWorkspace()

      // Import images (pages are created only for successfully decoded blobs)
      const uuids = result.images.map(() => uuid())
      const pushResult = await this.blobs.push(result.images, uuids)
      this.book.pushNewPage(pushResult.succeededIDs)
      if (pushResult.failedCount > 0) {
        this.ui.showToast(getLocale(this.ui.lang).alert.importImagesFailed(pushResult.failedCount), 'warning')
      }

      runInAction(() => {
        // Apply metadata
        const m = result.metadata
        this.book.bookTitle = m.bookTitle
        this.book.bookAuthors = m.bookAuthors.length > 0 ? m.bookAuthors : ['']
        this.book.bookSubject = m.bookSubject
        this.book.bookPublisher = m.bookPublisher
        this.book.bookLanguage = m.bookLanguage || 'ja'
        this.book.bookSeriesName = m.bookSeriesName
        this.book.bookSeriesVolume = m.bookSeriesVolume
        this.book.bookDescription = m.bookDescription
        this.book.bookDate = m.bookDate
        this.book.bookContributors = m.bookContributors
        this.book.bookISBN = m.bookISBN

        // Apply page settings
        const ps = result.pageSettings
        if (ps.pageSize) this.book.pageSize = ps.pageSize
        if (ps.pageShow) this.book.pageShow = ps.pageShow
        if (ps.pageDirection) this.book.pageDirection = ps.pageDirection

        // Apply TOC
        if (result.toc.length > 0) {
          const tocList = result.toc.map(item => ({
            pageIndex: item.pageIndex as number | null,
            title: item.title,
            level: item.level
          }))
          this.contents.updateList(tocList)
        }

        this.ui.firstImport = false
        this.setAutoSaveActive(true)
      })
    } catch (err) {
      console.error('Failed to import EPUB:', err)
      alert('Failed to import EPUB\n' + err)
    } finally {
      this.ui.setLoading(false)
    }
  }

  setBookmark(listIndex: number, pageIndex: number) {
    this.saveUndoSnapshot()
    this.contents.setPageIndexToTitle(listIndex, pageIndex)
  }

  useImageSizeToPage(pageIndex: number) {
    const pageItem = this.book.pages[pageIndex]
    if (!pageItem) return
    const blobItem = this.blobs.blobs[pageItem.blobID]
    if (blobItem) {
      this.saveUndoSnapshot()
      this.book.updateBookPageProperty('pageSize', [
        blobItem.width,
        blobItem.height
      ])
    }
  }

  async splitPage(index: number) {
    const pageItem = this.book.pages[index]
    if (!pageItem || pageItem.blank || !pageItem.blobID) return
    const blobItem = this.blobs.blobs[pageItem.blobID]
    if (!blobItem) return

    try {
      const uuids = [uuid(), uuid()]
      const mime = blobItem.blob.type

      const originImage = await getImageWithBlobURL(blobItem.blobURL)
      const w1 = originImage.width >> 1
      const w2 = originImage.width - w1

      const canvas1 = document.createElement('canvas')
      const canvas2 = document.createElement('canvas')

      canvas1.width = w1
      canvas1.height = originImage.height

      canvas2.width = w2
      canvas2.height = originImage.height

      const ctx1 = canvas1.getContext('2d')
      const ctx2 = canvas2.getContext('2d')

      ctx1?.drawImage(originImage, 0, 0)
      ctx2?.drawImage(originImage, 0 - w1, 0)

      const blobs = await Promise.all([
        new Promise<Blob>((resolve, reject) =>
          canvas1.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
            mime, 1
          )
        ),
        new Promise<Blob>((resolve, reject) =>
          canvas2.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
            mime, 1
          )
        ),
      ])

      // push the two halves first; mutate pages only when both succeeded
      const pushResult = await this.blobs.push(blobs, this.book.pageDirection === 'left' ? uuids : [...uuids].reverse())
      if (pushResult.failedCount > 0) {
        pushResult.succeededIDs.forEach(id => this.blobs.remove(id))
        this.ui.showToast(getLocale(this.ui.lang).alert.splitFailed, 'error')
        return
      }

      const removedBlobs: Record<string, StoreBlobs.ImageBlob> = {
        [pageItem.blobID]: blobItem
      }
      this.saveUndoSnapshot(removedBlobs, uuids)

      this.book.splitPage(index, uuids)
      this.book.updatePageItemIndex()
      this.blobs.remove(pageItem.blobID)

      this.contents.shiftPageIndices(index, 1)
    } catch (err) {
      console.error('Failed to split page:', err)
      this.ui.showToast(getLocale(this.ui.lang).alert.splitFailed, 'error')
    }
  }

  async undo() {
    await this.undoStore.restore(this)
  }

  insertBlankPage(index: number) {
    this.saveUndoSnapshot()
    this.book.insertBlankPage(index)
    this.book.updatePageItemIndex()

    const selectedPageIndex = this.ui.selectedPageIndex
    if (selectedPageIndex !== null && (selectedPageIndex >= index)) {
      this.ui.selectPageIndex(selectedPageIndex + 1)
    }

    this.contents.shiftPageIndices(index, 1)
  }

  removePage(index: number) {
    const pageItem = this.book.pages[index]
    const removedBlobs: Record<string, StoreBlobs.ImageBlob> = {}
    if (pageItem && !pageItem.blank && pageItem.blobID) {
      const blobItem = this.blobs.blobs[pageItem.blobID]
      if (blobItem) {
        removedBlobs[pageItem.blobID] = blobItem
      }
    }
    this.saveUndoSnapshot(removedBlobs)

    if (pageItem && !pageItem.blank && pageItem.blobID) {
      this.blobs.remove(pageItem.blobID)
    }
    this.book.removePage(index)
    this.book.updatePageItemIndex()
    this.ui.selectPageIndex(null)

    this.contents.onPageRemoved(index)
  }

  movePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.book.pages.length) return
    const targetIndex = Math.max(0, Math.min(toIndex, this.book.pages.length - 1))

    this.saveUndoSnapshot()
    this.book.movePage(fromIndex, targetIndex)

    const selected = this.ui.selectedPageIndex
    if (selected !== null) {
      if (selected === fromIndex) {
        this.ui.selectPageIndex(targetIndex)
      } else if (fromIndex < selected && targetIndex >= selected) {
        this.ui.selectPageIndex(selected - 1)
      } else if (fromIndex > selected && targetIndex <= selected) {
        this.ui.selectPageIndex(selected + 1)
      }
    }

    this.contents.onPageMoved(fromIndex, targetIndex)
  }

  async generateBook() {
    this.ui.setLoading(true, getLocale(this.ui.lang).loading.generating)
    try {
      await this.buildAndDownloadBook()
    } catch (err) {
      console.error('Failed to generate EPUB:', err)
      alert('Failed to generate EPUB\n' + err)
    } finally {
      this.ui.setLoading(false)
    }
  }

  private async buildAndDownloadBook() {
    await EpubBuilder.buildAndDownload({
      bookID: this.book.bookID,
      bookTitle: this.book.bookTitle,
      bookAuthors: toJS(this.book.bookAuthors),
      bookSubject: this.book.bookSubject,
      bookPublisher: this.book.bookPublisher,
      bookLanguage: this.book.bookLanguage,
      bookSeriesName: this.book.bookSeriesName,
      bookSeriesVolume: this.book.bookSeriesVolume,
      bookDescription: this.book.bookDescription,
      bookDate: this.book.bookDate,
      bookContributors: toJS(this.book.bookContributors),
      bookISBN: this.book.bookISBN,
      pageSize: toJS(this.book.pageSize),
      pageSizeMode: this.book.pageSizeMode,
      pageFit: this.book.pageFit,
      pageDirection: this.book.pageDirection,
      coverPosition: this.book.coverPosition,
      imgTag: this.book.imgTag,
      pages: toJS(this.book.pages),
      // pageShow is a preview-only setting; exported spreads are always
      // computed in two-page mode so the EPUB is independent of the UI state
      spreadPairs: getSpreadPairs(toJS(this.book.pages), this.book.coverPosition, 'two'),
      contents: toJS(this.contents.list),
      blobs: this.blobs.blobs
    })
  }
}

const store = new Store()

autorun(() => {
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_BOOK', JSON.stringify(toJS(store.book.savedSets)))
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_CONTENTS', JSON.stringify(toJS(store.contents.savedSets)))
})

// keep the default TOC cover title in sync with the UI language
reaction(
  () => store.ui.lang,
  (lang) => store.contents.setDefaultCoverTitle(getLocale(lang).contents.tocCover),
  { fireImmediately: true }
)

// ---- workspace auto-save (IndexedDB) ----
initWorkspaceAutoSave(store)

export const StoreContext = React.createContext(store);
export const useStore = () => React.useContext(StoreContext);
export type StoreMain = Store;
export default store;
