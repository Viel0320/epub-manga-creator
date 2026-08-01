import React, { useCallback, useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { useStore } from 'store/main'
import Icon from 'components/icon'
import { useI18n } from 'i18n'
import { getPageLayoutInfo, getSpreadPairs, CustomSpreadType } from 'utils/page-layout'
import { getPageEffectiveSize } from 'utils/page-size'

const PAGE_SIZE_PRESETS: { name: string; size: [number, number] }[] = [
  { name: 'Kindle', size: [1200, 1600] },
  { name: 'B4', size: [1250, 1765] },
  { name: 'B5', size: [880, 1250] },
  { name: 'A4', size: [1050, 1485] },
  { name: 'A5', size: [1480, 2100] },
  { name: 'CG 16:9', size: [1600, 900] },
  { name: 'CG 16:10', size: [1600, 1000] },
]

function getSpreadPair(
  index: number,
  pages: Array<{ customSpread?: CustomSpreadType }>,
  coverPosition: 'first-page' | 'alone',
  pageDirection: 'left' | 'right',
  pageShow: 'two' | 'one' = 'two',
  cachedPairs?: number[][]
): [number | null, number | null] {
  const totalPages = pages.length
  if (totalPages <= 0 || index < 0 || index >= totalPages) return [null, null]

  const pairs = cachedPairs || getSpreadPairs(pages, coverPosition, pageShow)
  const pair = pairs.find(p => p.includes(index))

  if (!pair || pair.length === 1) {
    const pVal = pair ? pair[0] : index
    return pageDirection === 'right' ? [null, pVal] : [pVal, null]
  }

  const [p1, p2] = pair
  return pageDirection === 'right' ? [p2, p1] : [p1, p2]
}

const Lightbox = observer(function() {
  const { ui, book, blobs, contents, modePageSize, displayPageSize } = useStore()
  const t = useI18n()

  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null)

  useEffect(() => {
    if (!activeMenuKey) return
    const handleGlobalClick = () => {
      setActiveMenuKey(null)
    }
    window.addEventListener('click', handleGlobalClick)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
    }
  }, [activeMenuKey])

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

  const pair = getSpreadPair(pageIndex, book.pages, book.coverPosition, book.pageDirection, book.pageShow, book.spreadPairs)
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

  const modeSize = modePageSize
  const displaySize = displayPageSize
  const pageDimensionsText = book.pageSizeMode === 'auto'
    ? `Auto (${displaySize[0]}×${displaySize[1]})`
    : `${displaySize[0]}×${displaySize[1]}`

  const sizeOptions = [
    {
      key: 'auto',
      label: `Auto (${modeSize[0]}×${modeSize[1]})`,
      active: book.pageSizeMode === 'auto',
      onClick: () => book.updateBookPageProperty('pageSizeMode', 'auto')
    },
    ...PAGE_SIZE_PRESETS.map((preset) => ({
      key: preset.name,
      label: `${preset.name} (${preset.size[0]}×${preset.size[1]})`,
      active: book.pageSizeMode === 'manual' && book.pageSize[0] === preset.size[0] && book.pageSize[1] === preset.size[1],
      onClick: () => {
        book.updateBookPageProperty('pageSizeMode', 'manual')
        book.updateBookPageProperty('pageSize', preset.size)
      }
    }))
  ]

  const settingsChips = [
    {
      key: 'size',
      label: t.page.size,
      value: book.pageSizeMode === 'auto' ? `Auto (${displaySize[0]}×${displaySize[1]})` : `${displaySize[0]}×${displaySize[1]}`,
      options: sizeOptions
    },
    {
      key: 'position',
      label: t.page.position,
      value: book.pagePosition === 'between' ? t.option.between : t.option.center,
      options: [
        {
          key: 'between',
          label: t.option.between,
          active: book.pagePosition === 'between',
          onClick: () => book.updateBookPageProperty('pagePosition', 'between')
        },
        {
          key: 'center',
          label: t.option.center,
          active: book.pagePosition === 'center',
          onClick: () => book.updateBookPageProperty('pagePosition', 'center')
        }
      ]
    },
    {
      key: 'show',
      label: t.page.show,
      value: book.pageShow === 'two' ? t.option.twoPages : t.option.onePage,
      options: [
        {
          key: 'two',
          label: t.option.twoPages,
          active: book.pageShow === 'two',
          onClick: () => book.updateBookPageProperty('pageShow', 'two')
        },
        {
          key: 'one',
          label: t.option.onePage,
          active: book.pageShow === 'one',
          onClick: () => book.updateBookPageProperty('pageShow', 'one')
        }
      ]
    },
    {
      key: 'fit',
      label: t.page.fit,
      value: book.pageFit === 'fit' ? t.option.fit : (book.pageFit === 'stretch' ? t.option.stretch : t.option.fill),
      options: [
        {
          key: 'fit',
          label: t.option.fit,
          active: book.pageFit === 'fit',
          onClick: () => book.updateBookPageProperty('pageFit', 'fit')
        },
        {
          key: 'stretch',
          label: t.option.stretch,
          active: book.pageFit === 'stretch',
          onClick: () => book.updateBookPageProperty('pageFit', 'stretch')
        },
        {
          key: 'fill',
          label: t.option.fill,
          active: book.pageFit === 'fill',
          onClick: () => book.updateBookPageProperty('pageFit', 'fill')
        }
      ]
    },
    {
      key: 'direction',
      label: t.page.direction,
      value: book.pageDirection === 'right' ? t.option.rightJP : t.option.left,
      options: [
        {
          key: 'right',
          label: t.option.rightJP,
          active: book.pageDirection === 'right',
          onClick: () => book.updateBookPageProperty('pageDirection', 'right')
        },
        {
          key: 'left',
          label: t.option.left,
          active: book.pageDirection === 'left',
          onClick: () => book.updateBookPageProperty('pageDirection', 'left')
        }
      ]
    },
    {
      key: 'cover',
      label: t.page.cover,
      value: book.coverPosition === 'first-page' ? t.option.firstPage : t.option.alone,
      options: [
        {
          key: 'first-page',
          label: t.option.firstPage,
          active: book.coverPosition === 'first-page',
          onClick: () => book.updateBookPageProperty('coverPosition', 'first-page')
        },
        {
          key: 'alone',
          label: t.option.alone,
          active: book.coverPosition === 'alone',
          onClick: () => book.updateBookPageProperty('coverPosition', 'alone')
        }
      ]
    },
    {
      key: 'imageTag',
      label: t.page.imageTag,
      value: book.imgTag === 'svg' ? '<svg />' : '<img />',
      options: [
        {
          key: 'svg',
          label: '<svg />',
          active: book.imgTag === 'svg',
          onClick: () => book.updateBookPageProperty('imgTag', 'svg')
        },
        {
          key: 'img',
          label: '<img />',
          active: book.imgTag === 'img',
          onClick: () => book.updateBookPageProperty('imgTag', 'img')
        }
      ]
    }
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
    } else if (blobItem && blobItem.width && blobItem.height) {
      originSizeStr = `${blobItem.width}×${blobItem.height}`
    }

    const listIdx = totalPages > 0 ? contents.indexMap[idx] : undefined
    const bookmarkTitle = listIdx !== undefined ? contents.list[listIdx]?.title : null

    const isRightJP = book.pageDirection === 'right'
    let isFirstInPair: boolean | undefined = undefined
    if (isTwoPages && side) {
      if (side === 'left') {
        isFirstInPair = isRightJP ? false : true
      } else if (side === 'right') {
        isFirstInPair = isRightJP ? true : false
      }
    }

    const layout = getPageLayoutInfo({
      pageIndex: idx,
      pages: book.pages,
      coverPosition: book.coverPosition,
      pageDirection: book.pageDirection,
      pagePositionSetting: book.pagePosition,
      pageFitSetting: book.pageFit,
      customSpread: page?.customSpread,
      isFirstInPair,
      isSingle: !isTwoPages || !side
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
            className={`lightbox-image ${ui.containerBgFilled ? 'has-bg-filled' : ''}`}
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
            className={`lightbox-spread-wrapper ${ui.containerBgFilled ? 'has-bg-filled' : ''}`}
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
        {settingsChips.map((chip) => {
          const isOpen = activeMenuKey === chip.key
          return (
            <div
              key={chip.key}
              className={`lightbox-setting-chip ${isOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setActiveMenuKey(isOpen ? null : chip.key)
              }}
            >
              <span className="chip-label">{chip.label}:</span>
              <span className="chip-val">{chip.value}</span>
              <span className="chip-arrow">▾</span>

              {isOpen && (
                <div
                  className="lightbox-menu-popover"
                  onClick={(e) => e.stopPropagation()}
                >
                  {chip.options.map((opt, idx) => (
                    <div
                      key={opt.key || idx}
                      className={`lightbox-menu-item ${opt.active ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        opt.onClick()
                        setActiveMenuKey(null)
                      }}
                    >
                      <span className="menu-item-check">{opt.active ? '✓' : ''}</span>
                      <span className="menu-item-label">{opt.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default Lightbox
