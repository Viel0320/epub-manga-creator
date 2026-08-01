import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import storeMain, { useStore } from 'store/main'
import Icon from 'components/icon'
import { useI18n } from 'i18n'
import { getPageLayoutInfo, getSpreadPairs, CustomSpreadType } from 'utils/page-layout'
import { getPageEffectiveSize } from 'utils/page-size'

function getSpreadPair(
  index: number,
  pages: Array<{ customSpread?: CustomSpreadType }>,
  coverPosition: 'first-page' | 'alone',
  pageDirection: 'left' | 'right',
  pageShow: 'two' | 'one' = 'two'
): [number | null, number | null] {
  const totalPages = pages.length
  if (totalPages <= 0 || index < 0 || index >= totalPages) return [null, null]

  const pairs = getSpreadPairs(pages, coverPosition, pageShow)
  const pair = pairs.find(p => p.includes(index))

  if (!pair || pair.length === 1) {
    const pVal = pair ? pair[0] : index
    return pageDirection === 'right' ? [null, pVal] : [pVal, null]
  }

  const [p1, p2] = pair
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

  const pair = getSpreadPair(pageIndex, book.pages, book.coverPosition, book.pageDirection, book.pageShow)
  const leftIndex = pair[0]
  const rightIndex = pair[1]
  const isSpreadPair = leftIndex !== null && rightIndex !== null

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

  const modeSize = storeMain.modePageSize
  const displaySize = storeMain.displayPageSize
  const pageDimensionsText = book.pageSizeMode === 'auto'
    ? `Auto (${displaySize[0]}×${displaySize[1]})`
    : `${displaySize[0]}×${displaySize[1]}`

  const settingsChips = [
    { label: t.page.size, value: book.pageSizeMode === 'auto' ? `Auto (${displaySize[0]}×${displaySize[1]})` : `${displaySize[0]}×${displaySize[1]}` },
    { label: t.page.position, value: book.pagePosition === 'between' ? t.option.between : t.option.center },
    { label: t.page.show, value: book.pageShow === 'two' ? t.option.twoPages : t.option.onePage },
    { label: t.page.fit, value: book.pageFit === 'fit' ? t.option.fit : (book.pageFit === 'stretch' ? t.option.stretch : t.option.fill) },
    { label: t.page.direction, value: book.pageDirection === 'right' ? t.option.rightJP : t.option.left },
    { label: t.page.cover, value: book.coverPosition === 'first-page' ? t.option.firstPage : t.option.alone },
    { label: t.page.imageTag, value: book.imgTag === 'svg' ? '<svg />' : '<img />' },
  ]

  const renderSingleImage = (idx: number, side?: 'left' | 'right') => {
    const page = book.pages[idx]
    if (!page) return null

    const isBlank = page.blank
    const blobItem = isBlank ? null : blobs.blobs[page.blobID]
    const imageURL = blobItem ? blobItem.blobURL : null

    const effectiveSize = getPageEffectiveSize(page, blobItem, book.pageSizeMode, book.pageSize, modeSize)

    const pageStr = isTwoPages
      ? `${t.lightbox.page} ${idx + 1}`
      : `${t.lightbox.page} ${idx + 1} / ${totalPages}`

    const viewportSizeStr = `${effectiveSize[0]}×${effectiveSize[1]}`
    let originSizeStr = ''
    if (isBlank) {
      originSizeStr = t.lightbox.blankPage
    } else if (blobItem && blobItem.originImage) {
      originSizeStr = `${blobItem.originImage.width}×${blobItem.originImage.height}`
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
      aspectRatio: `${effectiveSize[0]} / ${effectiveSize[1]}`,
    } : {
      height: '88vh',
      width: 'auto',
      maxWidth: '82vw',
      maxHeight: '88vh',
      aspectRatio: `${effectiveSize[0]} / ${effectiveSize[1]}`,
    }

    return (
      <div key={idx} className="lightbox-page-wrapper">
        {/* Page Chip aligned strictly to this image's vertical center axis: displays page number, viewport size & original size */}
        <div className="lightbox-page-chip" onClick={onContentClick}>
          <span>{pageStr}</span>
          <span>•</span>
          <span className="chip-dim">{viewportSizeStr}</span>
          {!isBlank && originSizeStr ? (
            <>
              <span>•</span>
              <span className="chip-dim">{t.lightbox.originImage || '原图'} {originSizeStr}</span>
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
              aspectRatio: `${effectiveSize[0]} / ${effectiveSize[1]}`,
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
            viewBox={'0 0 ' + effectiveSize.join(' ')}
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

      {/* Page Settings Chips Footer (Bottom) */}
      <div className="lightbox-settings-footer" onClick={onContentClick}>
        {settingsChips.map((chip, i) => (
          <div key={i} className="lightbox-setting-chip">
            <span className="chip-label">{chip.label}:</span>
            <span className="chip-val">{chip.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

export default Lightbox
