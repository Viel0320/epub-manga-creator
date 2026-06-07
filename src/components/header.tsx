import JSZip from 'jszip'
import { observer } from 'mobx-react'
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import Icon from 'components/icon'
import storeMain, { useStore } from 'store/main'
import { useI18n } from 'i18n'
import type { LangKey } from 'i18n'

type SupportType = 'image' | 'zip' | 'epub'

const PageControl = observer(function(props: { pageIndex: number | null }) {
  const t = useI18n()
  const onUseImageSizeToPage = useCallback(() => {
    const pageItem = storeMain.book.pages[props.pageIndex as number]
    const blobItem = storeMain.blobs.blobs[pageItem.blobID]
    storeMain.book.updateBookPageProperty('pageSize', [
      blobItem.width,
      blobItem.height
    ])
  }, [props.pageIndex])

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
  }, [props.pageIndex])

  const onSetContentq = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    storeMain.contents.setPageIndexToTitle(
      +(e.currentTarget.dataset.index as string),
      props.pageIndex as number
    )
  }, [props.pageIndex])

  const onSplitPage = useCallback(() => {
    storeMain.splitPage(props.pageIndex as number)
  }, [props.pageIndex])

  const onRemovePage = useCallback(() => {
    const res = window.confirm(t.prompt.removePage(props.pageIndex as number))
    res && storeMain.removePage(props.pageIndex as number)
  }, [props.pageIndex])

  if (props.pageIndex === null) {
    return (
      <>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="ruler"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="menu"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="bookmark"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="scissors"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="cross"/></button>
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
          </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onChangePageIndex}>
            <Icon name="menu"/>
          </button>
      </div>
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-secondary"><Icon name="bookmark"/></button>
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
          <Icon name="scissors"/>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onRemovePage}>
          <Icon name="cross"/>
        </button>
      </div>
    </>
  )
})

const AcceptMap = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  zip: 'application/zip',
  epub: 'application/epub+zip',
}

const MultipleAttrMap = {
  image: true,
  zip: false,
  epub: false,
}

const blobToFile = (theBlob: Blob, fileName:string): File => {
  var b: any = theBlob
  //A Blob() is almost a File() - it's just missing the two properties below which we will add
  b.lastModifiedDate = new Date()
  b.name = fileName

  //Cast to a File() type
  return theBlob as File
}

const Header = function() {
  const { ui } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputType, setInputType] = useState<SupportType>('zip')
  const t = useI18n()

  const onClickToggleBookVisible = useCallback(() => {
    ui.toggleBookVisible()
  }, [ui])
  const onClickToggleContentVisible = useCallback(() => {
    ui.toggleContentVisible()
  }, [ui])
  const onClickTogglePageVisible = useCallback(() => {
    ui.togglePageVisible()
  }, [ui])

  const onClickImport = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const newType = e.currentTarget.dataset.type as SupportType

    if (newType === inputType) {
      inputRef.current?.click()
    } else {
      setInputType(newType)
    }
  }, [inputType])

  const handleGetFile = useCallback(async () => {
    const input: HTMLInputElement = inputRef.current as HTMLInputElement

    if (inputType === 'zip' && (input?.files?.[0])) {
      const fileName = input.files[0].name 
      JSZip.loadAsync(input.files[0]).then(zipContent => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
        const zipFiles = Object.keys(zipContent.files).sort(collator.compare).map((filename) => zipContent.files[filename])
        const promises: Promise<File | null>[] = zipFiles.map(zipItem => {
          if (zipItem.dir) {
            return Promise.resolve(null)
          }

          return new Promise(resolve => {
            zipItem.async('uint8array').then(uint8Array => {
              const header = Array.from(new Uint8Array(uint8Array).subarray(0, 12)).map(item => item.toString(16).padStart(2, '0')).join('')
              let mimeType = null
  
              if (header.startsWith('89504e47')) {
                mimeType = 'image/png'
              } else if (header.startsWith('52494646')) {
                mimeType = 'image/webp'
              } else if (header.startsWith('ffd8ff')) {
                mimeType = 'image/jpeg'
              } else if (header.slice(8, 24) === '6674797061766966') {
                mimeType = 'image/avif'
              }

              if (mimeType) {
                const b = new Blob([uint8Array as any], { type: mimeType })
                resolve(
                  blobToFile(
                    b,
                    zipItem.name.replace(/^.+\/(.+)$/, '$1')
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
      }).catch(err => {
        console.error(err)
        const errorMsg = storeMain.ui.lang === 'zh'
          ? '加载 ZIP 文件失败，请检查文件是否损坏。'
          : 'Failed to load ZIP file, please check if it is corrupted.'
        alert(errorMsg)
      })
      return
    }

    // inputType === jpg png webp
    storeMain.importPageFromImages(Array.from(input.files as FileList))
  }, [inputType])

  const onClickInsertBlankPage = useCallback(() => {
    const max = storeMain.book.pages.length
    const inputValue = window.prompt(t.prompt.insertPageIndex(max))
    let num = parseInt(inputValue || '')
    
    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.insertBlankPage(num - 1)
  }, [])

  const onClickGenerate = useCallback(() => {
    storeMain.ui.setGenerating(true)
    setTimeout(() => {
      storeMain.generateBook().then((blob) => {
        const anchor = document.createElement('a')
        const objectURL = window.URL.createObjectURL(blob)
        anchor.download = storeMain.book.bookTitle.trim() + '.epub'
        anchor.href = objectURL
        anchor.click()
        window.URL.revokeObjectURL(objectURL)
      }).catch(err => {
        console.error(err)
        alert('Failed to generate EPUB.')
      }).finally(() => {
        storeMain.ui.setGenerating(false)
      })
    }, 100)
  }, [])

  useLayoutEffect(() => {
    setTimeout(() => {
      inputRef.current?.click()
    }, 0)
  }, [inputType])

  return (
    <nav id="nav" className="navbar bg-dark">
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-primary">
          <Icon name="upload"/>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          <li><span className="dropdown-item" data-type="image" onClick={onClickImport}>{t.nav.importImage}</span></li>
          <li><span className="dropdown-item" data-type="zip" onClick={onClickImport}>{t.nav.importZip}</span></li>
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleBookVisible}><Icon name="book"/></button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleContentVisible}><Icon name="list"/></button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickTogglePageVisible}><Icon name="tools"/></button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={storeMain.book.pages.length === 0}
          onClick={onClickInsertBlankPage}
        >
          <Icon name="notification"/>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={storeMain.book.pages.length === 0}
          onClick={onClickGenerate}
        >
          <Icon name="install"/>
        </button>
      </div>
      <PageControl pageIndex={ui.selectedPageIndex}/>
      <div className="nav-item" style={{marginTop:'auto'}}>
        <button
          type="button"
          className="btn btn-outline-light btn-sm"
          style={{fontSize:'12px',width:'50px'}}
          onClick={() => {
            const next: LangKey = storeMain.ui.lang === 'en' ? 'zh' : 'en'
            storeMain.ui.setLang(next)
          }}
        >
          {storeMain.ui.lang === 'en' ? t.lang.zh : t.lang.en}
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