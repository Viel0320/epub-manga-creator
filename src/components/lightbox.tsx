import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import storeMain, { useStore } from 'store/main'
import Icon from 'components/icon'
import { useI18n } from 'i18n'

function getSpreadPair(
  index: number,
  coverPosition: 'first-page' | 'alone',
  pageDirection: 'left' | 'right',
  totalPages: number
): [number | null, number | null] {
  if (totalPages <= 0) return [null, null]

  if (coverPosition === 'first-page') {
    // 封面单独占用单面，不与任何页面拼接
    if (index === 0) {
      return pageDirection === 'right' ? [null, 0] : [0, null]
    }
    // index >= 1 正文两两成对：(1,2), (3,4), (5,6)...
    const offset = index - 1
    const group = Math.floor(offset / 2)
    const p1 = 1 + group * 2
    const p2 = p1 + 1 < totalPages ? p1 + 1 : null
    return pageDirection === 'right' ? [p2, p1] : [p1, p2]
  } else {
    // coverPosition === 'alone'：从 0 开始两两成对：(0,1), (2,3), (4,5)...
    const group = Math.floor(index / 2)
    const p1 = group * 2
    const p2 = p1 + 1 < totalPages ? p1 + 1 : null
    return pageDirection === 'right' ? [p2, p1] : [p1, p2]
  }
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
    if (book.coverPosition === 'first-page' && pageIndex === 0) {
      leftIndex = 0
      rightIndex = null
      isSpreadPair = false
    } else {
      const pair = getSpreadPair(pageIndex, book.coverPosition, book.pageDirection, totalPages)
      leftIndex = pair[0]
      rightIndex = pair[1]
      isSpreadPair = leftIndex !== null && rightIndex !== null
    }
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

  // Header Title & Bookmark info
  let pageNumberText = ''
  if (isSpreadPair && leftIndex !== null && rightIndex !== null) {
    const pFirst = Math.min(leftIndex, rightIndex) + 1
    const pSecond = Math.max(leftIndex, rightIndex) + 1
    pageNumberText = `${t.lightbox.page} ${pFirst}-${pSecond} / ${totalPages}`
  } else {
    pageNumberText = `${t.lightbox.page} ${minIndex + 1} / ${totalPages}`
  }

  const bookmarkTitles = activeIndices
    .map(idx => {
      const listIdx = totalPages > 0 ? storeMain.contents.indexMap[idx] : undefined
      return listIdx !== undefined ? storeMain.contents.list[listIdx]?.title : null
    })
    .filter(Boolean)

  const renderSingleImage = (idx: number) => {
    const page = book.pages[idx]
    if (!page) return null

    const isBlank = page.blank
    const blobItem = isBlank ? null : blobs.blobs[page.blobID]
    const imageURL = blobItem ? blobItem.blobURL : null

    if (isBlank) {
      return (
        <div
          key={idx}
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
      )
    }

    if (imageURL) {
      return (
        <img
          key={idx}
          src={imageURL}
          alt={`Page ${idx + 1}`}
          className="lightbox-image"
          onClick={onContentClick}
        />
      )
    }

    return <div key={idx} className="spinner-border text-primary" role="status"></div>
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

        {/* Floating Header */}
        <div className="lightbox-header">
          <span>{pageNumberText}</span>
          {bookmarkTitles.map((title, i) => (
            <React.Fragment key={i}>
              <span>•</span>
              <span className="page-title">{title}</span>
            </React.Fragment>
          ))}
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
          <div className="lightbox-spread-wrapper" onClick={onContentClick}>
            {leftIndex !== null && renderSingleImage(leftIndex)}
            {rightIndex !== null && renderSingleImage(rightIndex)}
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
