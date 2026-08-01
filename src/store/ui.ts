import { makeAutoObservable } from 'mobx'
import type { LangKey } from 'i18n'

const STORAGE_LANG_KEY = 'EPUB_CREATOR_LANG'
const STORAGE_THEME_KEY = 'EPUB_CREATOR_THEME'
const STORAGE_CONTAINER_BG_KEY = 'EPUB_CREATOR_CONTAINER_BG'

export type ThemeMode = 'dark' | 'light' | 'auto'
const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'auto']

function detectDefaultContainerBg(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(STORAGE_CONTAINER_BG_KEY)
  if (saved === 'true') return true
  if (saved === 'false') return false
  return false
}

function detectDefaultLang(): LangKey {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_LANG_KEY)
  if (saved === 'en' || saved === 'zh') return saved
  // auto-detect from browser
  const nav = navigator.language || ''
  return nav.startsWith('zh') ? 'zh' : 'en'
}

function detectDefaultTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  const saved = localStorage.getItem(STORAGE_THEME_KEY)
  if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved
  return 'auto'
}

function resolveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme !== 'auto') return theme
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export interface ToastMessage {
  id: number
  type: 'info' | 'success' | 'warning' | 'error'
  text: string
}

class Store {
  modalBookVisible = false
  modalContentVisible = false
  modalPageVisible = false
  maxCardBoxCountInOneRow = 0
  selectedPageIndex: number | null = null
  fileName = ``
  lang: LangKey = 'en'
  theme: ThemeMode = 'auto'
  isLoading = false
  loadingText = ''
  isPreviewOpen = false
  previewPageIndex: number | null = null

  toastList: ToastMessage[] = []
  private toastId = 0

  firstImport = true
  containerBgFilled = false

  constructor() {
    makeAutoObservable(this)
    this.lang = detectDefaultLang()
    this.theme = detectDefaultTheme()
    this.containerBgFilled = detectDefaultContainerBg()
    this.applyTheme(this.theme)

    // keep "auto" in sync with the OS appearance while it's active
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'auto') {
          this.applyTheme('auto')
        }
      })
    }
  }

  showToast = (text: string, type: ToastMessage['type'] = 'info', duration = 5000) => {
    const id = ++this.toastId
    this.toastList.push({ id, type, text })
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id)
      }, duration)
    }
  }

  removeToast = (id: number) => {
    this.toastList = this.toastList.filter(item => item.id !== id)
  }

  toggleBookVisible(fileName?: string) {
    this.modalBookVisible = !this.modalBookVisible
    if (fileName && this.firstImport) {
      this.fileName = fileName
    }
  }

  firstUploaded() {
    this.firstImport = false
  }

  toggleContentVisible() {
    this.modalContentVisible = !this.modalContentVisible
  }

  togglePageVisible() {
    this.modalPageVisible = !this.modalPageVisible
  }

  hideModal() {
    Object.assign(this, {
      modalBookVisible: false,
      modalContentVisible: false,
      modalPageVisible: false,
    })
  }

  selectPageIndex(index: number | null) {
    if (index === null) {
      this.selectedPageIndex = null
    } else if (this.selectedPageIndex === index) {
      this.selectedPageIndex = null
    } else {
      this.selectedPageIndex = index
    }
  }

  setLang(lang: LangKey) {
    this.lang = lang
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, lang)
    }
  }

  setLoading(val: boolean, text: string = '') {
    this.isLoading = val
    this.loadingText = text
  }

  applyTheme(theme: ThemeMode) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (resolveTheme(theme) === 'light') {
        root.classList.add('light-theme')
        root.classList.remove('dark-theme')
        root.setAttribute('data-bs-theme', 'light')
      } else {
        root.classList.add('dark-theme')
        root.classList.remove('light-theme')
        root.setAttribute('data-bs-theme', 'dark')
      }
    }
  }

  setTheme(theme: ThemeMode) {
    this.theme = theme
    this.applyTheme(theme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_THEME_KEY, theme)
    }
  }

  cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(this.theme) + 1) % THEME_CYCLE.length]
    this.setTheme(next)
  }

  openPreview(index: number) {
    this.isPreviewOpen = true
    this.previewPageIndex = index
  }

  closePreview() {
    this.isPreviewOpen = false
    this.previewPageIndex = null
  }

  nextPreviewPage(maxLen: number, step: number = 1) {
    if (this.previewPageIndex !== null && this.previewPageIndex < maxLen - 1) {
      this.previewPageIndex = Math.min(maxLen - 1, this.previewPageIndex + step)
    }
  }

  prevPreviewPage(step: number = 1) {
    if (this.previewPageIndex !== null && this.previewPageIndex > 0) {
      this.previewPageIndex = Math.max(0, this.previewPageIndex - step)
    }
  }

  navigatePreview(
    direction: 'left' | 'right',
    pageDirection: 'left' | 'right',
    pageShow: 'one' | 'two',
    coverPosition: 'first-page' | 'alone',
    totalPages: number
  ) {
    if (!this.isPreviewOpen || this.previewPageIndex === null || totalPages <= 0) return

    const isRTL = pageDirection === 'right'
    const isForward = isRTL ? direction === 'left' : direction === 'right'
    const isTwoPages = pageShow === 'two'
    const pageIndex = Math.max(0, Math.min(totalPages - 1, this.previewPageIndex))

    let minIndex = pageIndex
    let maxIndex = pageIndex

    if (isTwoPages) {
      if (pageIndex > 0) {
        const offset = pageIndex - 1
        const group = Math.floor(offset / 2)
        minIndex = 1 + group * 2
        maxIndex = Math.min(totalPages - 1, minIndex + 1)
      }
    }

    if (isForward) {
      if (maxIndex >= totalPages - 1) return
      if (isTwoPages) {
        if (minIndex === 0) {
          this.openPreview(1)
        } else {
          this.openPreview(Math.min(totalPages - 1, maxIndex + 1))
        }
      } else {
        this.nextPreviewPage(totalPages, 1)
      }
    } else {
      if (minIndex <= 0) return
      if (isTwoPages) {
        if (minIndex === 1) {
          this.openPreview(0)
        } else {
          this.openPreview(Math.max(0, minIndex - 2))
        }
      } else {
        this.prevPreviewPage(1)
      }
    }
  }

  toggleContainerBgFilled() {
    this.containerBgFilled = !this.containerBgFilled
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CONTAINER_BG_KEY, String(this.containerBgFilled))
    }
  }
}

export default Store