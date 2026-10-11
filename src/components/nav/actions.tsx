import JSZip from 'jszip'
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'store/main'
import type Book from 'store/book'
import type { StoreBook } from 'store/book'
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

/** The inspector's per-page image replacement reuses the import picker filter. */
export const IMAGE_ACCEPT = AcceptMap.image

const blobToFile = (theBlob: Blob, fileName: string): File => {
  return new File([theBlob], fileName, { type: theBlob.type })
}

/**
 * Owns the shared hidden <input type="file"> and the whole import pipeline
 * (images / zip / epub). The publication header owns its only import menu;
 * changing formats schedules a picker only after an explicit user action.
 */
export function useImportControl() {
  const storeMain = useStore()
  const t = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRequested = useRef(false)
  const [inputType, setInputType] = useState<ImportType>('zip')

  const requestImport = useCallback(async (type: ImportType) => {
    // EPUB import replaces the workspace, so warn before the picker opens —
    // but only when there is something to lose.
    if (type === 'epub' && storeMain.book.pages.length > 0
        && !(await storeMain.ui.showConfirm(t.confirm.importEpubReplace, true))) {
      return
    }
    if (type === inputType) {
      inputRef.current?.click()
    } else {
      pickerRequested.current = true
      setInputType(type)
    }
  }, [inputType, storeMain, t])

  const handleGetFile = useCallback(async () => {
    const input: HTMLInputElement = inputRef.current as HTMLInputElement

    if (inputType === 'epub' && (input?.files?.[0])) {
      // An EPUB carries its own metadata, so send the user to the book page like
      // an archive import does; no filename is passed because only the first
      // import may seed ui.fileName, and that triggers filename analysis.
      // A failed import stays on the pages tab of the emptied workspace.
      if (await storeMain.importFromEpub(input.files[0])) {
        storeMain.ui.openBook()
      }
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
          storeMain.ui.openBook(fileName)
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

  /** Update accept/multiple first, then open within the requesting click; mounting never opens a picker. */
  useLayoutEffect(() => {
    if (pickerRequested.current) {
      pickerRequested.current = false
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
 * Pure view of one page's custom-spread state, derived from the page index alone.
 * The inspector feeds it the selected index; the grid's context menu feeds it
 * the right-clicked index — the rules are shared, the index source is not.
 */
export function deriveSpreadState(book: Book, pageIndex: number | null): SpreadState {
  const idx = pageIndex !== null && pageIndex > 0 ? pageIndex : null
  const page = idx !== null ? book.pages[idx] ?? null : null
  return {
    available: page !== null,
    isCentered: page?.customSpread === 'center',
    isBoundPrev: page?.customSpread === 'bind-prev'
      && (idx !== null && book.pages[idx - 1]?.customSpread === 'bind-next'),
    isBoundNext: page?.customSpread === 'bind-next'
      && (idx !== null && book.pages[idx + 1]?.customSpread === 'bind-prev'),
    canBindPrev: idx !== null && idx > 1,
    canBindNext: idx !== null && idx < book.pages.length - 1,
  }
}

/** Guarded spread mutation shared by the inspector toggles and the context menu. */
export function toggleSpreadAt(book: Book, pageIndex: number | null, mode: StoreBook.CustomSpreadType) {
  if (pageIndex !== null && pageIndex > 0) {
    book.setPageCustomSpread(pageIndex, mode)
  }
}

/**
 * Single source of truth for every nav action & its enabled/active state.
 * The workspace shell and selected-page inspector share these domain handlers.
 */
export function useNavActions() {
  const storeMain = useStore()
  const { ui, book, contents, undoStore } = storeMain
  const t = useI18n()

  const selectedPageIndex = ui.selectedPageIndex
  // in standalone-cover mode the cards are numbered without the cover,
  // so prompts must translate between displayed numbers and real indices
  const coverOffset = book.coverPosition === 'alone' ? 1 : 0

  const generate = useCallback(() => {
    storeMain.generateBook()
  }, [storeMain])

  const reset = useCallback(async () => {
    if (await storeMain.ui.showConfirm(t.confirm.reset, true)) {
      storeMain.resetWorkspace()
    }
  }, [storeMain, t])

  const movePagePrompt = useCallback(async () => {
    const fromIndex = ui.selectedPageIndex
    if (fromIndex === null) return
    const max = book.pages.length - coverOffset
    const inputValue = await storeMain.ui.showPrompt(t.prompt.newPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.movePage(fromIndex, num - 1 + coverOffset)
  }, [storeMain, ui, book, t, coverOffset])

  const insertBlankPage = useCallback(async () => {
    const index = ui.selectedPageIndex
    if (index !== null && index >= 0 && index < book.pages.length) {
      storeMain.insertBlankPage(index)
      storeMain.ui.selectPageIndex(index)
      return
    }

    const max = book.pages.length - coverOffset
    const inputValue = await storeMain.ui.showPrompt(t.prompt.insertPageIndex(max))
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

  const removePage = useCallback(async () => {
    const realIndex = ui.selectedPageIndex
    if (realIndex === null) return
    const message = coverOffset && realIndex === 0
      ? t.prompt.removeCover
      : t.prompt.removePage(realIndex - coverOffset)
    if (await ui.showConfirm(message, true)) {
      storeMain.removePage(realIndex)
    }
  }, [storeMain, ui, t, coverOffset])

  const replacePageImage = useCallback(async (file: File) => {
    if (ui.selectedPageIndex !== null) {
      await storeMain.replacePageImage(ui.selectedPageIndex, file)
    }
  }, [storeMain, ui])

  const undo = useCallback(() => {
    storeMain.undo()
  }, [storeMain])

  // ---- custom spread bindings for the selected page; the grid's right-click
  // context menu in main.tsx reuses these helpers with the clicked index ----
  // Derived inline, not memoized: memoizing on the index alone would go stale
  // when the spread flags change under an unchanged selection.
  const spreadState = deriveSpreadState(book, selectedPageIndex)

  const toggleSpreadCenter = useCallback(() => {
    toggleSpreadAt(book, ui.selectedPageIndex, 'center')
  }, [book, ui])

  const toggleSpreadBindPrev = useCallback(() => {
    toggleSpreadAt(book, ui.selectedPageIndex, 'bind-prev')
  }, [book, ui])

  const toggleSpreadBindNext = useCallback(() => {
    toggleSpreadAt(book, ui.selectedPageIndex, 'bind-next')
  }, [book, ui])

  return {
    // state
    canUndo: undoStore.canUndo,
    contentsList: contents.list,
    contentsIndexMap: contents.indexMap,
    spreadState,
    // handlers
    generate,
    reset,
    movePagePrompt,
    insertBlankPage,
    setBookmark,
    splitPage,
    removePage,
    replacePageImage,
    undo,
    toggleSpreadCenter,
    toggleSpreadBindPrev,
    toggleSpreadBindNext,
  }
}
