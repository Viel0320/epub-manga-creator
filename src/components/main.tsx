import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useMount } from 'react-use'
import storeMain, { useStore } from 'store/main'
import storeBlobs, { StoreBlobs } from 'store/blobs'
import Icon from './icon'
import { useI18n } from 'i18n'
import { db } from 'utils/db'

const THIS_YEAR = (new Date()).getFullYear()

const PageCard = observer(function(props: {
  pageItemIndex: number | null
  blobItem?: StoreBlobs.ImageBlob | null
  pagePosition: 'center' | 'left' | 'right'
  blank: boolean
}) {
  const { ui: storeUI, book: storeBook, contents: storeContent } = useStore()

  const onClickImage = useCallback(() => {
    storeMain.ui.selectPageIndex(props.pageItemIndex)
  }, [props.pageItemIndex])

  if (props.pageItemIndex === null) {
    return (
      <div className="card"><div className="card-image"></div></div>
    )
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
    <div className="card">
      {
        props.pageItemIndex in storeContent.indexMap
          ? <div className="bookmark-ribbon" title={storeContent.list[storeContent.indexMap[props.pageItemIndex]].title} />
          : null
      }
      {
        (props.blobItem || (!props.blobItem && props.blank)) ? (
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
        blobItem={leftSidePage ? storeBlobs.blobs[leftSidePage.blobID] : null}
        pagePosition={storeBook.pagePosition === 'between' ? 'left' : 'center'}
        blank={leftSidePage?.blank || false}
      />
      <div className="book-spine" />
      <PageCard
        pageItemIndex={rightSidePageIndex === null ? null : (rightSidePageIndex - coverPosition)}
        blobItem={rightSidePage ? storeBlobs.blobs[rightSidePage.blobID] : null}
        pagePosition={storeBook.pagePosition === 'between' ? 'right' : 'center'}
        blank={rightSidePage?.blank || false}
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
  const { ui } = useStore()
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
    <div className="alert alert-info d-flex justify-content-between align-items-center" role="alert">
      <span>
        {ui.lang === 'zh'
          ? '检测到您上次未完成的项目，是否恢复进度？'
          : 'Detected a backup from your last session. Would you like to restore it?'}
      </span>
      <div>
        <button className="btn btn-sm btn-primary me-2" onClick={onRestore}>
          {ui.lang === 'zh' ? '恢复' : 'Restore'}
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={onDismiss}>
          {ui.lang === 'zh' ? '忽略' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
})

const Main = function() {
  const mainRef = useRef<HTMLElement>(null)
  const { book: storeBook } = useStore()
  const [showPages, setShowPages] = useState<[any, any][][]>([])
  const t = useI18n()

  const pageResizeCallback = useCallback(() => {
    const pageWidth = mainRef.current?.clientWidth
    if (!pageWidth) {
      return
    }

    const boxCountInOneRow = Math.floor(pageWidth / (CARD_BOX_WIDTH + CARD_BOX_MARGIN * 2))
    const rowCount = Math.ceil((1 + storeBook.pages.length) / boxCountInOneRow / 2)

    // if (maxCardBoxCountInOneRow === boxCountInOneRow) {
    //   return
    // }

    if (storeBook.pages.length === 0) {
      // setMaxCardBoxCountInOneRow(boxCountInOneRow)
      setShowPages([])
      return
    }

    let i = 0
    let j = 0
    let x = -1

    const pages: [any, any][][] = []
    const len = storeBook.pages.length

    while(i++ < rowCount) {
      const r: [number | null, number | null][] = []
      while(j++ < boxCountInOneRow) {
        r.push([
          storeBook.coverPosition === 'first-page'
            ? x === -1 ? null : ++x < len ? x : null
            : ++x < len ? x : null,
          ++x < len ? x : null
        ])
      }
      j = 0
      pages.push(storeBook.pageDirection === 'right' ? r.reverse() : r)
    }

    // setMaxCardBoxCountInOneRow(boxCountInOneRow)
    setShowPages(pages)
  }, [storeBook.coverPosition, storeBook.pageDirection, storeBook.pages.length])

  const onClickImport = useCallback(() => {
    document.getElementById('input-upload')?.click()
  }, [])

  useEffect(() => {
    pageResizeCallback()
  }, [storeBook.pages, pageResizeCallback])

  useMount(() => {
    pageResizeCallback()
    // TODO: 需要throttle优化
    window.addEventListener('resize', pageResizeCallback)
  })

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
            <div key={i} className="row page-row justify-content-evenly">
              {
                row.map((pages, j) => (<DoublePageCard key={`${i}-${j}-${pages[0]}-${pages[1]}`} pages={pages}/>))
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