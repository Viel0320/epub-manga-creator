import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import storeMain, { useStore } from 'store/main'
import Icon from 'components/icon'
import { useI18n } from 'i18n'

const Lightbox = observer(function() {
  const { ui, book, blobs } = useStore()
  const t = useI18n()

  const onClose = useCallback(() => {
    ui.closePreview()
  }, [ui])

  const onPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    ui.prevPreviewPage()
  }, [ui])

  const onNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    ui.nextPreviewPage(book.pages.length)
  }, [ui, book.pages.length])

  const onContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  if (!ui.isPreviewOpen || ui.previewPageIndex === null) return null

  const pageIndex = ui.previewPageIndex
  const page = book.pages[pageIndex]
  
  if (!page) return null

  const isBlank = page.blank
  const blobItem = isBlank ? null : blobs.blobs[page.blobID]
  const imageURL = blobItem ? blobItem.blobURL : null

  // Find if this page has a bookmark title
  const listIndex = book.pages.length > 0 ? storeMain.contents.indexMap[pageIndex] : undefined
  const bookmarkTitle = listIndex !== undefined ? storeMain.contents.list[listIndex]?.title : null

  const isFirst = pageIndex === 0
  const isLast = pageIndex === book.pages.length - 1

  return (
    <div className="lightbox-container" onClick={onClose}>
      <div className="lightbox-content">
        {/* Floating Header */}
        <div className="lightbox-header">
          <span>{t.lightbox.page} {pageIndex + 1} / {book.pages.length}</span>
          {bookmarkTitle && (
            <>
              <span>•</span>
              <span className="page-title">{bookmarkTitle}</span>
            </>
          )}
          {isBlank && (
            <>
              <span>•</span>
              <span className="text-warning">{t.lightbox.blankPage}</span>
            </>
          )}
        </div>

        {/* Close Button */}
        <button type="button" className="lightbox-close-btn" onClick={onClose} title={t.lightbox.close}>
          <Icon name="cross" />
        </button>

        {/* Navigation Arrows */}
        <button
          type="button"
          className={`lightbox-nav-btn prev ${isFirst ? 'disabled' : ''}`}
          onClick={onPrev}
          disabled={isFirst}
          title={t.lightbox.prev}
        >
          <Icon name="chevron-left" />
        </button>

        {/* Image Display */}
        {isBlank ? (
          <div
            className="lightbox-image d-flex align-items-center justify-content-center"
            style={{
              width: `${book.pageSize[0]}px`,
              height: `${book.pageSize[1]}px`,
              backgroundColor: book.pageBackgroundColor === 'white' ? '#fff' : '#000',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
            onClick={onContentClick}
          >
            <span style={{ color: book.pageBackgroundColor === 'white' ? '#000' : '#fff', fontSize: '24px', fontWeight: 'bold' }}>
              {t.lightbox.blankPage}
            </span>
          </div>
        ) : imageURL ? (
          <img
            src={imageURL}
            alt={`Page ${pageIndex + 1}`}
            className="lightbox-image"
            onClick={onContentClick}
          />
        ) : (
          <div className="spinner-border text-primary" role="status"></div>
        )}

        <button
          type="button"
          className={`lightbox-nav-btn next ${isLast ? 'disabled' : ''}`}
          onClick={onNext}
          disabled={isLast}
          title={t.lightbox.next}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  )
})

export default Lightbox
