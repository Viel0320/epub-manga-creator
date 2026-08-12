import JSZip from 'jszip'
import { observer } from 'mobx-react'
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import Icon from 'components/icon'
import { useStore } from 'store/main'
import { useI18n } from 'i18n'
import { detectImageMime } from 'utils/epub-parser'

type SupportType = 'image' | 'zip' | 'epub'

const PageControl = observer(function(props: { pageIndex: number | null }) {
  const storeMain = useStore();
  const t = useI18n();
  const onUseImageSizeToPage = useCallback(() => {
    if (props.pageIndex !== null) {
      storeMain.useImageSizeToPage(props.pageIndex)
    }
  }, [props.pageIndex, storeMain])

  // in standalone-cover mode the cards are numbered without the cover,
  // so prompts must translate between displayed numbers and real indices
  const coverOffset = storeMain.book.coverPosition === 'alone' ? 1 : 0

  const onChangePageIndex = useCallback(() => {
    const max = storeMain.book.pages.length - coverOffset
    const inputValue = window.prompt(t.prompt.newPageIndex(max))
    let num = parseInt(inputValue || '')
    
    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.movePage(props.pageIndex as number, num - 1 + coverOffset)
  }, [props.pageIndex, storeMain, t, coverOffset])

  const onSetContentq = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    storeMain.setBookmark(
      +(e.currentTarget.dataset.index as string),
      props.pageIndex as number
    )
  }, [props.pageIndex, storeMain])

  const onSplitPage = useCallback(() => {
    if (props.pageIndex !== null) {
      storeMain.splitPage(props.pageIndex)
    }
  }, [props.pageIndex, storeMain])

  const onUndo = useCallback(() => {
    storeMain.undo()
  }, [storeMain])

  const onRemovePage = useCallback(() => {
    const realIndex = props.pageIndex as number
    const message = coverOffset && realIndex === 0
      ? t.prompt.removeCover
      : t.prompt.removePage(realIndex - coverOffset)
    const res = window.confirm(message)
    res && storeMain.removePage(realIndex)
  }, [props.pageIndex, storeMain, t, coverOffset])

  const onClickInsertBlankPage = useCallback(() => {
    if (props.pageIndex !== null && props.pageIndex >= 0 && props.pageIndex < storeMain.book.pages.length) {
      storeMain.insertBlankPage(props.pageIndex)
      storeMain.ui.selectPageIndex(props.pageIndex)
      return
    }

    const max = storeMain.book.pages.length - coverOffset
    const inputValue = window.prompt(t.prompt.insertPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.insertBlankPage(num - 1 + coverOffset)
    storeMain.ui.selectPageIndex(num - 1 + coverOffset)
  }, [props.pageIndex, storeMain, t, coverOffset])

  const undoButton = (
    <div className="nav-item">
      <button
        type="button"
        className={`btn ${storeMain.undoStore.canUndo ? 'btn-secondary' : 'btn-outline-secondary disabled'}`}
        disabled={!storeMain.undoStore.canUndo}
        onClick={onUndo}
        title={t.nav.undo}
      >
        <span className="nav-icon-box"><Icon name="undo"/></span>
        <span className="nav-label">{t.nav.undo}</span>
      </button>
    </div>
  )

  if (props.pageIndex === null) {
    return (
      <>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="ruler"/></span>
            <span className="nav-label">{t.nav.ruler}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="menu"/></span>
            <span className="nav-label">{t.nav.move}</span>
          </button>
        </div>
        <div className="nav-item">
          <button
            type="button"
            className={`btn ${storeMain.book.pages.length === 0 ? 'btn-outline-secondary disabled' : 'btn-secondary'}`}
            disabled={storeMain.book.pages.length === 0}
            onClick={onClickInsertBlankPage}
            title={t.nav.insertBlankPage}
          >
            <span className="nav-icon-box"><Icon name="notification"/></span>
            <span className="nav-label">{t.nav.insertBlankPage}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="bookmark"/></span>
            <span className="nav-label">{t.nav.bookmark}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="scissors"/></span>
            <span className="nav-label">{t.nav.split}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="cross"/></span>
            <span className="nav-label">{t.nav.delete}</span>
          </button>
        </div>
        {undoButton}
      </>
    )
  }

  const blankPage = storeMain.book.pages[props.pageIndex]?.blank ?? false

  return (
    <>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onUseImageSizeToPage}>
          <span className="nav-icon-box"><Icon name="ruler"/></span>
          <span className="nav-label">{t.nav.ruler}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onChangePageIndex}>
          <span className="nav-icon-box"><Icon name="menu"/></span>
          <span className="nav-label">{t.nav.move}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClickInsertBlankPage}
          title={t.nav.insertBlankPage}
        >
          <span className="nav-icon-box"><Icon name="notification"/></span>
          <span className="nav-label">{t.nav.insertBlankPage}</span>
        </button>
      </div>
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-secondary">
          <span className="nav-icon-box"><Icon name="bookmark"/></span>
          <span className="nav-label">{t.nav.bookmark}</span>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          {
            storeMain.contents.list.map((contentItem, index) =>
              <li key={index}>
                <span
                  className={"dropdown-item" + (contentItem.pageIndex === props.pageIndex ? ' active' : '')}
                  data-index={index}
                  onClick={onSetContentq}
                >
                  {contentItem.title}
                </span>
              </li>
            )
          }
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onSplitPage}>
          <span className="nav-icon-box"><Icon name="scissors"/></span>
          <span className="nav-label">{t.nav.split}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onRemovePage}>
          <span className="nav-icon-box"><Icon name="cross"/></span>
          <span className="nav-label">{t.nav.delete}</span>
        </button>
      </div>
      {undoButton}
    </>
  )
})

const AcceptMap = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif',
  zip: 'application/zip,.zip,.cbz,application/x-cbz',
  epub: 'application/epub+zip,.epub',
}

const MultipleAttrMap = {
  image: true,
  zip: false,
  epub: false,
}

const blobToFile = (theBlob: Blob, fileName: string): File => {
  return new File([theBlob], fileName, { type: theBlob.type })
}

const Header = function() {
  const storeMain = useStore();
  const { ui, book } = storeMain;
  const t = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputType, setInputType] = useState<SupportType>('zip')

  const onClickToggleBookVisible = useCallback(() => {
    ui.toggleBookVisible()
  }, [ui])
  const onClickToggleContentVisible = useCallback(() => {
    ui.toggleContentVisible()
  }, [ui])
  const onClickTogglePageVisible = useCallback(() => {
    ui.togglePageVisible()
  }, [ui])

  const onClickImport = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const newType = e.currentTarget.dataset.type as SupportType

    if (newType === inputType) {
      inputRef.current?.click()
    } else {
      setInputType(newType)
    }
  }, [inputType])

  const handleGetFile = useCallback(async () => {
    const input: HTMLInputElement = inputRef.current as HTMLInputElement

    if (inputType === 'epub' && (input?.files?.[0])) {
      storeMain.importFromEpub(input.files[0])
      return
    }

    if (inputType === 'zip' && (input?.files?.[0])) {
      const file = input.files[0]
      const fileName = file.name
      storeMain.ui.setLoading(true, t.loading.importingImages)
      try {
        const zipContent = await JSZip.loadAsync(file)
        // natural sort so "10.jpg" comes after "2.jpg"
        const zipFiles = Object.keys(zipContent.files)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .map((filename) => zipContent.files[filename])
          .filter(zipItem => !zipItem.dir)

        const fileResults = await Promise.all(zipFiles.map(async zipItem => {
          const uint8Array = await zipItem.async('uint8array')
          const bytes = new Uint8Array(uint8Array)
          const mimeType = detectImageMime(bytes)
          if (!mimeType) return null
          return blobToFile(new Blob([bytes], { type: mimeType }), zipItem.name)
        }))
        const files = fileResults.filter((f): f is File => f !== null)

        if (files.length === 0) {
          storeMain.ui.showToast(t.alert.zipNoImages, 'warning')
          return
        }

        await storeMain.importPageFromImages(files)
        if (storeMain.ui.firstImport) {
          storeMain.ui.toggleBookVisible(fileName)
        }
      } catch (err) {
        console.error('Failed to import archive:', err)
        storeMain.ui.showToast(t.alert.zipReadFailed, 'error')
      } finally {
        storeMain.ui.setLoading(false)
      }
      return
    }

    if (input?.files?.length) {
      storeMain.importPageFromImages(Array.from(input.files))
    }
  }, [inputType, storeMain, t])

  const onClickGenerate = useCallback(() => {
    storeMain.generateBook()
  }, [storeMain])

  const onCycleTheme = useCallback(() => {
    ui.cycleTheme()
  }, [ui])

  const onToggleContainerBg = useCallback(() => {
    ui.toggleContainerBgFilled()
  }, [ui])

  const onToggleLang = useCallback(() => {
    ui.toggleLang()
  }, [ui])

  const onClickReset = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm(t.confirm.reset)) {
      storeMain.resetWorkspace()
    }
  }, [storeMain, t])

  useLayoutEffect(() => {
    if (inputType) {
      inputRef.current?.click()
    }
  }, [inputType])

  return (
    <nav id="nav" className="navbar bg-dark">
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-primary" title={t.nav.import}>
          <span className="nav-icon-box"><Icon name="upload"/></span>
          <span className="nav-label">{t.nav.import}</span>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          <li><span className="dropdown-item" data-type="image" onClick={onClickImport}>{t.nav.importImage}</span></li>
          <li><span className="dropdown-item" data-type="zip" onClick={onClickImport}>{t.nav.importZip}</span></li>
          <li><span className="dropdown-item" data-type="epub" onClick={onClickImport}>{t.nav.importEpub}</span></li>
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleBookVisible} title={t.nav.book}>
          <span className="nav-icon-box"><Icon name="book"/></span>
          <span className="nav-label">{t.nav.book}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleContentVisible} title={t.nav.contents}>
          <span className="nav-icon-box"><Icon name="list"/></span>
          <span className="nav-label">{t.nav.contents}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickTogglePageVisible} title={t.nav.page}>
          <span className="nav-icon-box"><Icon name="tools"/></span>
          <span className="nav-label">{t.nav.page}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={book.pages.length === 0}
          onClick={onClickGenerate}
          title={t.nav.generate}
        >
          <span className="nav-icon-box"><Icon name="install"/></span>
          <span className="nav-label">{t.nav.generate}</span>
        </button>
      </div>
      <PageControl pageIndex={ui.selectedPageIndex}/>
      <div className="nav-item nav-bottom-group">
        <button
          type="button"
          className={`btn ${book.pages.length === 0 ? 'btn-outline-secondary disabled' : ui.containerBgFilled ? 'btn-primary' : 'btn-secondary'}`}
          disabled={book.pages.length === 0}
          onClick={onToggleContainerBg}
          title={ui.containerBgFilled ? t.nav.previewBgFilled : t.nav.previewBgTransparent}
        >
          <span className="nav-icon-box"><Icon name="document"/></span>
          <span className="nav-label">{t.nav.previewBg}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCycleTheme}
          title={
            { light: t.nav.themeLight, dark: t.nav.themeDark, auto: t.nav.themeAuto }[ui.theme]
          }
        >
          <span className="nav-icon-box">
            <Icon name={ui.theme === 'light' ? 'sun' : ui.theme === 'dark' ? 'moon' : 'theme-auto'}/>
          </span>
          <span className="nav-label">{t.nav.theme}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary nav-reset-btn"
          disabled={book.pages.length === 0}
          onClick={onClickReset}
          title={t.nav.reset}
        >
          <span className="nav-icon-box"><Icon name="trash"/></span>
          <span className="nav-label">{t.nav.reset}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onToggleLang}
          title={{ zh: t.nav.langZh, en: t.nav.langEn }[ui.lang]}
        >
          <span className="nav-icon-box"><Icon name="lang"/></span>
          <span className="nav-label">{{ zh: t.nav.langEn, en: t.nav.langZh }[ui.lang]}</span>
        </button>
      </div>
      <input
        key={inputType}
        id="input-upload"
        ref={inputRef}
        type="file"
        value=""
        accept={AcceptMap[inputType]}
        multiple={MultipleAttrMap[inputType]}
        onChange={handleGetFile}
        style={{display:"none"}}
      />
    </nav>
  )
}

export default observer(Header)