import { CustomSpreadType } from 'utils/page-layout'

export interface EpubContributor {
  name: string
  role: 'ill' | 'trl' | 'edt' | string
}

export interface EpubPageItem {
  index: number
  blobID: string
  sticky: 'auto' | 'left' | 'right'
  blank: boolean
  customSpread?: CustomSpreadType
}

export interface EpubContentItem {
  pageIndex: number | null
  title: string
  level?: number
}

export interface EpubBlobItem {
  blob: Blob
}

export interface EpubBookData {
  bookID: string
  bookTitle: string
  bookAuthors: string[]
  bookSubject: string
  bookPublisher: string
  bookLanguage: string
  bookSeriesName: string
  bookSeriesVolume: string
  bookDescription: string
  bookDate: string
  bookContributors: EpubContributor[]
  bookISBN: string

  pageSize: [number, number]
  pageSizeMode: 'manual' | 'auto'
  pageFit: 'contain' | 'cover' | 'fill'
  pageDirection: 'right' | 'left'
  coverPosition: 'first-page' | 'alone'
  imgTag: 'svg' | 'img'

  pages: EpubPageItem[]
  spreadPairs: number[][]
  contents: EpubContentItem[]
  blobs: Record<string, EpubBlobItem>
}
