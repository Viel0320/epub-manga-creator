import JSZip from 'jszip'
import { observer } from 'mobx-react'
import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import Icon from 'components/icon'
import { StoreContext } from 'store/main'
import { useI18n } from 'i18n'

type SupportType = 'image' | 'zip' | 'epub'

const PageControl = observer(function(props: { pageIndex: number | null }) {
  const storeMain = useContext(StoreContext);
  const t = useI18n();
  const onUseImageSizeToPage = useCallback(() => {
    const pageItem = storeMain.book.pages[props.pageIndex as number]
    const image = storeMain.blobs.blobs[pageItem.blobID].originImage
    storeMain.book.updateBookPageProperty('pageSize', [
      image.width,
      image.height
    ])
  }, [props.pageIndex, storeMain])

  const onChangePageIndex = useCallback(() => {
    const max = storeMain.book.pages.length
    const inputValue = window.prompt(t.prompt.newPageIndex(max))
    let num = parseInt(inputValue || '')
    
    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.replacePageIndex(props.pageIndex as number, num - 1)
  }, [props.pageIndex, storeMain, t])

  const onSetContentq = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    storeMain.contents.setPageIndexToTitle(
      +(e.currentTarget.dataset.index as string),
      props.pageIndex as number
    )
  }, [props.pageIndex, storeMain])

  const onSplitPage = useCallback(() => {
    if (props.pageIndex !== null) {
      storeMain.splitPage(props.pageIndex)
    }
  }, [props.pageIndex, storeMain])

  const onUndoSplit = useCallback(() => {
    storeMain.undoLastSplit()
  }, [storeMain])

  const onRemovePage = useCallback(() => {
    const res = window.confirm(t.prompt.removePage(props.pageIndex as number))
    res && storeMain.removePage(props.pageIndex as number)
  }, [props.pageIndex, storeMain, t])

  const hasUndo = !!storeMain.lastSplitRecord

  if (props.pageIndex === null) {
    return (
      <>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <Icon name="ruler"/>
            <span className="nav-label">{t.nav.ruler}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <Icon name="menu"/>
            <span className="nav-label">{t.nav.move}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <Icon name="bookmark"/>
            <span className="nav-label">{t.nav.bookmark}</span>
          </button>
        </div>
        <div className={`nav-item ${hasUndo ? 'dropdown' : ''}`}>
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <Icon name="scissors"/>
            <span className="nav-label">{t.nav.split}</span>
          </button>
          {
            hasUndo ? (
              <ul className="dropdown-menu" style={{top: 0, left: '100%'}}>
                <li>
                  <span
                    className="dropdown-item"
                    onClick={onUndoSplit}
                  >
                    {t.nav.undoSplit}
                  </span>
                </li>
              </ul>
            ) : null
          }
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <Icon name="cross"/>
            <span className="nav-label">{t.nav.delete}</span>
          </button>
        </div>
      </>
    )
  }

  const blankPage = storeMain.book.pages[props.pageIndex].blank

  return (
    <>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onUseImageSizeToPage}>
          <Icon name="ruler"/>
          <span className="nav-label">{t.nav.ruler}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onChangePageIndex}>
          <Icon name="menu"/>
          <span className="nav-label">{t.nav.move}</span>
        </button>
      </div>
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-secondary">
          <Icon name="bookmark"/>
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
      <div className={`nav-item ${hasUndo ? 'dropdown' : ''}`}>
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onSplitPage}>
          <Icon name="scissors"/>
          <span className="nav-label">{t.nav.split}</span>
        </button>
        {
          hasUndo ? (
            <ul className="dropdown-menu" style={{top: 0, left: '100%'}}>
              <li>
                <span
                  className="dropdown-item"
                  onClick={onUndoSplit}
                >
                  {t.nav.undoSplit}
                </span>
              </li>
            </ul>
          ) : null
        }
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onRemovePage}>
          <Icon name="cross"/>
          <span className="nav-label">{t.nav.delete}</span>
        </button>
      </div>
    </>
  )
})

const AcceptMap = {
  image: 'image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif',
  zip: 'application/zip,.zip',
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
  const storeMain = useContext(StoreContext);
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
      const fileName = input.files[0].name 
      JSZip.loadAsync(input.files[0]).then(zipContent => {
        // natural sort so "10.jpg" comes after "2.jpg"
        const zipFiles = Object.keys(zipContent.files)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .map((filename) => zipContent.files[filename])
        const promises: Promise<File | null>[] = zipFiles.map(zipItem => {
          if (zipItem.dir) {
            return Promise.resolve(null)
          }

          return new Promise(resolve => {
            zipItem.async('uint8array').then(uint8Array => {
              const bytes = new Uint8Array(uint8Array)
              const hexOf = (start: number, end: number) =>
                Array.from(bytes.subarray(start, end)).map(b => b.toString(16).padStart(2, '0')).join('')
              const asciiOf = (start: number, end: number) =>
                String.fromCharCode(...Array.from(bytes.subarray(start, end)))

              let mimeType: string | null = null

              if (hexOf(0, 4) === '89504e47') {
                mimeType = 'image/png'
              } else if (hexOf(0, 3) === 'ffd8ff') { // any JPEG marker (E0-EF, DB, EE...)
                mimeType = 'image/jpeg'
              } else if (asciiOf(0, 4) === 'RIFF' && asciiOf(8, 12) === 'WEBP') {
                mimeType = 'image/webp'
              } else if (asciiOf(4, 8) === 'ftyp' && ['avif', 'avis'].includes(asciiOf(8, 12))) {
                mimeType = 'image/avif'
              }

              if (mimeType) {
                const b = new Blob([new Uint8Array(uint8Array)], { type: mimeType })
                resolve(
                  blobToFile(
                    b,
                    zipItem.name
                  )
                )
              } else {
                resolve(null)
              }
            })
          })
        })

        return Promise.all(promises) as Promise<File[]>
      }).then((files: (File | null)[]) => {
        storeMain.importPageFromImages(files.filter(b => b !== null) as File[])
        if (storeMain.ui.firstImport) {
          storeMain.ui.toggleBookVisible(fileName)
        }
      })
      return
    }

    storeMain.importPageFromImages(Array.from(input.files as FileList))
  }, [inputType, storeMain])

  const onClickInsertBlankPage = useCallback(() => {
    const selectedIndex = ui.selectedPageIndex
    if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < book.pages.length) {
      storeMain.insertBlankPage(selectedIndex)
      ui.selectPageIndex(selectedIndex)
      return
    }

    const max = book.pages.length
    const inputValue = window.prompt(t.prompt.insertPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.insertBlankPage(num - 1)
    ui.selectPageIndex(num - 1)
  }, [book.pages.length, ui, storeMain, t])

  const onClickGenerate = useCallback(() => {
    storeMain.generateBook()
  }, [storeMain])

  const onCycleTheme = useCallback(() => {
    ui.cycleTheme()
  }, [ui])

  const onClickReset = useCallback(() => {
    if (window.confirm(t.confirm.reset)) {
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
          <Icon name="upload"/>
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
          <Icon name="book"/>
          <span className="nav-label">{t.nav.book}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleContentVisible} title={t.nav.contents}>
          <Icon name="list"/>
          <span className="nav-label">{t.nav.contents}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickTogglePageVisible} title={t.nav.page}>
          <Icon name="tools"/>
          <span className="nav-label">{t.nav.page}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={book.pages.length === 0}
          onClick={onClickInsertBlankPage}
          title={t.nav.insertBlankPage}
        >
          <Icon name="notification"/>
          <span className="nav-label">{t.nav.insertBlankPage}</span>
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
          <Icon name="install"/>
          <span className="nav-label">{t.nav.generate}</span>
        </button>
      </div>
      <PageControl pageIndex={ui.selectedPageIndex}/>
      <div className="nav-item nav-bottom-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCycleTheme}
          title={
            { light: t.nav.themeLight, dark: t.nav.themeDark, auto: t.nav.themeAuto }[ui.theme]
          }
        >
          <Icon name={ui.theme === 'light' ? 'sun' : ui.theme === 'dark' ? 'moon' : 'theme-auto'}/>
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
          <Icon name="trash"/>
          <span className="nav-label">{t.nav.reset}</span>
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