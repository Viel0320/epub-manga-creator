import { action, autorun, makeAutoObservable, observable, toJS, runInAction } from "mobx"
import { createContext, useContext } from 'react'
import uuid from 'utils/get-uuid'
import Book from 'store/book'
import Ui from 'store/ui'
import Contents from 'store/contents'
import storeBlobs, { Store as Blobs, getImageWithBlobURL } from 'store/blobs'
import JSZip from "jszip"
import { db } from 'utils/db'

import getTemplateContainerXml from 'template/container.xml'
import getTemplatePageXhtml from 'template/page.xhtml'
import getTemplatePageImgXhtml from 'template/page_img.xhtml'
import getTemplateFixedLayoutJpCss from 'template/fixed-layout-jp.css'
import getTemplateStandardOpf from 'template/standard.opf'
import getTemplateNavigationDocumentsXhtml from 'template/navigation-documents.xhtml'

const htmlToEscape = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  const reg = /"|&|'|\\!|<|>|[\x00-\x20]|[\x7F-\xFF]|[\u0100-\u2700]/g

  return str.replace(reg, ($0) => {
    let c: any = $0.charCodeAt(0)
    let r = ['&#']

    c = (c === 0x20) ? 0xA0 : c
    r.push(c)
    r.push(';')
    return r.join('')
  })
}

const getNumberStr = (num: number, zeroCount: number): string => {
  let str = String(num)
  let i = zeroCount - str.length
  while (i-- > 0) {
    str = '0' + str
  }
  return str
}

class Store {
  @observable ui: Ui
  @observable book: Book
  @observable contents: Contents
  @observable blobs: Blobs
  @observable isAutoSaveActive = false

  constructor() {
    this.ui = new Ui()
    this.book = new Book()
    this.contents = new Contents()
    this.blobs = storeBlobs

    makeAutoObservable(this)

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const bookSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_BOOK') || '[]')
        const contentSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_CONTENTS') || '[]')

        this.book.savedSets = bookSets
        this.contents.savedSets = contentSets
      } catch {
        // do nothing
      }
    }

    // Initialize DB and setup auto-save autorun
    db.init().then(() => {
      autorun(() => {
        if (typeof window !== 'undefined' && this.isAutoSaveActive) {
          if (this.book.pages.length === 0) {
            // Delete backups if pages list is empty
            db.saveMetadata('active_book', null).catch(err => console.error('Failed to clear backup book:', err))
            db.saveMetadata('active_contents', null).catch(err => console.error('Failed to clear backup contents:', err))
            return
          }

          const bookData = {
            bookID: this.book.bookID,
            bookTitle: this.book.bookTitle,
            bookAuthors: toJS(this.book.bookAuthors),
            bookSubject: this.book.bookSubject,
            bookPublisher: this.book.bookPublisher,
            pageSize: toJS(this.book.pageSize),
            pagePosition: this.book.pagePosition,
            pageShow: this.book.pageShow,
            pageFit: this.book.pageFit,
            pageBackgroundColor: this.book.pageBackgroundColor,
            pageDirection: this.book.pageDirection,
            coverPosition: this.book.coverPosition,
            imgTag: this.book.imgTag,
            pages: toJS(this.book.pages),
          }

          const contentsData = {
            list: toJS(this.contents.list),
            indexMap: toJS(this.contents.indexMap),
          }

          db.saveMetadata('active_book', bookData).catch(err => console.error('Failed to auto-save book:', err))
          db.saveMetadata('active_contents', contentsData).catch(err => console.error('Failed to auto-save contents:', err))
        }
      })
    }).catch(err => console.error('WorkspaceDB init failed:', err))
  }

  @action
  setAutoSaveActive(val: boolean) {
    this.isAutoSaveActive = val
  }

  @action
  importPageFromImages(fileList: File[]) {
    const uuids = fileList.map(() => uuid())

    this.book.pushNewPage(uuids)
    this.blobs.push(fileList, uuids, this.ui.lang)
    this.isAutoSaveActive = true
  }

  @action
  async restoreWorkspace() {
    try {
      this.ui.setLoading(true, this.ui.lang === 'zh' ? '正在还原项目...' : 'Restoring project...')
      const bookData = await db.getMetadata('active_book')
      const contentsData = await db.getMetadata('active_contents')

      if (!bookData || !bookData.pages || bookData.pages.length === 0) {
        this.ui.setLoading(false)
        return
      }

      // Restore blobs from DB first
      await Promise.all(
        bookData.pages.map(async (page: any) => {
          if (page.blank) return
          const blob = await db.getBlob(page.blobID)
          if (blob) {
            await this.blobs.restoreBlobItem(page.blobID, blob)
          }
        })
      )

      runInAction(() => {
        // Restore book metadata
        this.book.bookID = bookData.bookID
        this.book.bookTitle = bookData.bookTitle
        this.book.bookAuthors = bookData.bookAuthors
        this.book.bookSubject = bookData.bookSubject
        this.book.bookPublisher = bookData.bookPublisher
        this.book.pageSize = bookData.pageSize
        this.book.pagePosition = bookData.pagePosition
        this.book.pageShow = bookData.pageShow
        this.book.pageFit = bookData.pageFit
        this.book.pageBackgroundColor = bookData.pageBackgroundColor
        this.book.pageDirection = bookData.pageDirection
        this.book.coverPosition = bookData.coverPosition
        this.book.imgTag = bookData.imgTag
        this.book.pages = bookData.pages

        // Restore contents metadata
        if (contentsData) {
          this.contents.list = contentsData.list
          this.contents.indexMap = contentsData.indexMap
        }
      })
    } catch (err) {
      console.error('Failed to restore workspace:', err)
    } finally {
      this.ui.setLoading(false)
    }
  }

  @action
  async importPageFromEpub(file: File) {
    try {
      this.ui.setLoading(true, this.ui.lang === 'zh' ? '正在导入 EPUB...' : 'Importing EPUB...')
      
      const zip = await JSZip.loadAsync(file)
      
      // 1. Read container.xml to locate OPF path
      const containerFile = zip.file('META-INF/container.xml')
      if (!containerFile) throw new Error('Invalid EPUB: META-INF/container.xml not found.')
      const containerXml = await containerFile.async('string')
      
      const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] || 'OEBPS/standard.opf'
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
      
      const opfFile = zip.file(opfPath)
      if (!opfFile) throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`)
      const opfXml = await opfFile.async('string')
      
      // 2. Parse OPF using DOMParser
      const parser = new DOMParser()
      const doc = parser.parseFromString(opfXml, "text/xml")
      
      const getElementText = (tagName: string) => {
        const elements = doc.getElementsByTagName(tagName)
        if (elements.length > 0) return elements[0].textContent || ''
        const baseName = tagName.split(':').pop() || ''
        const elementsNS = doc.getElementsByTagNameNS('*', baseName)
        if (elementsNS.length > 0) return elementsNS[0].textContent || ''
        return ''
      }
      
      const bookTitle = getElementText('dc:title')
      const creators = Array.from(doc.getElementsByTagName('dc:creator')).map(el => el.textContent || '')
      const bookAuthors = creators.length > 0 ? creators : ['']
      const bookSubject = getElementText('dc:subject')
      const bookPublisher = getElementText('dc:publisher')
      const identifier = getElementText('dc:identifier')
      const bookID = identifier.replace(/^urn:uuid:/, '') || uuid()
      
      let pageSize: [number, number] = [250, 353]
      const metas = Array.from(doc.getElementsByTagName('meta'))
      const viewportMeta = metas.find(el => el.getAttribute('property') === 'fixed-layout-jp:viewport')
      if (viewportMeta) {
        const match = viewportMeta.textContent?.match(/width=(\d+),\s*height=(\d+)/)
        if (match) {
          pageSize = [+match[1], +match[2]]
        }
      } else {
        const resolutionMeta = metas.find(el => el.getAttribute('name') === 'original-resolution')
        if (resolutionMeta) {
          const match = resolutionMeta.getAttribute('content')?.match(/(\d+)x(\d+)/)
          if (match) {
            pageSize = [+match[1], +match[2]]
          }
        }
      }
      
      const spineEl = doc.getElementsByTagName('spine')[0]
      const pageDirection = spineEl?.getAttribute('page-progression-direction') === 'rtl' ? 'right' : 'left'
      
      const itemrefs = Array.from(doc.getElementsByTagName('itemref'))
      const coverRef = itemrefs.find(ref => ref.getAttribute('idref') === 'p_cover')
      const coverPosition = coverRef?.getAttribute('linear') === 'no' ? 'alone' : 'first-page'
      
      // Parse manifest items map
      const manifestMap: { [id: string]: { href: string; mediaType: string; properties: string } } = {}
      const items = Array.from(doc.getElementsByTagName('item'))
      items.forEach(item => {
        const id = item.getAttribute('id')
        const href = item.getAttribute('href')
        const mediaType = item.getAttribute('media-type')
        const properties = item.getAttribute('properties') || ''
        if (id && href && mediaType) {
          manifestMap[id] = { href, mediaType, properties }
        }
      })
      
      // Helper to resolve paths relative to OPF dir
      const getZipPath = (href: string) => {
        if (!opfDir) return href
        return opfDir + href
      }
      
      const resolveRelativePath = (basePath: string, relativePath: string) => {
        const parts = (basePath + '/' + relativePath).split('/')
        const stack: string[] = []
        for (const part of parts) {
          if (part === '.' || part === '') continue
          if (part === '..') {
            stack.pop()
          } else {
            stack.push(part)
          }
        }
        return stack.join('/')
      }
      
      // Reconstruct pages list based on spine order
      const spineItems = Array.from(doc.getElementsByTagName('itemref'))
      const spineIds = spineItems.map(ref => ref.getAttribute('idref') || '').filter(Boolean)
      
      // Clean up existing project before import
      await db.clearAll()
      
      const newPages: any[] = []
      const formatAndStorePromises: Promise<void>[] = []
      
      // Loop over spine items
      for (let i = 0; i < spineIds.length; i++) {
        const idref = spineIds[i]
        const manifestItem = manifestMap[idref]
        if (!manifestItem) continue
        
        const xhtmlZipPath = getZipPath(manifestItem.href)
        const xhtmlFile = zip.file(xhtmlZipPath)
        if (!xhtmlFile) continue
        const xhtmlText = await xhtmlFile.async('string')
        
        // Parse XHTML to find image
        const xhtmlDoc = parser.parseFromString(xhtmlText, 'application/xhtml+xml')
        
        // Extract image source attribute
        let imgHref = ''
        const imageSvgEl = xhtmlDoc.getElementsByTagName('image')[0]
        const imgEl = xhtmlDoc.getElementsByTagName('img')[0]
        
        if (imageSvgEl) {
          imgHref = imageSvgEl.getAttribute('xlink:href') || imageSvgEl.getAttribute('href') || ''
        } else if (imgEl) {
          imgHref = imgEl.getAttribute('src') || ''
        }
        
        const pageID = uuid()
        const isBlank = imgHref === ''
        
        newPages.push({
          index: i,
          blobID: isBlank ? '' : pageID,
          sticky: 'auto',
          blank: isBlank
        })
        
        if (!isBlank) {
          // Resolve image path relative to the XHTML file directory
          const xhtmlDir = xhtmlZipPath.includes('/') ? xhtmlZipPath.substring(0, xhtmlZipPath.lastIndexOf('/')) : ''
          const imgZipPath = resolveRelativePath(xhtmlDir, imgHref)
          const imgFile = zip.file(imgZipPath)
          
          if (imgFile) {
            const imgBlob = await imgFile.async('blob')
            formatAndStorePromises.push(
              this.blobs.restoreBlobItem(pageID, imgBlob).then(() => {
                return db.saveBlob(pageID, imgBlob)
              })
            )
          }
        }
      }
      
      // Parse TOC (navigation document)
      const navItem = items.find(item => item.getAttribute('properties')?.includes('nav'))
      const newContentsList: any[] = []
      
      if (navItem) {
        const navZipPath = getZipPath(navItem.getAttribute('href') || '')
        const navFile = zip.file(navZipPath)
        if (navFile) {
          const navXml = await navFile.async('string')
          const navDoc = parser.parseFromString(navXml, 'application/xhtml+xml')
          
          // Query all anchor tags
          const aElements = Array.from(navDoc.querySelectorAll('nav#toc a, nav[epub\\:type="toc"] a, ol a'))
          
          const navDir = navZipPath.includes('/') ? navZipPath.substring(0, navZipPath.lastIndexOf('/')) : ''
          
          aElements.forEach(a => {
            const aHref = a.getAttribute('href') || ''
            const aTitle = a.textContent || ''
            
            // Resolve TOC link path relative to nav document
            const resolvedAHref = resolveRelativePath(navDir, aHref)
            
            // Find which spine index this link points to
            const matchedIndex = spineIds.findIndex(idref => {
              const item = manifestMap[idref]
              if (!item) return false
              return getZipPath(item.href) === resolvedAHref
            })
            
            if (matchedIndex !== -1) {
              newContentsList.push({
                pageIndex: matchedIndex,
                title: aTitle
              })
            }
          })
        }
      }
      
      // Wait for all image processing and DB savings to finish
      await Promise.all(formatAndStorePromises)
      
      runInAction(() => {
        // Apply book metadata
        this.book.bookID = bookID
        this.book.bookTitle = bookTitle
        this.book.bookAuthors = bookAuthors
        this.book.bookSubject = bookSubject
        this.book.bookPublisher = bookPublisher
        this.book.pageSize = pageSize
        this.book.pagePosition = 'between'
        this.book.pageShow = 'two'
        this.book.pageFit = 'stretch'
        this.book.pageBackgroundColor = 'white'
        this.book.pageDirection = pageDirection
        this.book.coverPosition = coverPosition
        this.book.imgTag = 'svg'
        this.book.pages = newPages
        
        // Apply TOC
        if (newContentsList.length > 0) {
          this.contents.updateList(newContentsList)
        } else {
          this.contents.updateList([{ pageIndex: 0, title: '表紙' }])
        }
        this.isAutoSaveActive = true
      })
      
      this.ui.selectPageIndex(null)
    } catch (err: any) {
      console.error('Failed to import EPUB:', err)
      alert(this.ui.lang === 'zh' ? `导入 EPUB 失败: ${err.message}` : `Failed to import EPUB: ${err.message}`)
    } finally {
      this.ui.setLoading(false)
    }
  }

  @action
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

  @action
  async splitPage(index: number) {
    const pageItem = this.book.pages[index]
    const originalBlobID = pageItem.blobID
    const blobItem = this.blobs.blobs[originalBlobID]
    const uuids = [uuid(), uuid()]
    const mime = blobItem.blob.type

    const originImage = await getImageWithBlobURL(blobItem.blobURL)

    const w1 = blobItem.width >> 1
    const w2 = blobItem.width - w1

    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')

    canvas1.width = w1
    canvas1.height = blobItem.height

    canvas2.width = w2
    canvas2.height = blobItem.height

    const ctx1 = canvas1.getContext('2d')
    const ctx2 = canvas2.getContext('2d')

    ctx1?.drawImage(originImage, 0, 0)
    ctx2?.drawImage(originImage, 0 - w1, 0)

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

    originImage.src = ''

    runInAction(() => {
      this.book.splitPage(index, uuids)
      this.book.updatePageItemIndex()
      this.blobs.push(blobs, this.book.pageDirection === 'left' ? uuids : uuids.reverse(), this.ui.lang)

      // Clean up original blob since it is replaced by split pages
      const isStillUsed = this.book.pages.some(p => p.blobID === originalBlobID)
      if (!isStillUsed) {
        this.blobs.delete(originalBlobID)
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
    })
  }

  @action
  insertBlankPage(index: number) {
    this.book.insertBlankPage(index)
    this.book.updatePageItemIndex()

    const selectedPageIndex = this.ui.selectedPageIndex
    if (selectedPageIndex && (selectedPageIndex >= index)) {
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

  @action
  removePage(index: number) {
    const pageItem = this.book.pages[index]
    const deletedBlobID = pageItem ? pageItem.blobID : null

    this.book.removePage(index)
    this.ui.selectPageIndex(null)

    if (deletedBlobID) {
      const isStillUsed = this.book.pages.some(p => p.blobID === deletedBlobID)
      if (!isStillUsed) {
        this.blobs.delete(deletedBlobID)
      }
    }

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

  @action
  generateBook() {
    let templateContainerXml = getTemplateContainerXml()
    let templatePageXhtml = getTemplatePageXhtml()
    let templatePageImgXhtml = getTemplatePageImgXhtml()
    let templateFixedLayoutJpCss = getTemplateFixedLayoutJpCss()
    let templateStandardOpf = getTemplateStandardOpf()
    let templateNavigationDocumentsXhtml = getTemplateNavigationDocumentsXhtml()

    const Zip = new JSZip()

    Zip.folder('META-INF')
    Zip.folder('OEBPS/image')
    Zip.folder('OEBPS/text')
    Zip.folder('OEBPS/style')

    templateNavigationDocumentsXhtml = templateNavigationDocumentsXhtml.replace(
      '<!-- navigation-list -->',
      Object.keys(this.contents.indexMap).map((pageIndex) => {
        const listIndex = this.contents.indexMap[pageIndex]
        const contentItem = this.contents.list[listIndex]
        const title = htmlToEscape(contentItem.title)
  
        if (pageIndex === '0') {
          return `<li><a href="text/p_cover.xhtml">${title}</a></li>`
        }
  
        return `<li><a href="text/p_${getNumberStr(+pageIndex - 1, 4)}.xhtml">${title}</a></li>`
      }).join('\n')
    )

    let imageItemStr: string[] = []
    let pageItemStr: string[] = []
    let itemRefStr: string[] = []
    let spread = this.book.coverPosition === 'first-page'
      ? this.book.pageDirection
      : this.book.pageDirection === 'left'
        ? 'right'
        : 'left'

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
        itemRefStr.push(`<itemref linear="yes" idref="p_${numStr}" properties="page-spread-${spread}"></itemref>`)
        spread = spread === 'left' ? 'right' : 'left'
      }
    })

    if (this.book.coverPosition === 'alone') {
      itemRefStr.unshift(`<itemref linear="no" idref="p_cover" properties="rendition:page-spread-center"></itemref>`)
    } else { // this.book.coverPosition === 'first-page'
      itemRefStr.unshift(`<itemref linear="yes" idref="p_cover" properties="rendition:page-spread-center"></itemref>`)
    }

    const viewPortWidth = this.book.pageSize[0] + ''
    const viewPortHeight = this.book.pageSize[1] + ''
    const fitMode = this.book.pageFit
    const bookTitle = htmlToEscape(this.book.bookTitle.trim())

    if (this.book.imgTag === 'svg') {
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
        const blob = this.blobs.blobs[pageItem.blobID].blob
        const mimeType = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + mimeType
  
        if (pageItem.blank) {
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            templatePageXhtml
              .replace('{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
              .replace('{{image}}', ''),
            { compression: 'DEFLATE' }
          )
          return
        }
  
        let par = 'none'
        if (fitMode !== 'stretch') {
          par = this.book.pagePosition === 'center'
            ? 'xMidYMid '
            : this.book.pageDirection === 'left'
              ? (i + 1) % 2 === 1 ? 'xMaxYMid ' : 'xMinYMid '
              : (i + 1) % 2 === 1 ? 'xMinYMid ' : 'xMaxYMid '
      
          if (fitMode === 'fit') {
            par += 'meet'
          } else { // props.imageFit === 'fill'
            par += 'slice'
          }
        }
  
        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          templatePageXhtml
            .replace('{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
            .replace('{{image}}', `<image width="100%" height="100%" preserveAspectRatio="${par}" xlink:href="../image/${imageFileName}" />`),
          { compression: 'DEFLATE' }
        )
  
        Zip.file(`OEBPS/image/${imageFileName}`, blob, { compression: 'STORE' })
      })
    } else { // this.book.imgTag === 'img'
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
        const blob = this.blobs.blobs[pageItem.blobID].blob
        const mimeType = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + mimeType

        if (pageItem.blank) {
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            templatePageImgXhtml
              .replace('{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
              .replace(`<img src="{{imageSource}}" style="{{style}}"/>`, '<div style="width:100%;height:100%;"></div>'),
            { compression: 'DEFLATE' }
          )
          return
        }

        let imgStyle = 'object-fit:fill'
        if (fitMode !== 'stretch') {
          imgStyle = 'object-position:'

          imgStyle += (
            this.book.pagePosition === 'center'
              ? 'center;'
              : this.book.pageDirection === 'left'
                ? (i + 1) % 2 === 1 ? 'right;' : 'left;'
                : (i + 1) % 2 === 1 ? 'left;' : 'right;'
          )

          if (fitMode === 'fit') {
            imgStyle += 'object-fit:contain'
          } else { // props.imageFit === 'fill'
            imgStyle += 'object-fit:cover'
          }
        }

        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          templatePageImgXhtml
            .replace('{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
            .replace('{{imageSource}}', `../image/${imageFileName}`)
            .replace('{{style}}', imgStyle),
          { compression: 'DEFLATE' }
        )
  
        Zip.file(`OEBPS/image/${imageFileName}`, blob, { compression: 'STORE' })
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

    templateStandardOpf = templateStandardOpf
      .replace('{{uuid}}', this.book.bookID)
      .replace('{{title}}', bookTitle)
      .replace('<!-- creator-list -->', authorsStr)
      .replace('{{subject}}', htmlToEscape(this.book.bookSubject))
      .replace('{{publisher}}', htmlToEscape(this.book.bookPublisher))
      .replace('{{spread}}', this.book.pageShow === 'one' ? 'none' : 'landscape')
      .replace('{{createTime}}', new Date().toISOString())
      .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
      .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
      .replace('<!-- item-image -->', imageItemStr.join('\n'))
      .replace('<!-- item-xhtml -->', pageItemStr.join('\n'))
      .replace('<!-- itemref-xhtml -->', itemRefStr.join('\n'))
      .replace('{{direction}}', this.book.pageDirection === 'right' ? ' page-progression-direction="rtl"' : '')

    Zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
    Zip.file('META-INF/container.xml', templateContainerXml, { compression: 'DEFLATE' })
    Zip.file('OEBPS/style/fixed-layout-jp.css', templateFixedLayoutJpCss, { compression: 'DEFLATE' })
    Zip.file('OEBPS/navigation-documents.xhtml', templateNavigationDocumentsXhtml, { compression: 'DEFLATE' })
    Zip.file('OEBPS/standard.opf', templateStandardOpf, { compression: 'DEFLATE' })

    return Zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip'
    })
  }
}

const store = new Store()

autorun(() => {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('EPUB_CREATOR_SAVED_SETS_BOOK', JSON.stringify(toJS(store.book.savedSets)))
    localStorage.setItem('EPUB_CREATOR_SAVED_SETS_CONTENTS', JSON.stringify(toJS(store.contents.savedSets)))
  }
})

export const StoreContext = createContext(store)
export const useStore = () => useContext(StoreContext)
export default store