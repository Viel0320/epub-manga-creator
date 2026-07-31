import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import storeMain, { useStore } from 'store/main'
import storeBlobs, { StoreBlobs } from 'store/blobs'
import Icon from './icon'
import { useI18n } from 'i18n'
import { db } from 'utils/db'

const THIS_YEAR = (new Date()).getFullYear()

const PageCard = observer(function(props: {
  pageItemIndex: number | null
  realPageIndex?: number | null
  blobItem?: StoreBlobs.ImageBlob | null
  pagePosition: 'center' | 'left' | 'right'
  blank: boolean
}) {
  const { ui: storeUI, book: storeBook, contents: storeContent } = useStore()
  const t = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<'left' | 'right' | null>(null)

  const onClickImage = useCallback(() => {
    storeMain.ui.selectPageIndex(props.pageItemIndex)
  }, [props.pageItemIndex])

  if (props.pageItemIndex === null) {
    return (
      <div className="card"><div className="card-image"></div></div>
    )
  }

  const isDraggable = props.realPageIndex !== null && props.realPageIndex !== undefined && props.realPageIndex !== 0
  const isDropTarget = props.realPageIndex !== null && props.realPageIndex !== undefined

  const onDragStart = (e: React.DragEvent) => {
    if (!isDraggable) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', String(props.realPageIndex))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const onDragEnd = () => {
    setIsDragging(false)
    setDragPosition(null)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!isDropTarget) return
    e.preventDefault()

    const rect = e.currentTarget.getBoundingClientRect()
    const isAfter = (e.clientX - rect.left) > (rect.width / 2)
    const position = isAfter ? 'right' : 'left'

    const isRTL = storeBook.pageDirection === 'right'
    let gap: number
    if (isRTL) {
      gap = position === 'left' ? props.realPageIndex! + 1 : props.realPageIndex!
    } else {
      gap = position === 'right' ? props.realPageIndex! + 1 : props.realPageIndex!
    }

    if (gap <= 0) {
      setDragPosition(null)
      e.dataTransfer.dropEffect = 'none'
      return
    }

    e.dataTransfer.dropEffect = 'move'
    setDragPosition(position)
  }

  const onDragLeave = () => {
    if (!isDropTarget) return
    setDragPosition(null)
  }

  const onDrop = (e: React.DragEvent) => {
    if (!isDropTarget) return
    e.preventDefault()
    const position = dragPosition
    setDragPosition(null)

    const sourceIndexStr = e.dataTransfer.getData('text/plain')
    if (!sourceIndexStr) return
    const sourceIndex = Number(sourceIndexStr)
    const targetIndex = props.realPageIndex as number

    if (!isNaN(sourceIndex) && sourceIndex > 0 && sourceIndex < storeBook.pages.length) {
      const isRTL = storeBook.pageDirection === 'right'
      let gap: number
      if (isRTL) {
        gap = position === 'left' ? targetIndex + 1 : targetIndex
      } else {
        gap = position === 'right' ? targetIndex + 1 : targetIndex
      }

      if (gap <= 0) return

      let insertIndex = gap
      if (sourceIndex < gap) {
        insertIndex = gap - 1
      }
      storeMain.movePage(sourceIndex, insertIndex)
    }
  }

  let preserveAspectRatio = 'none'

  if (storeBook.pageFit !== 'stretch') {
    preserveAspectRatio = props.pagePosition === 'center'
      ? 'xMidYMid '
      : props.pagePosition === 'left'
        ? 'xMinYMid '
        : 'xMaxYMid '

    if (storeBook.pageFit === 'fit') {
      preserveAspectRatio += 'meet'
    } else { // props.imageFit === 'fill'
      preserveAspectRatio += 'slice'
    }
  }

  const imageFocus = props.pageItemIndex !== null && (storeUI.selectedPageIndex === props.pageItemIndex)

  return (
    <div
      className={`card ${isDragging ? 'is-dragging' : ''} ${dragPosition ? `drag-over-${dragPosition}` : ''}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {
        props.pageItemIndex in storeContent.indexMap
          ? <div className="bookmark-ribbon" title={storeContent.list[storeContent.indexMap[props.pageItemIndex]].title} />
          : null
      }
      {
        props.pageItemIndex !== null && (props.blobItem || props.blank) && (
          <button
            type="button"
            className="zoom-btn"
            title={t.main.zoomPreview}
            onClick={(e) => {
              e.stopPropagation()
              const previewIdx = props.realPageIndex ?? props.pageItemIndex
              storeMain.ui.openPreview(previewIdx as number)
            }}
          >
            <Icon name="zoom" />
          </button>
        )
      }
      {
        props.blobItem || (!props.blobItem && props.blank) ? (
          <svg
            className="card-image"
            viewBox={'0 0 ' + storeBook.pageSize.join(' ')} onClick={onClickImage}
          >
            <rect x="0" y="0" width="100%" height="100%" fill={storeBook.pageBackgroundColor === 'white' ? '#fff' : '#000'}/>
            {
              props.blobItem ? (
                <image
                  width="100%"
                  height="100%"
                  preserveAspectRatio={preserveAspectRatio}
                  xlinkHref={props.blobItem.thumbnailURL}
                />
              ) : null
            }
            {
              !imageFocus ? null :
                <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="rgba(49,132,253,.5)" strokeWidth="8%"/>
            }
          </svg>
        ) : (
          <div className="card-image">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        )
      }
      {
        props.pageItemIndex === null
          ? null
          : <div className="page-num">{props.pageItemIndex + 1}</div>
      }
    </div>
  )
})

const DoublePageCard = observer(function(props: {
  pages: [number | null, number | null]
}) {
  const { book: storeBook } = useStore()

  const leftSidePageIndex = storeBook.pageDirection === 'right' ? props.pages[1] : props.pages[0]
  const rightSidePageIndex = storeBook.pageDirection === 'right' ? props.pages[0] : props.pages[1]
  const leftSidePage = leftSidePageIndex === null ? null : storeBook.pages[leftSidePageIndex]
  const rightSidePage = rightSidePageIndex === null ? null : storeBook.pages[rightSidePageIndex]
  const coverPosition = storeBook.coverPosition === 'alone' ? 1 : 0

  return (
    <div className="card-group">
      <PageCard
        pageItemIndex={leftSidePageIndex === null ? null : (leftSidePageIndex - coverPosition)}
        realPageIndex={leftSidePageIndex}
        blobItem={leftSidePage ? storeBlobs.blobs[leftSidePage.blobID] : null}
        pagePosition={storeBook.pagePosition === 'between' ? 'left' : 'center'}
        blank={leftSidePage?.blank || false}
      />
      <PageCard
        pageItemIndex={rightSidePageIndex === null ? null : (rightSidePageIndex - coverPosition)}
        realPageIndex={rightSidePageIndex}
        blobItem={rightSidePage ? storeBlobs.blobs[rightSidePage.blobID] : null}
        pagePosition={storeBook.pagePosition === 'between' ? 'right' : 'center'}
        blank={rightSidePage?.blank || false}
      />
    </div>
  )
})

const SinglePageCard = observer(function(props: {
  pageIndex: number
}) {
  const { book: storeBook } = useStore()
  const realPageIndex = props.pageIndex
  const page = storeBook.pages[realPageIndex]
  const coverPosition = storeBook.coverPosition === 'alone' ? 1 : 0

  return (
    <div className="card-group is-single">
      <PageCard
        pageItemIndex={realPageIndex - coverPosition}
        realPageIndex={realPageIndex}
        blobItem={page ? storeBlobs.blobs[page.blobID] : null}
        pagePosition="center"
        blank={page?.blank || false}
      />
    </div>
  )
})

let CARD_BOX_WIDTH = 120;
let CARD_BOX_MARGIN = 8;

if (typeof window !== 'undefined') {
  try {
    const computedStyle = getComputedStyle(document.documentElement);
    CARD_BOX_WIDTH = +computedStyle.getPropertyValue('--card-box-width').slice(0, -2) || 120;
    CARD_BOX_MARGIN = +computedStyle.getPropertyValue('--card-box-margin').slice(0, -2) || 8;
  } catch (e) {
    // SSR Fallback
  }
}

const RestoreBanner = observer(function() {
  const t = useI18n()
  const [hasBackup, setHasBackup] = useState(false)

  useEffect(() => {
    db.getMetadata('active_book').then((backup) => {
      if (backup && backup.pages && backup.pages.length > 0) {
        setHasBackup(true)
      } else {
        storeMain.setAutoSaveActive(true)
      }
    }).catch(err => {
      console.error('Failed to read backup from DB:', err)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  const onRestore = useCallback(() => {
    storeMain.restoreWorkspace().then(() => {
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  const onDismiss = useCallback(() => {
    db.clearAll().then(() => {
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    }).catch(err => {
      console.error('Failed to clear backup:', err)
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  if (!hasBackup || storeMain.isAutoSaveActive) return null

  return (
    <div className="alert alert-info restore-alert-banner d-flex justify-content-between align-items-center" role="alert">
      <span>{t.main.restoreDetected}</span>
      <div className="d-flex gap-2 ms-3">
        <button className="btn btn-sm btn-primary" onClick={onRestore}>
          {t.main.restore}
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={onDismiss}>
          {t.main.dismiss}
        </button>
      </div>
    </div>
  )
})

const Main = function() {
  const mainRef = useRef<HTMLElement>(null)
  const { book: storeBook } = useStore()
  const [showPages, setShowPages] = useState<any[][]>([])
  const t = useI18n()

  const pageResizeCallback = useCallback(() => {
    const mainEl = mainRef.current
    if (!mainEl) return

    const availableWidth = mainEl.clientWidth - 36
    if (availableWidth <= 0) return

    const isSingle = storeBook.pageShow === 'one'
    const cardBoxWidth = isSingle ? CARD_BOX_WIDTH / 2 : CARD_BOX_WIDTH
    const cardTotalWidth = cardBoxWidth + CARD_BOX_MARGIN * 2
    const boxCountInOneRow = Math.max(1, Math.floor(availableWidth / cardTotalWidth))

    const len = storeBook.pages.length
    if (len === 0) {
      setShowPages([])
      return
    }

    if (isSingle) {
      const pages: number[][] = []
      let x = 0
      while (x < len) {
        const row: number[] = []
        for (let j = 0; j < boxCountInOneRow && x < len; j++) {
          row.push(x++)
        }
        if (row.length > 0) {
          pages.push(row)
        }
      }
      setShowPages(pages)
    } else {
      const pages: [number | null, number | null][][] = []
      let x = -1

      while (x < len - 1) {
        const row: [number | null, number | null][] = []
        for (let j = 0; j < boxCountInOneRow && x < len - 1; j++) {
          const page1 = storeBook.coverPosition === 'first-page'
            ? (x === -1 ? null : (++x < len ? x : null))
            : (++x < len ? x : null)
          const page2 = ++x < len ? x : null
          row.push([page1, page2])
        }
        if (row.length > 0) {
          pages.push(row)
        }
      }

      setShowPages(pages)
    }
  }, [storeBook.coverPosition, storeBook.pages.length, storeBook.pageShow])

  const onClickImport = useCallback(() => {
    document.getElementById('input-upload')?.click()
  }, [])

  useEffect(() => {
    pageResizeCallback()
  }, [storeBook.pages, storeBook.pageShow, pageResizeCallback])

  useEffect(() => {
    // rAF-throttled resize handler, cleaned up on unmount
    let scheduled = false
    const onResize = () => {
      if (scheduled) {
        return
      }
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        pageResizeCallback()
      })
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [pageResizeCallback])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (storeMain.ui.isPreviewOpen) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          storeMain.ui.navigatePreview(
            'left',
            storeBook.pageDirection,
            storeBook.pageShow,
            storeBook.coverPosition,
            storeBook.pages.length
          )
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          storeMain.ui.navigatePreview(
            'right',
            storeBook.pageDirection,
            storeBook.pageShow,
            storeBook.coverPosition,
            storeBook.pages.length
          )
        } else if (e.code === 'Escape' || e.code === 'Space') {
          e.preventDefault()
          storeMain.ui.closePreview()
        }
        return
      }

      if (storeMain.ui.selectedPageIndex !== null) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          storeMain.ui.openPreview(storeMain.ui.selectedPageIndex)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [storeBook.pages.length])

  return (
    <main id="main" className="pt-4 pb-4" ref={mainRef}>
      <RestoreBanner />
      {
        showPages.length === 0 ? (
          import.meta.env.DEV
            ? <div className="btn btn-secondary main-input-upload" onClick={onClickImport}>{t.main.import}</div>
            : <div className="alert alert-secondary text-center" role="alert">{t.main.ready}</div>
        ) : (
          showPages.map((row, i) => (
            <div
              key={i}
              className={`row page-row flex-nowrap justify-content-center ${storeBook.pageDirection === 'right' ? 'flex-row-reverse' : ''}`}
            >
              {
                storeBook.pageShow === 'one'
                  ? (row as number[]).map((pageIdx, j) => (
                      <SinglePageCard key={`${i}-${j}-${pageIdx}`} pageIndex={pageIdx} />
                    ))
                  : (row as [number | null, number | null][]).map((pages, j) => (
                      <DoublePageCard key={`${i}-${j}-${pages[0]}-${pages[1]}`} pages={pages} />
                    ))
              }
            </div>
          ))
        )
      }
      <div className="author-info">
        <div>{THIS_YEAR} Joycai@Github</div>
        <iframe
          title="ghbtns"
          className="ghbtns"
          src="https://ghbtns.com/github-btn.html?user=Joycai&amp;repo=epub-manga-creator&amp;type=star&amp;count=true"
          frameBorder="0"
          scrolling="0"
          width="80px"
          height="20px"
        />
      </div>
    </main>
  )
}

export default observer(Main)