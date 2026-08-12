import JSZip from 'jszip'

// ---- Types ----

export interface EpubContributor {
  name: string
  role: 'ill' | 'trl' | 'edt'
}

export interface EpubMetadata {
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
}

export interface EpubPageSettings {
  pageSize?: [number, number]
  pageShow?: 'two' | 'one'
  pageDirection?: 'right' | 'left'
}

export interface EpubTocItem {
  pageIndex: number
  title: string
  level: number
}

export interface EpubParseResult {
  images: Blob[]
  metadata: EpubMetadata
  pageSettings: EpubPageSettings
  toc: EpubTocItem[]
}

// ---- Helpers ----

const resolveRelativePath = (base: string, relative: string): string => {
  if (relative.startsWith('/')) return relative.slice(1)
  const baseParts = base.split('/')
  baseParts.pop()
  const relParts = relative.split('/')
  for (const part of relParts) {
    if (part === '..') baseParts.pop()
    else if (part !== '.') baseParts.push(part)
  }
  return baseParts.join('/')
}

const getTextContent = (el: Element | null): string =>
  el?.textContent?.trim() || ''

const safeDecode = (str: string): string => {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

const findZipEntry = (zip: JSZip, path: string): JSZip.JSZipObject | null => {
  const normalized = path.replace(/^\//, '')
  const decoded = safeDecode(normalized)
  return zip.file(normalized) ||
    zip.file(normalized.replace(/\//g, '\\')) ||
    zip.file(decoded) ||
    zip.file(decoded.replace(/\//g, '\\')) ||
    null
}

const isImageMimeType = (mime: string): boolean =>
  mime.startsWith('image/')

// ---- Core parser ----

export async function parseEpub(file: File): Promise<EpubParseResult> {
  const zip = await JSZip.loadAsync(file)

  // Step 1: Locate OPF via container.xml
  const containerEntry = findZipEntry(zip, 'META-INF/container.xml')
  if (!containerEntry) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml')
  }
  const containerXml = await containerEntry.async('text')
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const rootfileEl = containerDoc.querySelector('rootfile')
  const opfPath = rootfileEl?.getAttribute('full-path')
  if (!opfPath) {
    throw new Error('Invalid EPUB: cannot determine OPF path from container.xml')
  }

  // Step 2: Parse OPF
  const opfEntry = findZipEntry(zip, opfPath)
  if (!opfEntry) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`)
  }
  const opfXml = await opfEntry.async('text')
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml')
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : ''

  // Step 3: Build manifest map (id -> {href, mediaType})
  const manifestMap = new Map<string, { href: string; mediaType: string }>()
  const manifestItems = opfDoc.querySelectorAll('manifest > item')
  manifestItems.forEach(item => {
    const id = item.getAttribute('id') || ''
    const href = item.getAttribute('href') || ''
    const mediaType = item.getAttribute('media-type') || ''
    if (id && href) {
      manifestMap.set(id, { href, mediaType })
    }
  })

  // Step 4: Parse spine order
  const spineEl = opfDoc.querySelector('spine')
  const spineDirection = spineEl?.getAttribute('page-progression-direction')
  const spineItems: string[] = []
  const itemrefs = opfDoc.querySelectorAll('spine > itemref')
  itemrefs.forEach(ref => {
    const idref = ref.getAttribute('idref')
    if (idref) spineItems.push(idref)
  })

  // Step 5: For each spine item, extract referenced image path
  const imagePathsInOrder: string[] = []
  const seenImagePaths = new Set<string>()

  for (const itemId of spineItems) {
    const manifestItem = manifestMap.get(itemId)
    if (!manifestItem) continue

    if (isImageMimeType(manifestItem.mediaType)) {
      // spine directly references an image
      const fullPath = opfDir ? `${opfDir}/${manifestItem.href}` : manifestItem.href
      if (!seenImagePaths.has(fullPath)) {
        imagePathsInOrder.push(fullPath)
        seenImagePaths.add(fullPath)
      }
      continue
    }

    // Parse XHTML to find image references
    const xhtmlPath = opfDir ? `${opfDir}/${manifestItem.href}` : manifestItem.href
    const xhtmlEntry = findZipEntry(zip, xhtmlPath)
    if (!xhtmlEntry) continue

    const xhtmlText = await xhtmlEntry.async('text')
    const imgPaths = extractImagePathsFromXhtml(xhtmlText)

    for (const imgPath of imgPaths) {
      const fullImgPath = resolveRelativePath(xhtmlPath, imgPath)
      if (!seenImagePaths.has(fullImgPath)) {
        imagePathsInOrder.push(fullImgPath)
        seenImagePaths.add(fullImgPath)
      }
    }
  }

  // Step 6: Collect cover image (EPUB 3 properties="cover-image" first, then EPUB 2 fallbacks)
  let foundCover = false

  // 1. EPUB 3 standard: properties="cover-image"
  manifestItems.forEach(item => {
    const props = item.getAttribute('properties') || ''
    if (props.includes('cover-image')) {
      const href = item.getAttribute('href') || ''
      const fullPath = opfDir ? `${opfDir}/${href}` : href
      if (!seenImagePaths.has(fullPath)) {
        imagePathsInOrder.unshift(fullPath)
        seenImagePaths.add(fullPath)
        foundCover = true
      }
    }
  })

  // 2. EPUB 2 fallback: meta name="cover"
  if (!foundCover) {
    const coverMeta = opfDoc.querySelector('meta[name="cover"]')
    const coverId = coverMeta?.getAttribute('content')
    if (coverId) {
      const coverItem = manifestMap.get(coverId)
      if (coverItem && isImageMimeType(coverItem.mediaType)) {
        const fullPath = opfDir ? `${opfDir}/${coverItem.href}` : coverItem.href
        if (!seenImagePaths.has(fullPath)) {
          imagePathsInOrder.unshift(fullPath)
          seenImagePaths.add(fullPath)
          foundCover = true
        }
      }
    }
  }

  // 3. EPUB 2 legacy fallback: guide reference type="cover"
  if (!foundCover) {
    const guideCoverRef = opfDoc.querySelector('guide > reference[type="cover"], guide > reference[type*="cover"]')
    if (guideCoverRef) {
      const href = guideCoverRef.getAttribute('href') || ''
      if (href) {
        const fullPath = opfDir ? `${opfDir}/${href}` : href
        const manifestItem = Array.from(manifestMap.values()).find(item => safeDecode(item.href) === safeDecode(href))
        if (manifestItem && isImageMimeType(manifestItem.mediaType)) {
          if (!seenImagePaths.has(fullPath)) {
            imagePathsInOrder.unshift(fullPath)
            seenImagePaths.add(fullPath)
          }
        } else {
          const coverXhtmlEntry = findZipEntry(zip, fullPath)
          if (coverXhtmlEntry) {
            const text = await coverXhtmlEntry.async('text')
            const coverImgs = extractImagePathsFromXhtml(text)
            for (const imgP of coverImgs) {
              const fullImgP = resolveRelativePath(fullPath, imgP)
              if (!seenImagePaths.has(fullImgP)) {
                imagePathsInOrder.unshift(fullImgP)
                seenImagePaths.add(fullImgP)
              }
            }
          }
        }
      }
    }
  }

  // Step 7: Load image blobs
  const images: Blob[] = []
  for (const imgPath of imagePathsInOrder) {
    const entry = findZipEntry(zip, imgPath)
    if (!entry) continue
    const data = await entry.async('uint8array')
    const mimeType = detectImageMime(data) || 'image/jpeg'
    images.push(new Blob([new Uint8Array(data)], { type: mimeType }))
  }

  // Step 8: Extract metadata
  const metadata = extractMetadata(opfDoc)

  // Step 9: Extract page settings
  const pageSettings = extractPageSettings(opfDoc, spineDirection ?? null)

  // Step 10: Extract TOC
  // Build spine href -> image index mapping for TOC resolution
  const spineHrefToImageIndex = await buildSpineToImageIndexMap(
    spineItems, manifestMap, opfDir, imagePathsInOrder, zip
  )

  const toc = await extractToc(zip, opfDoc, opfDir, manifestMap, spineHrefToImageIndex)

  return { images, metadata, pageSettings, toc }
}

// ---- Image extraction from XHTML ----

function extractImagePathsFromXhtml(xhtmlText: string): string[] {
  const paths: string[] = []

  // SVG <image> with xlink:href
  const svgImageRegex = /<image[^>]*xlink:href=["']([^"']+)["'][^>]*\/?>/gi
  let match: RegExpExecArray | null
  while ((match = svgImageRegex.exec(xhtmlText)) !== null) {
    paths.push(match[1])
  }

  // <img src="...">
  const imgSrcRegex = /<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi
  while ((match = imgSrcRegex.exec(xhtmlText)) !== null) {
    if (match[1] && !paths.includes(match[1])) {
      paths.push(match[1])
    }
  }

  // SVG <image> with plain href (no namespace prefix)
  const svgHrefRegex = /<image[^>]*\shref=["']([^"']+)["'][^>]*\/?>/gi
  while ((match = svgHrefRegex.exec(xhtmlText)) !== null) {
    if (match[1] && !paths.includes(match[1])) {
      paths.push(match[1])
    }
  }

  return paths
}

// ---- MIME detection via magic bytes ----

export function detectImageMime(data: Uint8Array): string | null {
  if (data.length < 12) return null

  const hexOf = (start: number, end: number) =>
    Array.from(data.subarray(start, end)).map(b => b.toString(16).padStart(2, '0')).join('')
  const asciiOf = (start: number, end: number) =>
    String.fromCharCode(...Array.from(data.subarray(start, end)))

  if (hexOf(0, 4) === '89504e47') return 'image/png'
  if (hexOf(0, 3) === 'ffd8ff') return 'image/jpeg'
  if (asciiOf(0, 6) === 'GIF87a' || asciiOf(0, 6) === 'GIF89a') return 'image/gif'
  if (asciiOf(0, 4) === 'RIFF' && asciiOf(8, 12) === 'WEBP') return 'image/webp'
  if (asciiOf(4, 8) === 'ftyp' && ['avif', 'avis'].includes(asciiOf(8, 12))) return 'image/avif'

  return null
}

// ---- Metadata extraction ----

function extractMetadata(opfDoc: Document): EpubMetadata {
  const ns = 'http://purl.org/dc/elements/1.1/'

  const bookTitle = getTextContent(opfDoc.querySelector('metadata title') || opfDoc.getElementsByTagNameNS(ns, 'title')[0])
  const bookSubject = getTextContent(opfDoc.querySelector('metadata subject') || opfDoc.getElementsByTagNameNS(ns, 'subject')[0])
  const bookPublisher = getTextContent(opfDoc.querySelector('metadata publisher') || opfDoc.getElementsByTagNameNS(ns, 'publisher')[0])
  const bookLanguage = getTextContent(opfDoc.querySelector('metadata language') || opfDoc.getElementsByTagNameNS(ns, 'language')[0]) || 'ja'
  const bookDescription = getTextContent(opfDoc.querySelector('metadata description') || opfDoc.getElementsByTagNameNS(ns, 'description')[0])
  const bookDate = getTextContent(opfDoc.querySelector('metadata date') || opfDoc.getElementsByTagNameNS(ns, 'date')[0])

  // Authors (dc:creator) - 保持原样字符串导入
  const creatorEls = opfDoc.getElementsByTagNameNS(ns, 'creator')
  const bookAuthors: string[] = []
  for (let i = 0; i < creatorEls.length; i++) {
    const name = getTextContent(creatorEls[i])
    if (name) bookAuthors.push(name)
  }
  if (bookAuthors.length === 0) {
    const creatorQuery = getTextContent(opfDoc.querySelector('metadata creator'))
    if (creatorQuery) bookAuthors.push(creatorQuery)
  }
  if (bookAuthors.length === 0) bookAuthors.push('')

  // Contributors (dc:contributor)
  const contribEls = opfDoc.getElementsByTagNameNS(ns, 'contributor')
  const bookContributors: EpubContributor[] = []
  for (let i = 0; i < contribEls.length; i++) {
    const name = getTextContent(contribEls[i])
    if (!name) continue
    const id = contribEls[i].getAttribute('id')
    let role: EpubContributor['role'] = 'edt'
    if (id) {
      const refineMeta = opfDoc.querySelector(`meta[refines="#${id}"][property="role"]`)
      const roleStr = getTextContent(refineMeta)
      if (roleStr === 'ill' || roleStr === 'trl' || roleStr === 'edt') {
        role = roleStr
      }
    }
    bookContributors.push({ name, role })
  }

  // ISBN
  let bookISBN = ''
  const identifierEls = opfDoc.getElementsByTagNameNS(ns, 'identifier')
  for (let i = 0; i < identifierEls.length; i++) {
    const text = getTextContent(identifierEls[i])
    const isbnMatch = text.match(/(?:urn:isbn:)?(\d[\d-]{8,}[\dXx])/)
    if (isbnMatch) {
      bookISBN = isbnMatch[1]
      break
    }
  }

  // Series info (belongs-to-collection / dc:series)
  let bookSeriesName = ''
  let bookSeriesVolume = ''
  const collectionMeta = opfDoc.querySelector('meta[property="belongs-to-collection"]')
  if (collectionMeta) {
    bookSeriesName = getTextContent(collectionMeta)
    const collectionId = collectionMeta.getAttribute('id')
    if (collectionId) {
      const volumeMeta = opfDoc.querySelector(`meta[refines="#${collectionId}"][property="group-position"]`)
      bookSeriesVolume = getTextContent(volumeMeta)
    }
  }

  // 回退检查 dc:series
  if (!bookSeriesName) {
    const seriesEl = opfDoc.getElementsByTagNameNS(ns, 'series')[0] || opfDoc.querySelector('metadata series')
    if (seriesEl) bookSeriesName = getTextContent(seriesEl)
  }

  // 回退检查 dc:number 充当卷号 (直接以原始 string 导入，不做转换)
  if (!bookSeriesVolume) {
    const numberEl = opfDoc.getElementsByTagNameNS(ns, 'number')[0] || opfDoc.querySelector('metadata number')
    if (numberEl) bookSeriesVolume = getTextContent(numberEl)
  }

  return {
    bookTitle,
    bookAuthors,
    bookSubject,
    bookPublisher,
    bookLanguage,
    bookSeriesName,
    bookSeriesVolume,
    bookDescription,
    bookDate,
    bookContributors,
    bookISBN
  }
}

// ---- Page settings extraction ----

function extractPageSettings(opfDoc: Document, spineDirection: string | null): EpubPageSettings {
  const settings: EpubPageSettings = {}

  // Page size from original-resolution or fixed-layout-jp:viewport
  const metaEls = opfDoc.querySelectorAll('metadata meta')
  for (let i = 0; i < metaEls.length; i++) {
    const meta = metaEls[i]
    const name = meta.getAttribute('name') || ''
    const property = meta.getAttribute('property') || ''
    const content = meta.getAttribute('content') || getTextContent(meta)

    // original-resolution: "WxH"
    if (name === 'original-resolution' && content) {
      const match = content.match(/(\d+)\s*x\s*(\d+)/)
      if (match) {
        settings.pageSize = [parseInt(match[1], 10), parseInt(match[2], 10)]
      }
    }

    // fixed-layout-jp:viewport: "width=W, height=H"
    if (property.includes('viewport') && content) {
      const wMatch = content.match(/width\s*=\s*(\d+)/)
      const hMatch = content.match(/height\s*=\s*(\d+)/)
      if (wMatch && hMatch && !settings.pageSize) {
        settings.pageSize = [parseInt(wMatch[1], 10), parseInt(hMatch[1], 10)]
      }
    }

    // rendition:spread
    if (property === 'rendition:spread' && content) {
      if (content === 'none') {
        settings.pageShow = 'one'
      } else if (content === 'landscape' || content === 'both' || content === 'auto') {
        settings.pageShow = 'two'
      }
    }
  }

  // page-progression-direction from spine
  if (spineDirection === 'rtl') {
    settings.pageDirection = 'right'
  } else if (spineDirection === 'ltr') {
    settings.pageDirection = 'left'
  }

  return settings
}

// ---- Spine → image index mapping for TOC ----

async function buildSpineToImageIndexMap(
  spineItems: string[],
  manifestMap: Map<string, { href: string; mediaType: string }>,
  opfDir: string,
  imagePathsInOrder: string[],
  zip: JSZip
): Promise<Map<string, number>> {
  const map = new Map<string, number>()

  const decodedImagePathsInOrder = imagePathsInOrder.map(safeDecode)

  for (let si = 0; si < spineItems.length; si++) {
    const itemId = spineItems[si]
    const manifestItem = manifestMap.get(itemId)
    if (!manifestItem) continue

    const href = manifestItem.href
    // Map by the xhtml href (relative to OPF dir)
    if (isImageMimeType(manifestItem.mediaType)) {
      const fullPath = safeDecode(opfDir ? `${opfDir}/${href}` : href)
      const idx = decodedImagePathsInOrder.indexOf(fullPath)
      if (idx !== -1) map.set(href, idx)
      continue
    }

    const xhtmlPath = opfDir ? `${opfDir}/${href}` : href
    const xhtmlEntry = findZipEntry(zip, xhtmlPath)
    if (!xhtmlEntry) continue

    const xhtmlText = await xhtmlEntry.async('text')
    const imgPaths = extractImagePathsFromXhtml(xhtmlText)

    if (imgPaths.length > 0) {
      const fullImgPath = safeDecode(resolveRelativePath(xhtmlPath, imgPaths[0]))
      const idx = decodedImagePathsInOrder.indexOf(fullImgPath)
      if (idx !== -1) map.set(href, idx)
    }
  }

  return map
}

// ---- TOC extraction ----

async function extractToc(
  zip: JSZip,
  opfDoc: Document,
  opfDir: string,
  manifestMap: Map<string, { href: string; mediaType: string }>,
  spineHrefToImageIndex: Map<string, number>
): Promise<EpubTocItem[]> {
  let navHref: string | null = null

  // 1. Check properties="nav" (EPUB 3)
  const manifestItems = opfDoc.querySelectorAll('manifest > item')
  for (let i = 0; i < manifestItems.length; i++) {
    const props = manifestItems[i].getAttribute('properties') || ''
    if (props.includes('nav')) {
      navHref = manifestItems[i].getAttribute('href')
      break
    }
  }

  // 2. Fallback: Check <spine toc="..."> attribute (NCX ID)
  if (!navHref) {
    const spineEl = opfDoc.querySelector('spine')
    const tocId = spineEl?.getAttribute('toc')
    if (tocId) {
      const item = manifestMap.get(tocId)
      if (item) navHref = item.href
    }
  }

  // 3. Fallback: Find item by media-type containing ncx or id="ncx" or href containing nav/ncx
  if (!navHref) {
    for (let i = 0; i < manifestItems.length; i++) {
      const id = manifestItems[i].getAttribute('id') || ''
      const mediaType = manifestItems[i].getAttribute('media-type') || ''
      const href = manifestItems[i].getAttribute('href') || ''
      if (mediaType.includes('ncx') || id.toLowerCase() === 'ncx' || /\b(nav|ncx)\b/i.test(href)) {
        navHref = href
        break
      }
    }
  }

  if (!navHref) return []

  const navPath = opfDir ? `${opfDir}/${navHref}` : navHref
  const navEntry = findZipEntry(zip, navPath)
  if (!navEntry) return []

  const navText = await navEntry.async('text')
  const xmlDoc = new DOMParser().parseFromString(navText, 'application/xml')

  const resolveHrefToImageIndex = (href: string): number => {
    const fullPath = safeDecode(resolveRelativePath(navPath, href))

    for (const [spineHref, imgIdx] of spineHrefToImageIndex.entries()) {
      const spineFullPath = safeDecode(opfDir ? `${opfDir}/${spineHref}` : spineHref)
      if (spineFullPath === fullPath) return imgIdx
    }

    const fileName = fullPath.split('/').pop() || ''
    for (const [spineHref, imgIdx] of spineHrefToImageIndex.entries()) {
      const spineFileName = safeDecode(spineHref).split('/').pop() || ''
      if (spineFileName === fileName) return imgIdx
    }

    return -1
  }

  // Check if it's NCX format (<ncx> or <navMap>)
  const isNcx = xmlDoc.querySelector('ncx, navMap') !== null
  if (isNcx) {
    const result: EpubTocItem[] = []
    const walkNavPoint = (el: Element, level: number) => {
      const children = el.children
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.tagName.toLowerCase() === 'navpoint') {
          const labelEl = child.querySelector('navLabel > text')
          const contentEl = child.querySelector('content')
          const title = labelEl?.textContent?.trim() || ''
          const src = contentEl?.getAttribute('src') || ''
          const srcBase = src.split('#')[0]
          const pageIndex = resolveHrefToImageIndex(srcBase)

          if (title && pageIndex >= 0) {
            result.push({ pageIndex, title, level })
          }
          walkNavPoint(child, level + 1)
        }
      }
    }

    const navMap = xmlDoc.querySelector('navMap')
    if (navMap) {
      walkNavPoint(navMap, 0)
    }
    return result
  }

  // Parse HTML/XHTML Nav format
  const navDoc = new DOMParser().parseFromString(navText, 'application/xhtml+xml')
  const navEls = navDoc.querySelectorAll('nav')
  let tocNav: Element | null = null
  for (let i = 0; i < navEls.length; i++) {
    const epubType = navEls[i].getAttribute('epub:type') ||
      navEls[i].getAttributeNS('http://www.idpf.org/2007/ops', 'type')
    if (epubType?.includes('toc')) {
      tocNav = navEls[i]
      break
    }
  }

  if (!tocNav) {
    for (let i = 0; i < navEls.length; i++) {
      if (navEls[i].querySelector('ol')) {
        tocNav = navEls[i]
        break
      }
    }
  }

  if (!tocNav) return []

  const topOl = tocNav.querySelector('ol')
  if (!topOl) return []

  const result: EpubTocItem[] = []

  const walkOl = (ol: Element, level: number) => {
    const children = ol.children
    for (let i = 0; i < children.length; i++) {
      const li = children[i]
      if (li.tagName.toLowerCase() !== 'li') continue

      const anchor = li.querySelector(':scope > a')
      if (anchor) {
        const href = anchor.getAttribute('href') || ''
        const title = anchor.textContent?.trim() || ''
        const hrefBase = href.split('#')[0]
        const pageIndex = resolveHrefToImageIndex(hrefBase)

        if (title && pageIndex >= 0) {
          result.push({ pageIndex, title, level })
        }
      }

      const nestedOl = li.querySelector(':scope > ol')
      if (nestedOl) {
        walkOl(nestedOl, level + 1)
      }
    }
  }

  walkOl(topOl, 0)

  return result
}
