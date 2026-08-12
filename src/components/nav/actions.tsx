import JSZip from 'jszip'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'store/main'
import { useI18n } from 'i18n'
import { detectImageMime } from 'utils/epub-parser'

export type ImportType = 'image' | 'zip' | 'epub'

const AcceptMap: Record<ImportType, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif',
  zip: 'application/zip,.zip,.cbz,application/x-cbz',
  epub: 'application/epub+zip,.epub',
}

const MultipleAttrMap: Record<ImportType, boolean> = {
  image: true,
  zip: false,
  epub: false,
}

const blobToFile = (theBlob: Blob, fileName: string): File => {
  return new File([theBlob], fileName, { type: theBlob.type })
}

// registry so UI outside the nav (e.g. the empty-state import buttons in
// main.tsx) can trigger the shared hidden file input without DOM queries
let activeImportHandler: ((type: ImportType) => void) | null = null

export function requestImportGlobal(type: ImportType) {
  activeImportHandler?.(type)
}

/**
 * Owns the shared hidden <input type="file"> and the whole import pipeline
 * (images / zip / epub). Rendered once by the Header shell; both nav shells
 * trigger it through the returned `requestImport`.
 */
export function useImportControl() {
  const storeMain = useStore()
  const t = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputType, setInputType] = useState<ImportType>('zip')

  const requestImport = useCallback((type: ImportType) => {
    if (type === inputType) {
      inputRef.current?.click()
    } else {
      setInputType(type)
    }
  }, [inputType])

  useEffect(() => {
    activeImportHandler = requestImport
    return () => {
      if (activeImportHandler === requestImport) {
        activeImportHandler = null
      }
    }
  }, [requestImport])

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

  useLayoutEffect(() => {
    if (inputType) {
      inputRef.current?.click()
    }
  }, [inputType])

  const fileInput = (
    <input
      key={inputType}
      id="input-upload"
      ref={inputRef}
      type="file"
      value=""
      accept={AcceptMap[inputType]}
      multiple={MultipleAttrMap[inputType]}
      onChange={handleGetFile}
      style={{ display: 'none' }}
    />
  )

  return { fileInput, requestImport }
}

export interface SpreadState {
  /** spread-binding actions only apply to non-cover pages */
  available: boolean
  isCentered: boolean
  isBoundPrev: boolean
  isBoundNext: boolean
  canBindPrev: boolean
  canBindNext: boolean
}

/**
 * Single source of truth for every nav action & its enabled/active state.
 * Consumed by both DesktopNav and MobileNav so handlers are written once.
 */
export function useNavActions() {
  const storeMain = useStore()
  const { ui, book, contents, undoStore } = storeMain
  const t = useI18n()

  const selectedPageIndex = ui.selectedPageIndex
  // in standalone-cover mode the cards are numbered without the cover,
  // so prompts must translate between displayed numbers and real indices
  const coverOffset = book.coverPosition === 'alone' ? 1 : 0
  const selectedPage = selectedPageIndex !== null ? book.pages[selectedPageIndex] : null
  const selectedPageBlank = selectedPage?.blank ?? false

  const toggleBook = useCallback(() => {
    ui.toggleBookVisible()
  }, [ui])

  const toggleContents = useCallback(() => {
    ui.toggleContentVisible()
  }, [ui])

  const togglePage = useCallback(() => {
    ui.togglePageVisible()
  }, [ui])

  const generate = useCallback(() => {
    storeMain.generateBook()
  }, [storeMain])

  const cycleTheme = useCallback(() => {
    ui.cycleTheme()
  }, [ui])

  const toggleContainerBg = useCallback(() => {
    ui.toggleContainerBgFilled()
  }, [ui])

  const toggleLang = useCallback(() => {
    ui.toggleLang()
  }, [ui])

  const reset = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm(t.confirm.reset)) {
      storeMain.resetWorkspace()
    }
  }, [storeMain, t])

  const useImageSize = useCallback(() => {
    if (ui.selectedPageIndex !== null) {
      storeMain.useImageSizeToPage(ui.selectedPageIndex)
    }
  }, [storeMain, ui])

  const movePagePrompt = useCallback(() => {
    if (ui.selectedPageIndex === null) return
    const max = book.pages.length - coverOffset
    const inputValue = window.prompt(t.prompt.newPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.movePage(ui.selectedPageIndex, num - 1 + coverOffset)
  }, [storeMain, ui, book, t, coverOffset])

  const insertBlankPage = useCallback(() => {
    const index = ui.selectedPageIndex
    if (index !== null && index >= 0 && index < book.pages.length) {
      storeMain.insertBlankPage(index)
      storeMain.ui.selectPageIndex(index)
      return
    }

    const max = book.pages.length - coverOffset
    const inputValue = window.prompt(t.prompt.insertPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.insertBlankPage(num - 1 + coverOffset)
    storeMain.ui.selectPageIndex(num - 1 + coverOffset)
  }, [storeMain, ui, book, t, coverOffset])

  const setBookmark = useCallback((listIndex: number) => {
    if (ui.selectedPageIndex !== null) {
      storeMain.setBookmark(listIndex, ui.selectedPageIndex)
    }
  }, [storeMain, ui])

  const splitPage = useCallback(() => {
    if (ui.selectedPageIndex !== null) {
      storeMain.splitPage(ui.selectedPageIndex)
    }
  }, [storeMain, ui])

  const removePage = useCallback(() => {
    const realIndex = ui.selectedPageIndex
    if (realIndex === null) return
    const message = coverOffset && realIndex === 0
      ? t.prompt.removeCover
      : t.prompt.removePage(realIndex - coverOffset)
    const res = window.confirm(message)
    res && storeMain.removePage(realIndex)
  }, [storeMain, ui, t, coverOffset])

  const undo = useCallback(() => {
    storeMain.undo()
  }, [storeMain])

  // ---- custom spread bindings for the selected page (shares the rules of
  // the desktop right-click context menu in main.tsx) ----
  const spreadIdx = selectedPageIndex !== null && selectedPageIndex > 0 ? selectedPageIndex : null
  const spreadPage = spreadIdx !== null ? book.pages[spreadIdx] : null

  const spreadState: SpreadState = {
    available: spreadPage !== null,
    isCentered: spreadPage?.customSpread === 'center',
    isBoundPrev: spreadPage?.customSpread === 'bind-prev'
      && (spreadIdx !== null && book.pages[spreadIdx - 1]?.customSpread === 'bind-next'),
    isBoundNext: spreadPage?.customSpread === 'bind-next'
      && (spreadIdx !== null && book.pages[spreadIdx + 1]?.customSpread === 'bind-prev'),
    canBindPrev: spreadIdx !== null && spreadIdx > 1,
    canBindNext: spreadIdx !== null && spreadIdx < book.pages.length - 1,
  }

  const toggleSpreadCenter = useCallback(() => {
    const idx = ui.selectedPageIndex
    if (idx !== null && idx > 0) {
      book.setPageCustomSpread(idx, 'center')
    }
  }, [book, ui])

  const toggleSpreadBindPrev = useCallback(() => {
    const idx = ui.selectedPageIndex
    if (idx !== null && idx > 0) {
      book.setPageCustomSpread(idx, 'bind-prev')
    }
  }, [book, ui])

  const toggleSpreadBindNext = useCallback(() => {
    const idx = ui.selectedPageIndex
    if (idx !== null && idx > 0) {
      book.setPageCustomSpread(idx, 'bind-next')
    }
  }, [book, ui])

  return {
    // state
    hasPages: book.pages.length > 0,
    selectedPageIndex,
    selectedPageBlank,
    canUndo: undoStore.canUndo,
    containerBgFilled: ui.containerBgFilled,
    theme: ui.theme,
    lang: ui.lang,
    contentsList: contents.list,
    contentsIndexMap: contents.indexMap,
    spreadState,
    // handlers
    toggleBook,
    toggleContents,
    togglePage,
    generate,
    cycleTheme,
    toggleContainerBg,
    toggleLang,
    reset,
    useImageSize,
    movePagePrompt,
    insertBlankPage,
    setBookmark,
    splitPage,
    removePage,
    undo,
    toggleSpreadCenter,
    toggleSpreadBindPrev,
    toggleSpreadBindNext,
  }
}

export type NavActions = ReturnType<typeof useNavActions>
