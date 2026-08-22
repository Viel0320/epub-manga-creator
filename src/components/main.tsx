import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'store/main'
import type { StoreBlobs } from 'store/blobs'
import Icon from './icon'
import { useI18n } from 'i18n'
import { db } from 'utils/db'
import { getPageLayoutInfo, getSpreadPairs } from 'utils/page-layout'
import { getPageEffectiveSize } from 'utils/page-size'
import { requestImportGlobal } from 'components/nav/actions'
import { usePageDrag } from 'hooks/usePageDrag'
import ToastContainer from './toast'

const THIS_YEAR = (new Date()).getFullYear()

const PageCard = observer(function(props: {
  pageItemIndex: number | null
  realPageIndex?: number | null
  blobItem?: StoreBlobs.ImageBlob | null
  spread?: 'center' | 'left' | 'right'
  blank: boolean
  onContextMenu?: (e: React.MouseEvent, pageIndex: number) => void
}) {
  const storeMain = useStore()
  const { ui: storeUI, book: storeBook, contents: storeContent, modePageSize } = storeMain
  const t = useI18n()

  // selection always stores the real page-array index; pageItemIndex is a
  // display-only number (shifted by 1 in "alone" cover mode)
  const onClickImage = useCallback(() => {
    storeUI.selectPageIndex(props.realPageIndex ?? null)
  }, [props.realPageIndex, storeUI])

  const handleContextMenu = (e: React.MouseEvent) => {
    if (props.realPageIndex !== undefined && props.realPageIndex !== null && props.realPageIndex > 0) {
      e.preventDefault()
      e.stopPropagation()
      if (props.onContextMenu) {
        props.onContextMenu(e, props.realPageIndex)
      }
    }
  }

  const isDraggable = props.realPageIndex !== null && props.realPageIndex !== undefined && props.realPageIndex !== 0
  const isDropTarget = props.realPageIndex !== null && props.realPageIndex !== undefined

  const handleDrop = useCallback((sourceIndex: number, targetIndex: number) => {
    storeMain.movePage(sourceIndex, targetIndex)
  }, [storeMain])

  const { onPointerDown } = usePageDrag({
    pageIndex: props.realPageIndex,
    draggable: isDraggable,
    onDrop: handleDrop,
  })

  if (props.pageItemIndex === null) {
    return (
      <div className="card"><div className="card-image"></div></div>
    )
  }

  let preserveAspectRatio = 'none'

  if (storeBook.pageFit !== 'fill') {
    // 预览专属：左右页贴书脊对齐以模拟跨页观感；导出为标准 EPUB 每页居中（xMidYMid）
    const alignPos = props.spread === 'left' ? 'xMaxYMid ' : (props.spread === 'right' ? 'xMinYMid ' : 'xMidYMid ')
    preserveAspectRatio = alignPos + (storeBook.pageFit === 'contain' ? 'meet' : 'slice')
  }

  const imageFocus = props.realPageIndex !== undefined && props.realPageIndex !== null && (storeUI.selectedPageIndex === props.realPageIndex)
  const pageItem = props.realPageIndex !== undefined && props.realPageIndex !== null ? storeBook.pages[props.realPageIndex] : null
  const effectiveSize = getPageEffectiveSize(pageItem, props.blobItem, storeBook.pageSizeMode, storeBook.pageSize, modePageSize)

  return (
    <div
      className={`card${isDraggable ? ' is-draggable' : ''}`}
      data-page-index={isDropTarget ? props.realPageIndex : undefined}
      onPointerDown={onPointerDown}
      onContextMenu={handleContextMenu}
    >
      {
        props.realPageIndex !== undefined && props.realPageIndex !== null && props.realPageIndex in storeContent.indexMap
          ? <div className="bookmark-ribbon" title={storeContent.list[storeContent.indexMap[props.realPageIndex]].title} />
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
              if (previewIdx !== null && previewIdx >= 0) {
                storeUI.openPreview(previewIdx)
              }
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
            viewBox={'0 0 ' + effectiveSize.join(' ')}
            preserveAspectRatio={preserveAspectRatio}
            onClick={onClickImage}
          >
            <rect x="0" y="0" width="100%" height="100%" fill={storeBook.pageBackgroundColor === 'white' ? '#fff' : '#000'}/>
            {
              props.blobItem ? (
                <image
                  width="100%"
                  height="100%"
                  preserveAspectRatio={preserveAspectRatio}
                  href={props.blobItem.thumbnailURL}
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
        props.pageItemIndex === null && !(props.realPageIndex === 0 && storeBook.coverPosition === 'alone')
          ? null
          : <div className="page-num">{props.realPageIndex === 0 && storeBook.coverPosition === 'alone' ? t.page.cover : props.pageItemIndex! + 1}</div>
      }
    </div>
  )
})

const DoublePageCard = observer(function(props: {
  pages: [number | null, number | null]
  onContextMenu?: (e: React.MouseEvent, pageIndex: number) => void
}) {
  const { book: storeBook, blobs, ui } = useStore()
  const t = useI18n()

  const leftSidePageIndex = storeBook.pageDirection === 'right' ? props.pages[1] : props.pages[0]
  const rightSidePageIndex = storeBook.pageDirection === 'right' ? props.pages[0] : props.pages[1]
  const leftSidePage = leftSidePageIndex === null ? null : storeBook.pages[leftSidePageIndex]
  const rightSidePage = rightSidePageIndex === null ? null : storeBook.pages[rightSidePageIndex]
  const coverPosition = storeBook.coverPosition === 'alone' ? 1 : 0

  const isLeftSpreadCenter = leftSidePage?.customSpread === 'center'
  const isRightSpreadCenter = rightSidePage?.customSpread === 'center'
  const isSpreadCenter = (leftSidePageIndex === null && rightSidePageIndex !== null) ||
                         (leftSidePageIndex !== null && rightSidePageIndex === null) ||
                         isLeftSpreadCenter || isRightSpreadCenter

  if (isSpreadCenter) {
    let singleIndex: number
    if (isLeftSpreadCenter) {
      singleIndex = leftSidePageIndex as number
    } else if (isRightSpreadCenter) {
      singleIndex = rightSidePageIndex as number
    } else {
      singleIndex = (leftSidePageIndex !== null ? leftSidePageIndex : rightSidePageIndex) as number
    }

    const page = storeBook.pages[singleIndex]
    const isSingleSpecified = page?.customSpread === 'center'

    return (
      <div className={`card-group is-spread-center ${ui.containerBgFilled ? 'has-bg-filled' : ''}`}>
        <PageCard
          pageItemIndex={singleIndex - coverPosition}
          realPageIndex={singleIndex}
          blobItem={page ? blobs.blobs[page.blobID] : null}
          spread="center"
          blank={page?.blank || false}
          onContextMenu={props.onContextMenu}
        />
        {isSingleSpecified && (
          <div className="card-group-badge">{t.option.singlePageBadge || '单页指定'}</div>
        )}
      </div>
    )
  }

  const isRightJP = storeBook.pageDirection === 'right'

  const leftLayout = leftSidePageIndex !== null ? getPageLayoutInfo({
    pageIndex: leftSidePageIndex,
    coverPosition: storeBook.coverPosition,
    pageDirection: storeBook.pageDirection,
    pageFitSetting: storeBook.pageFit,
    customSpread: leftSidePage?.customSpread,
    isFirstInPair: isRightJP ? false : true
  }) : null

  const rightLayout = rightSidePageIndex !== null ? getPageLayoutInfo({
    pageIndex: rightSidePageIndex,
    coverPosition: storeBook.coverPosition,
    pageDirection: storeBook.pageDirection,
    pageFitSetting: storeBook.pageFit,
    customSpread: rightSidePage?.customSpread,
    isFirstInPair: isRightJP ? true : false
  }) : null

  const isExplicitBound = (leftSidePage?.customSpread === 'bind-next' && rightSidePage?.customSpread === 'bind-prev') ||
                          (leftSidePage?.customSpread === 'bind-prev' && rightSidePage?.customSpread === 'bind-next')

  return (
    <div className={`card-group ${ui.containerBgFilled ? 'has-bg-filled' : ''}`}>
      <PageCard
        pageItemIndex={leftSidePageIndex === null ? null : (leftSidePageIndex - coverPosition)}
        realPageIndex={leftSidePageIndex}
        blobItem={leftSidePage ? blobs.blobs[leftSidePage.blobID] : null}
        spread={leftLayout ? leftLayout.spread : 'center'}
        blank={leftSidePage?.blank || false}
        onContextMenu={props.onContextMenu}
      />
      <PageCard
        pageItemIndex={rightSidePageIndex === null ? null : (rightSidePageIndex - coverPosition)}
        realPageIndex={rightSidePageIndex}
        blobItem={rightSidePage ? blobs.blobs[rightSidePage.blobID] : null}
        spread={rightLayout ? rightLayout.spread : 'center'}
        blank={rightSidePage?.blank || false}
        onContextMenu={props.onContextMenu}
      />
      {isExplicitBound && (
        <div className="card-group-badge">{t.option.boundSpreadBadge || '跨页绑定'}</div>
      )}
    </div>
  )
})

const SinglePageCard = observer(function(props: {
  pageIndex: number
  onContextMenu?: (e: React.MouseEvent, pageIndex: number) => void
}) {
  const { book: storeBook, blobs, ui } = useStore()
  const t = useI18n()
  const realPageIndex = props.pageIndex
  const page = storeBook.pages[realPageIndex]
  const coverPosition = storeBook.coverPosition === 'alone' ? 1 : 0

  const isSingleSpecified = page?.customSpread === 'center'
  const isExplicitBound = page?.customSpread === 'bind-next' || page?.customSpread === 'bind-prev'

  const layout = getPageLayoutInfo({
    pageIndex: realPageIndex,
    coverPosition: storeBook.coverPosition,
    pageDirection: storeBook.pageDirection,
    pageFitSetting: storeBook.pageFit,
    customSpread: page?.customSpread,
    isSingle: true
  })

  return (
    <div className={`card-group is-single ${ui.containerBgFilled ? 'has-bg-filled' : ''}`}>
      <PageCard
        pageItemIndex={realPageIndex - coverPosition}
        realPageIndex={realPageIndex}
        blobItem={page ? blobs.blobs[page.blobID] : null}
        spread={layout.spread}
        blank={page?.blank || false}
        onContextMenu={props.onContextMenu}
      />
      {isSingleSpecified && (
        <div className="card-group-badge">{t.option.singlePageBadge || '单页指定'}</div>
      )}
      {isExplicitBound && (
        <div className="card-group-badge">{t.option.boundSpreadBadge || '跨页绑定'}</div>
      )}
    </div>
  )
})

// read the CSS vars on every layout pass (not once at module load) so
// media-query overrides take effect after resizes / orientation changes
function readCardMetrics(): { width: number; margin: number } {
  if (typeof window !== 'undefined') {
    try {
      const computedStyle = getComputedStyle(document.documentElement);
      return {
        width: parseFloat(computedStyle.getPropertyValue('--card-box-width')) || 280,
        margin: parseFloat(computedStyle.getPropertyValue('--card-box-margin')) || 7,
      };
    } catch (e) {
      // SSR fallback below
    }
  }
  return { width: 280, margin: 7 };
}

const RestoreBanner = observer(function() {
  const { setAutoSaveActive, restoreWorkspace, isAutoSaveActive } = useStore()
  const t = useI18n()
  const [hasBackup, setHasBackup] = useState(false)

  useEffect(() => {
    db.getMetadata('active_book').then((backup) => {
      if (backup && backup.pages && backup.pages.length > 0) {
        setHasBackup(true)
      } else {
        setAutoSaveActive(true)
      }
    }).catch(err => {
      console.error('Failed to read backup from DB:', err)
      setAutoSaveActive(true)
    })
  }, [setAutoSaveActive])

  const onRestore = useCallback(() => {
    restoreWorkspace()
      .then(() => {
        setHasBackup(false)
        setAutoSaveActive(true)
      })
      .catch(err => {
        console.error('Failed to restore workspace:', err)
        setHasBackup(false)
        setAutoSaveActive(true)
      })
  }, [restoreWorkspace, setAutoSaveActive])

  const onDismiss = useCallback(() => {
    db.clearAll().then(() => {
      setHasBackup(false)
      setAutoSaveActive(true)
    }).catch(err => {
      console.error('Failed to clear backup:', err)
      setHasBackup(false)
      setAutoSaveActive(true)
    })
  }, [setAutoSaveActive])

  if (!hasBackup || isAutoSaveActive) return null

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

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  pageIndex: number | null
}

const PageContextMenu = observer(function(props: {
  state: ContextMenuState
  onClose: () => void
}) {
  const { book: storeBook } = useStore()
  const t = useI18n()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: props.state.y, left: props.state.x })

  useLayoutEffect(() => {
    if (props.state.visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const margin = 12

      let left = props.state.x
      let top = props.state.y

      if (left + rect.width > vw - margin) {
        left = Math.max(margin, vw - rect.width - margin)
      }
      if (left < margin) {
        left = margin
      }

      if (top + rect.height > vh - margin) {
        top = Math.max(margin, vh - rect.height - margin)
      }
      if (top < margin) {
        top = margin
      }

      setPos({ top, left })
    }
  }, [props.state.visible, props.state.x, props.state.y])

  if (!props.state.visible || props.state.pageIndex === null || props.state.pageIndex <= 0) return null

  const pageIdx = props.state.pageIndex
  const page = storeBook.pages[pageIdx]
  if (!page) return null

  const isCentered = page.customSpread === 'center'
  const isBoundPrev = page.customSpread === 'bind-prev' && storeBook.pages[pageIdx - 1]?.customSpread === 'bind-next'
  const isBoundNext = page.customSpread === 'bind-next' && storeBook.pages[pageIdx + 1]?.customSpread === 'bind-prev'

  const onToggleCenter = (e: React.MouseEvent) => {
    e.stopPropagation()
    storeBook.setPageCustomSpread(pageIdx, 'center')
    props.onClose()
  }

  const onToggleBindPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    storeBook.setPageCustomSpread(pageIdx, 'bind-prev')
    props.onClose()
  }

  const onToggleBindNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    storeBook.setPageCustomSpread(pageIdx, 'bind-next')
    props.onClose()
  }

  const canBindPrev = pageIdx > 1
  const canBindNext = pageIdx < storeBook.pages.length - 1

  return (
    <div
      ref={menuRef}
      className="page-context-menu"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="context-menu-item" onClick={onToggleCenter}>
        <span>{isCentered ? (t.option.removeSingle || '取消单页 (恢复自动)') : (t.option.setSingle || '设为单页')}</span>
      </button>

      {canBindPrev && (
        <button type="button" className="context-menu-item" onClick={onToggleBindPrev}>
          <span>{isBoundPrev ? (t.option.removeBindPrev || '取消跨页绑定') : (t.option.bindPrev || '绑定跨页（前一张）')}</span>
        </button>
      )}

      {canBindNext && (
        <button type="button" className="context-menu-item" onClick={onToggleBindNext}>
          <span>{isBoundNext ? (t.option.removeBindNext || '取消跨页绑定') : (t.option.bindNext || '绑定跨页（后一张）')}</span>
        </button>
      )}
    </div>
  )
})

const Main = function() {
  const mainRef = useRef<HTMLElement>(null)
  const { book: storeBook, ui, modePageSize } = useStore()
  const [showPages, setShowPages] = useState<any[][]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    pageIndex: null,
  })
  const t = useI18n()

  const onPageContextMenu = useCallback((e: React.MouseEvent, pageIndex: number) => {
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      pageIndex,
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => (prev.visible ? { ...prev, visible: false } : prev))
  }, [])

  const pagesVersionKey = storeBook.pages.map(p => `${p.blobID}_${p.customSpread || 'auto'}`).join(',')

  const pageResizeCallback = useCallback(() => {
    const mainEl = mainRef.current
    if (!mainEl) return

    // use the actual computed padding so media-query overrides stay in sync
    const mainStyle = getComputedStyle(mainEl)
    const horizontalPadding = (parseFloat(mainStyle.paddingLeft) || 0) + (parseFloat(mainStyle.paddingRight) || 0)
    const availableWidth = mainEl.clientWidth - horizontalPadding
    if (availableWidth <= 0) return

    const { width: cardBaseWidth, margin: cardMargin } = readCardMetrics()
    const isSingle = storeBook.pageShow === 'one'
    const cardBoxWidth = isSingle ? cardBaseWidth / 2 : cardBaseWidth
    const cardTotalWidth = cardBoxWidth + cardMargin * 2
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
      const pairs = storeBook.spreadPairs
      const rows: [number | null, number | null][][] = []
      let currentRow: [number | null, number | null][] = []

      for (const pair of pairs) {
        let pageItemPair: [number | null, number | null]
        if (pair.length === 1) {
          if (pair[0] === 0) {
            pageItemPair = [null, 0]
          } else {
            pageItemPair = [pair[0], null]
          }
        } else {
          pageItemPair = [pair[0], pair[1]]
        }

        currentRow.push(pageItemPair)
        if (currentRow.length >= boxCountInOneRow) {
          rows.push(currentRow)
          currentRow = []
        }
      }
      if (currentRow.length > 0) {
        rows.push(currentRow)
      }
      setShowPages(rows)
    }
  }, [storeBook.coverPosition, storeBook.pages.length, storeBook.pageShow, pagesVersionKey, modePageSize])

  const onClickImportType = useCallback((type: 'image' | 'zip' | 'epub') => {
    requestImportGlobal(type)
  }, [])

  useEffect(() => {
    pageResizeCallback()
  }, [storeBook.pageShow, pagesVersionKey, pageResizeCallback])

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
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('scroll', closeContextMenu, true)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('scroll', closeContextMenu, true)
    }
  }, [pageResizeCallback, closeContextMenu])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (ui.isPreviewOpen) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          ui.navigatePreview(
            'left',
            storeBook.pageDirection,
            storeBook.spreadPairs,
            storeBook.pages.length
          )
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          ui.navigatePreview(
            'right',
            storeBook.pageDirection,
            storeBook.spreadPairs,
            storeBook.pages.length
          )
        } else if (e.code === 'Escape' || e.code === 'Space') {
          e.preventDefault()
          ui.closePreview()
        }
        return
      }

      if (ui.selectedPageIndex !== null) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          ui.openPreview(ui.selectedPageIndex)
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
          <div className="main-empty-container">
            <div className="main-app-header">
              <h1 className="main-app-title">{t.main.appTitle}</h1>
              <p className="main-app-subtitle">{t.main.appSubtitle}</p>
              <div className="main-app-maintainer-row">
                <span>{t.main.appMaintainer}</span>
                <a
                  href="https://github.com/Viel0320/epub-manga-creator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="main-app-github-link"
                  title="GitHub Repository"
                >
                  <Icon name="github" />
                  <span>GitHub</span>
                </a>
              </div>
            </div>
            <div className="main-input-card">
              <div className="main-input-title">{t.main.import}</div>
              <div className="main-input-actions">
                <button
                  type="button"
                  className="btn btn-primary main-input-btn"
                  onClick={() => onClickImportType('image')}
                >
                  <Icon name="upload" />
                  <span>{t.nav.importImage}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary main-input-btn"
                  onClick={() => onClickImportType('zip')}
                >
                  <Icon name="save" />
                  <span>{t.nav.importZip}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary main-input-btn"
                  onClick={() => onClickImportType('epub')}
                >
                  <Icon name="book" />
                  <span>{t.nav.importEpub}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          showPages.map((row, i) => (
            <div
              key={i}
              className={`row page-row flex-nowrap justify-content-center ${storeBook.pageDirection === 'right' ? 'flex-row-reverse' : ''}`}
            >
              {
                storeBook.pageShow === 'one'
                  ? (row as number[]).map((pageIdx, j) => {
                      const page = storeBook.pages[pageIdx]
                      return <SinglePageCard key={`${i}-${j}-${pageIdx}-${page?.blobID}`} pageIndex={pageIdx} onContextMenu={onPageContextMenu} />
                    })
                  : (row as [number | null, number | null][]).map((pages, j) => {
                      const p0 = pages[0] !== null ? storeBook.pages[pages[0]] : null
                      const p1 = pages[1] !== null ? storeBook.pages[pages[1]] : null
                      return <DoublePageCard key={`${i}-${j}-${pages[0]}-${pages[1]}-${p0?.blobID}-${p1?.blobID}`} pages={pages} onContextMenu={onPageContextMenu} />
                    })
              }
            </div>
          ))
        )
      }
      <PageContextMenu state={contextMenu} onClose={closeContextMenu} />
      <ToastContainer />
    </main>
  )
}

export default observer(Main)