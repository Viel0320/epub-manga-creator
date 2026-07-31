import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import storeMain, { useStore } from 'store/main'
import Icon from 'components/icon'
import { useI18n } from 'i18n'
import { getPageLayoutInfo } from 'utils/page-layout'

function getSpreadPair(
  index: number,
  pages: Array<{ customSpread?: 'center' | 'auto' }>,
  coverPosition: 'first-page' | 'alone',
  pageDirection: 'left' | 'right'
): [number | null, number | null] {
  const totalPages = pages.length
  if (totalPages <= 0 || index < 0 || index >= totalPages) return [null, null]

  const isCenter = (coverPosition === 'first-page' && index === 0) || (pages[index]?.customSpread === 'center')
  if (isCenter) {
    return pageDirection === 'right' ? [null, index] : [index, null]
  }

  const startIdx = coverPosition === 'first-page' ? 1 : 0
  let x = startIdx - 1
  let targetPair: [number | null, number | null] | null = null

  while (x < totalPages - 1) {
    let p1: number | null = null
    let p2: number | null = null

    p1 = ++x < totalPages ? x : null
    const page1Item = p1 !== null ? pages[p1] : null

    if (page1Item && page1Item.customSpread === 'center') {
      p2 = null
    } else {
      const nextIdx = x + 1
      const nextItem = nextIdx < totalPages ? pages[nextIdx] : null
      if (nextItem && nextItem.customSpread === 'center') {
        p2 = null
      } else {
        p2 = ++x < totalPages ? x : null
      }
    }

    if (p1 === index || p2 === index) {
      targetPair = [p1, p2]
      break
    }
  }

  if (!targetPair) return [index, null]

  const [p1, p2] = targetPair
  if (p2 === null) {
    return pageDirection === 'right' ? [null, p1] : [p1, null]
  }

  return pageDirection === 'right' ? [p2, p1] : [p1, p2]
}

const Lightbox = observer(function() {
  const { ui, book, blobs } = useStore()
  const t = useI18n()

  const onClose = useCallback(() => {
    ui.closePreview()
  }, [ui])

  const onContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  if (!ui.isPreviewOpen || ui.previewPageIndex === null || book.pages.length === 0) return null

  const totalPages = book.pages.length
  const pageIndex = Math.max(0, Math.min(totalPages - 1, ui.previewPageIndex))
  const isTwoPages = book.pageShow === 'two'

  let leftIndex: number | null = null
  let rightIndex: number | null = null
  let isSpreadPair = false

  if (isTwoPages) {
    const pair = getSpreadPair(pageIndex, book.pages, book.coverPosition, book.pageDirection)
    leftIndex = pair[0]
    rightIndex = pair[1]
    isSpreadPair = leftIndex !== null && rightIndex !== null
  } else {
    leftIndex = pageIndex
    rightIndex = null
    isSpreadPair = false
  }

  const activeIndices = [leftIndex, rightIndex].filter((x): x is number => x !== null)
  const minIndex = activeIndices.length > 0 ? Math.min(...activeIndices) : pageIndex
  const maxIndex = activeIndices.length > 0 ? Math.max(...activeIndices) : pageIndex

  const isFirst = minIndex === 0
  const isLast = maxIndex >= totalPages - 1

  const isRTL = book.pageDirection === 'right'
  const isLeftDisabled = isRTL ? isLast : isFirst
  const isRightDisabled = isRTL ? isFirst : isLast

  const onLeftClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    ui.navigatePreview('left', book.pageDirection, book.pageShow, book.coverPosition, totalPages)
  }

  const onRightClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    ui.navigatePreview('right', book.pageDirection, book.pageShow, book.coverPosition, totalPages)
  }

  const onTogglePageShow = (e: React.MouseEvent) => {
    e.stopPropagation()
    book.updateBookPageProperty('pageShow', isTwoPages ? 'one' : 'two')
  }

  const pageDimensionsText = `${book.pageSize[0]}×${book.pageSize[1]}`

  const renderSingleImage = (idx: number, side?: 'left' | 'right') => {
    const page = book.pages[idx]
    if (!page) return null

    const isBlank = page.blank
    const blobItem = isBlank ? null : blobs.blobs[page.blobID]
    const imageURL = blobItem ? blobItem.blobURL : null

    const pageStr = isTwoPages
      ? `${t.lightbox.page} ${idx + 1}`
      : `${t.lightbox.page} ${idx + 1} / ${totalPages}`

    let sizeStr = ''
    if (isBlank) {
      sizeStr = t.lightbox.blankPage
    } else if (blobItem && blobItem.originImage) {
      sizeStr = `${blobItem.originImage.width}×${blobItem.originImage.height}`
    }

    const listIdx = totalPages > 0 ? storeMain.contents.indexMap[idx] : undefined
    const bookmarkTitle = listIdx !== undefined ? storeMain.contents.list[listIdx]?.title : null

    const layout = getPageLayoutInfo({
      pageIndex: idx,
      pages: book.pages,
      coverPosition: book.coverPosition,
      pageDirection: book.pageDirection,
      pagePositionSetting: book.pagePosition,
      pageFitSetting: book.pageFit,
      customSpread: page?.customSpread
    })

    const svgStyle: React.CSSProperties = isTwoPages && side ? {
      width: '100%',
      height: '100%',
      aspectRatio: `${book.pageSize[0]} / ${book.pageSize[1]}`,
    } : {
      height: 'calc(88vh - 60px)',
      width: 'auto',
      maxWidth: '82vw',
      maxHeight: 'calc(88vh - 60px)',
      aspectRatio: `${book.pageSize[0]} / ${book.pageSize[1]}`,
    }

    return (
      <div key={idx} className="lightbox-page-wrapper">
        {/* Page Chip aligned strictly to this image's vertical center axis */}
        <div className="lightbox-page-chip" onClick={onContentClick}>
          <span>{pageStr}</span>
          {sizeStr ? (
            <>
              <span>•</span>
              <span className="chip-dim">{sizeStr}</span>
            </>
          ) : null}
          {bookmarkTitle ? (
            <>
              <span>•</span>
              <span className="chip-bookmark">{bookmarkTitle}</span>
            </>
          ) : null}
        </div>

        {isBlank ? (
          <div
            className="lightbox-image lightbox-blank-page d-flex align-items-center justify-content-center"
            style={{
              aspectRatio: `${book.pageSize[0]} / ${book.pageSize[1]}`,
              backgroundColor: book.pageBackgroundColor === 'white' ? '#fff' : '#000',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
            onClick={onContentClick}
          >
            <span style={{ color: book.pageBackgroundColor === 'white' ? '#000' : '#fff', fontSize: '24px', fontWeight: 'bold' }}>
              {t.lightbox.blankPage}
            </span>
          </div>
        ) : imageURL ? (
          <svg
            className="lightbox-image"
            viewBox={'0 0 ' + book.pageSize.join(' ')}
            preserveAspectRatio={layout.par}
            style={svgStyle}
            onClick={onContentClick}
          >
            <rect x="0" y="0" width="100%" height="100%" fill={book.pageBackgroundColor === 'white' ? '#fff' : '#000'} />
            <image
              width="100%"
              height="100%"
              preserveAspectRatio={layout.par}
              xlinkHref={imageURL}
            />
          </svg>
        ) : (
          <div className="spinner-border text-primary" role="status"></div>
        )}
      </div>
    )
  }

  return (
    <div className="lightbox-container" onClick={onClose}>
      <div className="lightbox-content">
        {/* Page Mode Toggle Button (Top Left) */}
        <button
          type="button"
          className="lightbox-toggle-btn"
          onClick={onTogglePageShow}
          title={isTwoPages ? t.option.twoPages : t.option.onePage}
        >
          <Icon name={isTwoPages ? 'book' : 'document'} />
          <span className="toggle-text">{isTwoPages ? t.option.twoPages : t.option.onePage}</span>
        </button>

        {/* Central Floating Header: Displays Book Page Size */}
        <div className="lightbox-header">
          <Icon name="ruler" />
          <span>{pageDimensionsText}</span>
        </div>

        {/* Close Button */}
        <button type="button" className="lightbox-close-btn" onClick={onClose} title={t.lightbox.close}>
          <Icon name="cross" />
        </button>

        {/* Navigation Arrows */}
        <button
          type="button"
          className={`lightbox-nav-btn prev ${isLeftDisabled ? 'disabled' : ''}`}
          onClick={onLeftClick}
          disabled={isLeftDisabled}
          title={isRTL ? t.lightbox.next : t.lightbox.prev}
        >
          <Icon name="chevron-left" />
        </button>

        {/* Display Content */}
        {isSpreadPair ? (
          <div
            className="lightbox-spread-wrapper"
            onClick={onContentClick}
          >
            {leftIndex !== null && renderSingleImage(leftIndex, 'left')}
            {rightIndex !== null && renderSingleImage(rightIndex, 'right')}
          </div>
        ) : (
          renderSingleImage(pageIndex)
        )}

        <button
          type="button"
          className={`lightbox-nav-btn next ${isRightDisabled ? 'disabled' : ''}`}
          onClick={onRightClick}
          disabled={isRightDisabled}
          title={isRTL ? t.lightbox.prev : t.lightbox.next}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  )
})

export default Lightbox
