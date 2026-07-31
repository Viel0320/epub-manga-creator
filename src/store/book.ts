import { makeAutoObservable, toJS } from "mobx"
import uuid from 'utils/get-uuid'

export declare namespace StoreBook {
  export type CustomSpreadType = 'center' | 'bind-prev' | 'bind-next' | 'auto'

  export interface PageItem {
    index: number,
    blobID: string
    sticky: 'auto' | 'left' | 'right',
    blank: boolean
    customSpread?: CustomSpreadType
  }

  export interface ContributorItem {
    name: string
    role: 'ill' | 'trl' | 'edt'
  }

  export interface BookInfoSet {
    bookTitle: string
    bookAuthors: string[]
    bookSubject: string
    bookPublisher: string
    bookLanguage?: string
    bookSeriesName?: string
    bookSeriesVolume?: string
    bookDescription?: string
    bookDate?: string
    bookContributors?: ContributorItem[]
    bookISBN?: string
  }
}

type BookPageProperty = 'bookID' | 'bookISBN' | 'bookTitle' | 'bookAuthors' | 'bookSubject' | 'bookPublisher' | 'bookLanguage' | 'bookSeriesName' | 'bookSeriesVolume' | 'bookDescription' | 'bookDate' | 'bookContributors' | 'pageSize' | 'pageSizeMode' | 'pagePosition' | 'pageShow' | 'pageFit' | 'pageBackgroundColor' | 'pageDirection' | 'coverPosition' | 'imgTag'

class Store {
  bookID: string = uuid()
  bookISBN: string = ''
  bookTitle: string = ''
  bookAuthors: string[] = ['']
  bookSubject: string = ''
  bookPublisher: string = ''
  bookLanguage: string = 'ja'
  bookSeriesName: string = ''
  bookSeriesVolume: string = ''
  bookDescription: string = ''
  bookDate: string = ''
  bookContributors: StoreBook.ContributorItem[] = []

  pageSize: [number, number] = [250, 353]
  pageSizeMode: ('manual' | 'auto') = 'auto'
  pagePosition: ('center' | 'between') = 'between'
  pageShow: ('two' | 'one') = 'two'
  pageFit: ('stretch' | 'fit' | 'fill') = 'stretch'
  pageBackgroundColor: ('white' | 'black') = 'white'
  pageDirection: ('right' | 'left') = 'right'
  coverPosition: ('first-page' | 'alone') = 'first-page'
  imgTag: ('svg' | 'img') = 'svg'

  pages: StoreBook.PageItem[] = []
  savedSets: StoreBook.BookInfoSet[] = []

  constructor() {
    makeAutoObservable(this)
  }

  pushNewPage(blobUUIDs: string[]) {
    const newPages: StoreBook.PageItem[] = blobUUIDs.map((uuid, index) => ({
      index,
      blobID: uuid,
      sticky: 'auto',
      blank: false
    }))
    this.pages.push(...newPages);
  }

  splitPage(index: number, blobUUIDs: string[]) {
    const newPageItem1: StoreBook.PageItem = {
      index,
      blobID: blobUUIDs[0],
      sticky: 'auto',
      blank: false
    }
    const newPageItem2: StoreBook.PageItem = {
      index: -1,
      blobID: blobUUIDs[1],
      sticky: 'auto',
      blank: false
    }

    this.pages.splice(index, 1, newPageItem1, newPageItem2)
  }

  updateBookPageProperty<K extends BookPageProperty>(key: K, value: Store[K]) {
    (this as any)[key] = value
  }

  removePage(index: number) {
    this.pages.splice(index, 1)
  }

  switchIndex(index: number, targetIndex: number) {
    const pageItem = this.pages[index];
    if (pageItem) {
      this.pages.splice(index, 1);
      this.pages.splice(targetIndex, 0, pageItem);
    }
  }

  movePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.pages.length) return
    if (toIndex < 0 || toIndex >= this.pages.length) return

    const [movedPage] = this.pages.splice(fromIndex, 1)
    this.pages.splice(toIndex, 0, movedPage)
    this.updatePageItemIndex()
  }

  updatePageItemIndex() {
    this.pages.forEach((pageItem, i) => {
      pageItem.index = i;
    });
  }

  unbindSpread(index: number) {
    const page = this.pages[index]
    if (!page) return

    if (page.customSpread === 'bind-next') {
      const nextP = this.pages[index + 1]
      if (nextP && nextP.customSpread === 'bind-prev') {
        nextP.customSpread = 'auto'
      }
      page.customSpread = 'auto'
    } else if (page.customSpread === 'bind-prev') {
      const prevP = this.pages[index - 1]
      if (prevP && prevP.customSpread === 'bind-next') {
        prevP.customSpread = 'auto'
      }
      page.customSpread = 'auto'
    } else if (page.customSpread === 'center') {
      page.customSpread = 'auto'
    }
  }

  bindSpreadPair(indexA: number, indexB: number) {
    if (indexA < 0 || indexB >= this.pages.length || indexA >= indexB) return
    this.unbindSpread(indexA)
    this.unbindSpread(indexB)
    if (this.pages[indexA]) {
      this.pages[indexA].customSpread = 'bind-next'
    }
    if (this.pages[indexB]) {
      this.pages[indexB].customSpread = 'bind-prev'
    }
  }

  setSinglePage(index: number) {
    if (index < 0 || index >= this.pages.length) return
    this.unbindSpread(index)
    if (this.pages[index]) {
      this.pages[index].customSpread = 'center'
    }
  }

  setPageCustomSpread(index: number, mode: StoreBook.CustomSpreadType) {
    if (mode === 'center') {
      if (this.pages[index]?.customSpread === 'center') {
        this.unbindSpread(index)
      } else {
        this.setSinglePage(index)
      }
    } else if (mode === 'bind-prev') {
      if (this.pages[index]?.customSpread === 'bind-prev') {
        this.unbindSpread(index)
      } else {
        this.bindSpreadPair(index - 1, index)
      }
    } else if (mode === 'bind-next') {
      if (this.pages[index]?.customSpread === 'bind-next') {
        this.unbindSpread(index)
      } else {
        this.bindSpreadPair(index, index + 1)
      }
    } else {
      this.unbindSpread(index)
    }
  }

  togglePageCustomSpread(index: number) {
    this.setPageCustomSpread(index, 'center')
  }

  insertBlankPage(index: number) {
    const newPageItem: StoreBook.PageItem = {
      index: -1,
      blobID: '',
      sticky: 'auto',
      blank: true
    }

    if (index >= this.pages.length) {
      this.pages.push(newPageItem)
    } else {
      const currentIndex = index < 0 ? 0 : index
      this.pages.splice(currentIndex, 0, newPageItem)
    }
  }

  saveBookInfoToSet() {
    const newSet: StoreBook.BookInfoSet = {
      bookTitle: this.bookTitle,
      bookAuthors: toJS(this.bookAuthors),
      bookSubject: this.bookSubject,
      bookPublisher: this.bookPublisher,
      bookLanguage: this.bookLanguage,
      bookSeriesName: this.bookSeriesName,
      bookSeriesVolume: this.bookSeriesVolume,
      bookDescription: this.bookDescription,
      bookDate: this.bookDate,
      bookContributors: toJS(this.bookContributors),
      bookISBN: this.bookISBN,
    }

    this.savedSets.push(newSet)
  }

  removeBookInfoSet(index: number) {
    this.savedSets.splice(index, 1)
  }

  reset() {
    this.bookID = uuid()
    this.bookISBN = ''
    this.bookTitle = ''
    this.bookAuthors = ['']
    this.bookSubject = ''
    this.bookPublisher = ''
    this.bookLanguage = 'ja'
    this.bookSeriesName = ''
    this.bookSeriesVolume = ''
    this.bookDescription = ''
    this.bookDate = ''
    this.bookContributors = []
    this.pages = []
  }

  applySet(index: number) {
    const selectedSet = this.savedSets[index];
    if (selectedSet) {
      this.bookTitle = selectedSet.bookTitle
      this.bookAuthors = toJS(selectedSet.bookAuthors)
      this.bookSubject = selectedSet.bookSubject
      this.bookPublisher = selectedSet.bookPublisher
      this.bookLanguage = selectedSet.bookLanguage || 'ja'
      this.bookSeriesName = selectedSet.bookSeriesName || ''
      this.bookSeriesVolume = selectedSet.bookSeriesVolume || ''
      this.bookDescription = selectedSet.bookDescription || ''
      this.bookDate = selectedSet.bookDate || ''
      this.bookContributors = selectedSet.bookContributors ? toJS(selectedSet.bookContributors) : []
      this.bookISBN = selectedSet.bookISBN || ''
    }
  }
}

export default Store