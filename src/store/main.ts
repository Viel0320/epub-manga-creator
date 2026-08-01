import React from 'react';
import { autorun, makeAutoObservable, runInAction, toJS } from "mobx"
import uuid from 'utils/get-uuid'
import Book, { StoreBook } from 'store/book'
import Ui from 'store/ui'
import Contents from 'store/contents'
import storeBlobs, { Store as Blobs, StoreBlobs } from 'store/blobs'
import { db } from 'utils/db'
import { getLocale } from 'i18n'
import JSZip from "jszip"
import { getPageLayoutInfo, getSpreadPairs } from 'utils/page-layout'
import { parseEpub } from 'utils/epub-parser'
import { getModePageSize, getPageEffectiveSize } from 'utils/page-size'

import getTemplateContainerXml from 'template/container.xml'
import getTemplatePageXhtml from 'template/page.xhtml'
import getTemplatePageImgXhtml from 'template/page_img.xhtml'
import getTemplateFixedLayoutJpCss from 'template/fixed-layout-jp.css'
import getTemplateStandardOpf from 'template/standard.opf'
import getTemplateNavigationDocumentsXhtml from 'template/navigation-documents.xhtml'

const htmlToEscape = (str: string): string => {
  // strip control chars that are invalid in XML 1.0 even when escaped
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  const reg = /"|&|'|<|>|\\|[\x80-\xFF]|[\u0100-\u2700]/g

  return cleaned.replace(reg, ($0) => '&#' + $0.charCodeAt(0) + ';')
}

// Safe template interpolation: a plain-string replacement would interpret
// `$&`, `$'` etc. in user content as special replacement patterns.
const fillTemplate = (template: string, pattern: string | RegExp, value: string): string =>
  template.replace(pattern, () => value)

const getNumberStr = (num: number, zeroCount: number): string => {
  let str = String(num)
  let i = zeroCount - str.length
  while (i-- > 0) {
    str = '0' + str
  }
  return str
}

export interface SplitRecord {
  originalIndex: number
  originalPageItem: StoreBook.PageItem
  originalBlobItem: StoreBlobs.ImageBlob
  newBlobIDs: string[]
  originalContentsList: any[]
}

class Store {
  ui: Ui
  book: Book
  contents: Contents
  blobs: Blobs
  isAutoSaveActive = false
  lastSplitRecord: SplitRecord | null = null

  // blob UUIDs already persisted to IndexedDB (not part of reactive state)
  savedBlobIDs: Set<string> = new Set()

  constructor() {
    this.ui = new Ui()
    this.book = new Book()
    this.contents = new Contents()
    this.blobs = storeBlobs

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

  resetWorkspace() {
    this.book.reset()
    this.contents.reset()
    this.blobs.clear()
    this.ui.selectPageIndex(null)
    this.ui.firstImport = true
    this.ui.fileName = ''
    this.ui.modalBookVisible = false
    this.ui.modalContentVisible = false
    this.ui.modalPageVisible = false
    this.lastSplitRecord = null
    this.savedBlobIDs.clear()
    db.clearAll().catch(err => console.error('Failed to clear backup:', err))
  }

  setAutoSaveActive(value: boolean) {
    this.isAutoSaveActive = value
  }

  get modePageSize(): [number, number] {
    return getModePageSize(this.book.pages, this.blobs.blobs, this.book.pageSize)
  }

  get displayPageSize(): [number, number] {
    return this.book.pageSizeMode === 'auto' ? this.modePageSize : this.book.pageSize
  }

  async restoreWorkspace() {
    const backup = await db.getMetadata('active_book')
    if (!backup || !Array.isArray(backup.pages) || backup.pages.length === 0) {
      return
    }

    const blobIDs: string[] = []
    const blobList: Blob[] = []

    for (const page of backup.pages as StoreBook.PageItem[]) {
      if (page.blank || !page.blobID) {
        continue
      }
      const blob = await db.getBlob(page.blobID)
      if (blob) {
        blobIDs.push(page.blobID)
        blobList.push(blob)
      }
    }

    await this.blobs.push(blobList, blobIDs)

    runInAction(() => {
      const available = new Set(blobIDs)
      this.book.pages = (backup.pages as StoreBook.PageItem[])
        .filter(page => page.blank || available.has(page.blobID))
        .map((page, i) => ({ ...page, index: i }))

      if (backup.bookInfo) {
        this.book.bookID = backup.bookInfo.bookID || this.book.bookID
        this.book.bookTitle = backup.bookInfo.bookTitle || ''
        this.book.bookAuthors = backup.bookInfo.bookAuthors?.length ? backup.bookInfo.bookAuthors : ['']
        this.book.bookSubject = backup.bookInfo.bookSubject || ''
        this.book.bookPublisher = backup.bookInfo.bookPublisher || ''
        this.book.bookLanguage = (backup.bookInfo as any).bookLanguage || 'ja'
        this.book.bookSeriesName = (backup.bookInfo as any).bookSeriesName || ''
        this.book.bookSeriesVolume = (backup.bookInfo as any).bookSeriesVolume || ''
        this.book.bookDescription = (backup.bookInfo as any).bookDescription || ''
        this.book.bookDate = (backup.bookInfo as any).bookDate || ''
        this.book.bookContributors = Array.isArray((backup.bookInfo as any).bookContributors) ? (backup.bookInfo as any).bookContributors : []
        this.book.bookISBN = (backup.bookInfo as any).bookISBN || ''
      }

      if (backup.pageSettings) {
        const s = backup.pageSettings
        if (Array.isArray(s.pageSize)) this.book.pageSize = s.pageSize
        if (s.pagePosition) this.book.pagePosition = s.pagePosition
        if (s.pageShow) this.book.pageShow = s.pageShow
        if (s.pageFit) this.book.pageFit = s.pageFit
        if (s.pageBackgroundColor) this.book.pageBackgroundColor = s.pageBackgroundColor
        if (s.pageDirection) this.book.pageDirection = s.pageDirection
        if (s.coverPosition) this.book.coverPosition = s.coverPosition
        if (s.imgTag) this.book.imgTag = s.imgTag
      }

      if (backup.contents && Array.isArray(backup.contents.list)) {
        this.contents.updateList(backup.contents.list)
      }

      this.ui.firstImport = false
      blobIDs.forEach(id => this.savedBlobIDs.add(id))
    })
  }

  importPageFromImages(fileList: File[]) {
    const uuids = fileList.map(() => uuid())

    this.book.pushNewPage(uuids)
    this.blobs.push(fileList, uuids)
  }

  async importFromEpub(file: File) {
    this.ui.setLoading(true, getLocale(this.ui.lang).loading.importingEpub)
    try {
      const result = await parseEpub(file)

      this.resetWorkspace()

      // Import images
      const uuids = result.images.map(() => uuid())
      this.book.pushNewPage(uuids)
      await this.blobs.push(result.images, uuids)

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
      })
    } catch (err) {
      console.error('Failed to import EPUB:', err)
      alert('Failed to import EPUB\n' + err)
    } finally {
      this.ui.setLoading(false)
    }
  }

  replacePageIndex(index: number, targetIndex: number) {
    this.book.switchIndex(index, index > targetIndex ? targetIndex : targetIndex + 1)
    this.ui.selectPageIndex(targetIndex)

    const newIndexMap: Contents['indexMap'] = {}
    const list = toJS(this.contents.list)

    this.book.pages.forEach((pageItem, index) => {
      if (pageItem.index in this.contents.indexMap) {
        const listIndex = this.contents.indexMap[pageItem.index]
        newIndexMap[index] = listIndex
        list[listIndex].pageIndex = index
      }
    })

    this.contents.updateList(list)
    this.book.updatePageItemIndex()
  }

  async splitPage(index: number) {
    const pageItem = this.book.pages[index]
    const blobItem = this.blobs.blobs[pageItem.blobID]
    if (!pageItem || !blobItem) return

    const uuids = [uuid(), uuid()]
    const mime = blobItem.blob.type

    const w1 = blobItem.originImage.width >> 1
    const w2 = blobItem.originImage.width - w1

    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')

    canvas1.width = w1
    canvas1.height = blobItem.originImage.height

    canvas2.width = w2
    canvas2.height = blobItem.originImage.height

    const ctx1 = canvas1.getContext('2d')
    const ctx2 = canvas2.getContext('2d')

    ctx1?.drawImage(blobItem.originImage, 0, 0)
    ctx2?.drawImage(blobItem.originImage, 0 - w1, 0)

    const blobs = await Promise.all([
      new Promise<Blob>((resolve, reject) =>
        canvas1.toBlob(
          (blob) => blob ? resolve(blob) : reject(),
          mime, 1
        )
      ),
      new Promise<Blob>((resolve, reject) =>
        canvas2.toBlob(
          (blob) => blob ? resolve(blob) : reject(),
          mime, 1
        )
      ),
    ])

    const originalPageItem = toJS(pageItem)
    const originalBlobItem = blobItem
    const originalContentsList = toJS(this.contents.list)

    this.book.splitPage(index, uuids)
    this.book.updatePageItemIndex()
    this.blobs.push(blobs, this.book.pageDirection === 'left' ? uuids : [...uuids].reverse())
    this.blobs.remove(pageItem.blobID)

    const list = toJS(this.contents.list)
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex++
      }
    })

    this.contents.updateList(list)

    runInAction(() => {
      this.lastSplitRecord = {
        originalIndex: index,
        originalPageItem,
        originalBlobItem,
        newBlobIDs: uuids,
        originalContentsList,
      }
    })
  }

  undoLastSplit() {
    if (!this.lastSplitRecord) return

    const { originalIndex, originalPageItem, originalBlobItem, newBlobIDs, originalContentsList } = this.lastSplitRecord

    const idx1 = this.book.pages.findIndex(p => p.blobID === newBlobIDs[0])
    const idx2 = this.book.pages.findIndex(p => p.blobID === newBlobIDs[1])

    let targetIndex = originalIndex
    if (idx1 !== -1 && idx2 !== -1) {
      targetIndex = Math.min(idx1, idx2)
    }

    this.blobs.remove(newBlobIDs[0])
    this.blobs.remove(newBlobIDs[1])
    this.blobs.blobs[originalPageItem.blobID] = originalBlobItem

    this.book.pages = this.book.pages.filter(p => !newBlobIDs.includes(p.blobID))
    this.book.pages.splice(targetIndex, 0, originalPageItem)
    this.book.updatePageItemIndex()

    this.contents.updateList(originalContentsList)
    this.ui.selectPageIndex(targetIndex)
    this.lastSplitRecord = null
  }

  insertBlankPage(index: number) {
    this.book.insertBlankPage(index)
    this.book.updatePageItemIndex()

    const selectedPageIndex = this.ui.selectedPageIndex
    if (selectedPageIndex !== null && (selectedPageIndex >= index)) {
      this.ui.selectPageIndex(selectedPageIndex + 1)
    }

    const list = toJS(this.contents.list)
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex++
      }
    })

    this.contents.updateList(list)
  }

  removePage(index: number) {
    const pageItem = this.book.pages[index]
    if (pageItem && !pageItem.blank && pageItem.blobID) {
      this.blobs.remove(pageItem.blobID)
    }
    this.book.removePage(index)
    this.book.updatePageItemIndex()
    this.ui.selectPageIndex(null)

    const list = toJS(this.contents.list)
    list.forEach((contentItem) => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex === index) {
        contentItem.pageIndex = null
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex--
      }
    })

    this.contents.updateList(list)
  }

  movePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.book.pages.length) return
    const targetIndex = Math.max(0, Math.min(toIndex, this.book.pages.length - 1))

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

    const list = toJS(this.contents.list)
    let updated = false
    list.forEach((contentItem) => {
      if (contentItem.pageIndex === null) return
      let idx = contentItem.pageIndex
      if (idx === fromIndex) {
        idx = targetIndex
        updated = true
      } else if (fromIndex < idx && targetIndex >= idx) {
        idx -= 1
        updated = true
      } else if (fromIndex > idx && targetIndex <= idx) {
        idx += 1
        updated = true
      }
      contentItem.pageIndex = idx
    })

    if (updated) {
      this.contents.updateList(list)
    }
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
    let templateContainerXml = getTemplateContainerXml()
    let templatePageXhtml = getTemplatePageXhtml()
    let templatePageImgXhtml = getTemplatePageImgXhtml()
    let templateFixedLayoutJpCss = getTemplateFixedLayoutJpCss()
    let templateStandardOpf = getTemplateStandardOpf()
    let templateNavigationDocumentsXhtml = getTemplateNavigationDocumentsXhtml()

    const coverAlone = this.book.coverPosition === 'alone'
    const Zip = new JSZip()

    // The EPUB spec requires `mimetype` to be the FIRST entry in the archive,
    // stored without compression.
    Zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

    // In "alone" mode the cover is not part of the reading order, so content
    // page indices are shifted by one relative to book.pages.
    templateNavigationDocumentsXhtml = fillTemplate(
      templateNavigationDocumentsXhtml,
      '{{startPage}}',
      coverAlone ? 'p_0000.xhtml' : 'p_cover.xhtml'
    )

    // Build nested TOC HTML from contents list with level support
    const tocItems = this.contents.list.filter(item => item.pageIndex !== null)
      .sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0))

    const buildNestedTocHtml = (): string => {
      if (tocItems.length === 0) return ''

      const lines: string[] = []
      let currentLevel = 0

      for (const item of tocItems) {
        const level = item.level || 0
        const pageIndex = item.pageIndex!
        const title = htmlToEscape(item.title)

        let href: string
        if (!coverAlone && pageIndex === 0) {
          href = 'text/p_cover.xhtml'
        } else {
          href = `text/p_${getNumberStr(coverAlone ? pageIndex : pageIndex - 1, 4)}.xhtml`
        }

        while (currentLevel < level) {
          lines.push('<ol>')
          currentLevel++
        }
        while (currentLevel > level) {
          lines.push('</ol></li>')
          currentLevel--
        }

        lines.push(`<li><a href="${href}">${title}</a>`)
        if (level === currentLevel) {
          // Check if next item is deeper; if not, close <li>
          const idx = tocItems.indexOf(item)
          const nextItem = tocItems[idx + 1]
          if (!nextItem || (nextItem.level || 0) <= level) {
            lines.push('</li>')
          }
        }
      }

      while (currentLevel > 0) {
        lines.push('</ol></li>')
        currentLevel--
      }

      return lines.join('\n')
    }

    templateNavigationDocumentsXhtml = fillTemplate(
      templateNavigationDocumentsXhtml,
      '<!-- navigation-list -->',
      buildNestedTocHtml()
    )

    let imageItemStr: string[] = []
    let pageItemStr: string[] = []
    let itemRefStr: string[] = []
    let spread = this.book.coverPosition === 'first-page'
      ? this.book.pageDirection
      : this.book.pageDirection === 'left'
        ? 'right'
        : 'left'

    const refPairs = getSpreadPairs(this.book.pages, this.book.coverPosition)
    const layoutPairs = getSpreadPairs(this.book.pages, this.book.coverPosition, this.book.pageShow)
    const refPairMap = new Map<number, boolean | undefined>()
    for (const pair of refPairs) {
      if (pair.length === 1) { refPairMap.set(pair[0], undefined) }
      else { refPairMap.set(pair[0], true); refPairMap.set(pair[1], false) }
    }
    const layoutPairMap = new Map<number, boolean | undefined>()
    for (const pair of layoutPairs) {
      if (pair.length === 1) { layoutPairMap.set(pair[0], undefined) }
      else { layoutPairMap.set(pair[0], true); layoutPairMap.set(pair[1], false) }
    }

    this.book.pages.forEach((pageItem, i) => {
      const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
      const imageFileName = (i === 0 ? '' : 'i_') + numStr

      if (pageItem.blank) {
        pageItemStr.push(`<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg"></item>`)
      } else {
        const mimeType = this.blobs.blobs[pageItem.blobID].blob.type // image/xxxxx
        pageItemStr.push(`<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg" fallback="${imageFileName}"></item>`)
        imageItemStr.push(`<item id="${imageFileName}" href="image/${imageFileName}.${mimeType.slice(6)}" media-type="${mimeType}"${i === 0 ? ' properties="cover-image"' : ''}></item>`)
      }

      if (i !== 0) {
        const refFirst = refPairMap.get(i)
        const isSinglePage = refFirst === undefined
        const layout = getPageLayoutInfo({
          pageIndex: i,
          coverPosition: this.book.coverPosition,
          pageDirection: this.book.pageDirection,
          pagePositionSetting: this.book.pagePosition,
          pageFitSetting: this.book.pageFit,
          customSpread: pageItem.customSpread,
          isFirstInPair: refFirst,
          isSingle: isSinglePage
        })
        const spreadDir = isSinglePage ? 'center' : layout.spread
        itemRefStr.push(`<itemref linear="yes" idref="p_${numStr}" properties="page-spread-${spreadDir}"></itemref>`)
      }
    })

    if (coverAlone) {
      // The cover xhtml is neither in the manifest nor written to the archive;
      // only the cover image itself (properties="cover-image") is kept.
      pageItemStr.splice(0, 1)
    } else { // this.book.coverPosition === 'first-page'
      itemRefStr.unshift(`<itemref linear="yes" idref="p_cover" properties="rendition:page-spread-center"></itemref>`)
    }

    const modeSize = getModePageSize(this.book.pages, this.blobs.blobs, this.book.pageSize)
    const opfPageSize = this.book.pageSizeMode === 'auto' ? modeSize : this.book.pageSize
    const opfWidth = opfPageSize[0] + ''
    const opfHeight = opfPageSize[1] + ''
    const fitMode = this.book.pageFit
    const bookTitle = htmlToEscape(this.book.bookTitle.trim())

    if (this.book.imgTag === 'svg') {
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
        const blobItem = pageItem.blank ? null : this.blobs.blobs[pageItem.blobID]
        const effSize = getPageEffectiveSize(pageItem, blobItem, this.book.pageSizeMode, this.book.pageSize, modeSize)
        const pageViewPortWidth = effSize[0] + ''
        const pageViewPortHeight = effSize[1] + ''

        if (pageItem.blank) {
          if (i === 0 && coverAlone) {
            return
          }
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
              .replace('{{image}}', '')
          )
          return
        }

        const blob = this.blobs.blobs[pageItem.blobID].blob
        const ext = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

        Zip.file(`OEBPS/image/${imageFileName}`, blob)

        if (i === 0 && coverAlone) {
          // standalone cover: image only, no xhtml page
          return
        }

        const layoutFirst = layoutPairMap.get(i)
        const layout = getPageLayoutInfo({
          pageIndex: i,
          coverPosition: this.book.coverPosition,
          pageDirection: this.book.pageDirection,
          pagePositionSetting: this.book.pagePosition,
          pageFitSetting: this.book.pageFit,
          customSpread: pageItem.customSpread,
          isFirstInPair: layoutFirst,
          isSingle: layoutFirst === undefined
        })

        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
            .replace('{{image}}', `<image width="100%" height="100%" preserveAspectRatio="${layout.par}" xlink:href="../image/${imageFileName}" />`)
        )
      })
    } else { // this.book.imgTag === 'img'
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
        const blobItem = pageItem.blank ? null : this.blobs.blobs[pageItem.blobID]
        const effSize = getPageEffectiveSize(pageItem, blobItem, this.book.pageSizeMode, this.book.pageSize, modeSize)
        const pageViewPortWidth = effSize[0] + ''
        const pageViewPortHeight = effSize[1] + ''

        if (pageItem.blank) {
          if (i === 0 && coverAlone) {
            return
          }
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
              .replace(`<img src="{{imageSource}}" style="{{style}}"/>`, '<div style="width:100%;height:100%;"></div>')
          )
          return
        }

        const blob = this.blobs.blobs[pageItem.blobID].blob
        const ext = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

        Zip.file(`OEBPS/image/${imageFileName}`, blob)

        if (i === 0 && coverAlone) {
          // standalone cover: image only, no xhtml page
          return
        }

        const layoutFirst2 = layoutPairMap.get(i)
        const layout = getPageLayoutInfo({
          pageIndex: i,
          coverPosition: this.book.coverPosition,
          pageDirection: this.book.pageDirection,
          pagePositionSetting: this.book.pagePosition,
          pageFitSetting: this.book.pageFit,
          customSpread: pageItem.customSpread,
          isFirstInPair: layoutFirst2,
          isSingle: layoutFirst2 === undefined
        })

        let imgStyle = 'object-fit:fill'
        if (fitMode !== 'stretch') {
          imgStyle = `object-position:${layout.objectPosition};`

          if (fitMode === 'fit') {
            imgStyle += 'object-fit:contain'
          } else { // props.imageFit === 'fill'
            imgStyle += 'object-fit:cover'
          }
        }

        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), pageViewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), pageViewPortHeight)
            .replace('{{imageSource}}', `../image/${imageFileName}`)
            .replace('{{style}}', imgStyle)
        )
      })
    }

    let authorsStr = this.book.bookAuthors.map((name, i) => {
      return [
        `<dc:creator id="creator${i + 1}">${htmlToEscape(name)}</dc:creator>`,
        `<meta refines="#creator${i + 1}" property="role" scheme="marc:relators">aut</meta>`,
        `<meta refines="#creator${i + 1}" property="file-as"></meta>`,
        `<meta refines="#creator${i + 1}" property="display-seq">${i + 1}</meta>`
      ].join('\n')
    }).join('\n')

    let contributorsStr = (this.book.bookContributors || []).map((item, i) => {
      if (!item.name.trim()) return ''
      return [
        `<dc:contributor id="contrib${i + 1}">${htmlToEscape(item.name.trim())}</dc:contributor>`,
        `<meta refines="#contrib${i + 1}" property="role" scheme="marc:relators">${item.role}</meta>`
      ].join('\n')
    }).filter(Boolean).join('\n')

    let descriptionStr = this.book.bookDescription.trim()
      ? `<dc:description>${htmlToEscape(this.book.bookDescription.trim())}</dc:description>`
      : ''

    let dateStr = this.book.bookDate.trim()
      ? `<dc:date>${htmlToEscape(this.book.bookDate.trim())}</dc:date>`
      : ''

    let collectionStr = ''
    if (this.book.bookSeriesName.trim()) {
      collectionStr = [
        `<meta property="belongs-to-collection" id="c01">${htmlToEscape(this.book.bookSeriesName.trim())}</meta>`,
        `<meta refines="#c01" property="collection-type">series</meta>`,
        this.book.bookSeriesVolume.trim() ? `<meta refines="#c01" property="group-position">${htmlToEscape(this.book.bookSeriesVolume.trim())}</meta>` : ''
      ].filter(Boolean).join('\n')
    }

    let isbnStr = this.book.bookISBN.trim()
      ? `<dc:identifier id="isbn-id">urn:isbn:${htmlToEscape(this.book.bookISBN.trim())}</dc:identifier>`
      : ''

    const primaryWritingMode = this.book.pageDirection === 'right' ? 'horizontal-rl' : 'horizontal-lr'

    templateStandardOpf = templateStandardOpf
      .replace('{{uuid}}', () => htmlToEscape(this.book.bookID))
      .replace('<!-- isbn -->', () => isbnStr)
      .replace('{{title}}', () => bookTitle)
      .replace('<!-- creator-list -->', () => authorsStr)
      .replace('{{subject}}', () => htmlToEscape(this.book.bookSubject))
      .replace('{{publisher}}', () => htmlToEscape(this.book.bookPublisher))
      .replace('{{language}}', () => htmlToEscape(this.book.bookLanguage || 'ja'))
      .replace('<!-- contributor-list -->', () => contributorsStr)
      .replace('<!-- description -->', () => descriptionStr)
      .replace('<!-- date -->', () => dateStr)
      .replace('<!-- collection-info -->', () => collectionStr)
      .replace('{{primaryWritingMode}}', primaryWritingMode)
      .replace('{{createTime}}', new Date().toISOString())
      .replace(new RegExp('{{width}}', 'gm'), opfWidth)
      .replace(new RegExp('{{height}}', 'gm'), opfHeight)
      .replace('<!-- item-image -->', () => imageItemStr.join('\n'))
      .replace('<!-- item-xhtml -->', () => pageItemStr.join('\n'))
      .replace('<!-- itemref-xhtml -->', () => itemRefStr.join('\n'))
      .replace('{{direction}}', this.book.pageDirection === 'right' ? ' page-progression-direction="rtl"' : '')

    Zip.file('META-INF/container.xml', templateContainerXml)
    Zip.file('OEBPS/style/fixed-layout-jp.css', templateFixedLayoutJpCss)
    Zip.file('OEBPS/navigation-documents.xhtml', templateNavigationDocumentsXhtml)
    Zip.file('OEBPS/standard.opf', templateStandardOpf)

    const blob = await Zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE' // per-file STORE option on `mimetype` still applies
    })

    const anchor = document.createElement('a')
    const objectURL = window.URL.createObjectURL(blob)
    anchor.download = (this.book.bookTitle.trim() || 'untitled') + '.epub'
    anchor.href = objectURL
    anchor.click()
    window.URL.revokeObjectURL(objectURL)
  }
}

const store = new Store()

autorun(() => {
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_BOOK', JSON.stringify(toJS(store.book.savedSets)))
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_CONTENTS', JSON.stringify(toJS(store.contents.savedSets)))
})

// ---- workspace auto-save (IndexedDB) ----

interface WorkspaceSnapshot {
  pages: StoreBook.PageItem[]
  bookInfo: StoreBook.BookInfoSet & { bookID: string }
  pageSettings: {
    pageSize: [number, number]
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

const syncWorkspaceToDB = async (snapshot: WorkspaceSnapshot) => {
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

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

autorun(() => {
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
  autoSaveTimer = setTimeout(() => syncWorkspaceToDB(snapshot), 800)
})

export const StoreContext = React.createContext(store);
export const useStore = () => React.useContext(StoreContext);
export default store;
