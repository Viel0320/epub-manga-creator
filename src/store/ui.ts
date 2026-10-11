import { makeAutoObservable } from 'mobx'
import type { LangKey } from 'i18n'

const STORAGE_LANG_KEY = 'EPUB_CREATOR_LANG'
const STORAGE_THEME_KEY = 'EPUB_CREATOR_THEME'
const STORAGE_CONTAINER_BG_KEY = 'EPUB_CREATOR_CONTAINER_BG'

export type ThemeMode = 'dark' | 'light' | 'auto'
/** Publication navigation is independent of editor drafts and the reading overlay. */
export type WorkspacePage = 'pages' | 'book' | 'contents' | 'layout'
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

export type OverlayKind = 'confirm' | 'prompt' | 'alert'

/** Per-kind overlay payloads; the bare type is the union the overlay component consumes. */
export type OverlayState<K extends OverlayKind = OverlayKind> =
  K extends 'confirm' ? { kind: 'confirm'; message: string; danger?: boolean } :
  K extends 'prompt' ? { kind: 'prompt'; message: string; defaultValue?: string } :
  { kind: 'alert'; message: string }

/** Module-level on purpose: the pending resolver never needs reactivity.
    The kind travels with it so replacing an overlay settles the previous one
    with its own dismissal value instead of a shared null. */
let activeOverlayResolve: ((value?: boolean | string | null) => void) | null = null
let activeOverlayKind: OverlayKind | null = null

// narrow viewports (portrait phones / small tablets) plus touch devices in
// short landscape: a landscape phone is wider than 768px but still needs the
// mobile chrome. Keep in sync with the matching CSS media queries.
const MOBILE_MEDIA_QUERY =
  '(max-width: 768px), (hover: none) and (pointer: coarse) and (max-height: 520px)'

function detectIsMobile(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

class Store {
  /** The revision changes only when the underlying project is replaced, never on tab navigation. */
  workspacePage: WorkspacePage = 'pages'
  workspaceRevision = 0
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

  /** Theme-aware overlay (confirm/prompt/alert); window dialogs' chrome ignores the theme. */
  overlay: OverlayState | null = null

  firstImport = true
  containerBgFilled = false
  isMobile = false

  constructor() {
    makeAutoObservable(this)
    this.lang = detectDefaultLang()
    this.theme = detectDefaultTheme()
    this.containerBgFilled = detectDefaultContainerBg()
    this.isMobile = detectIsMobile()
    this.applyTheme(this.theme)

    // keep "auto" in sync with the OS appearance while it's active
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'auto') {
          this.applyTheme('auto')
        }
      })

      window.matchMedia(MOBILE_MEDIA_QUERY).addEventListener('change', (e) => {
        this.setIsMobile(e.matches)
      })
    }
  }

  setIsMobile(value: boolean) {
    this.isMobile = value
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

  showOverlay(state: OverlayState<'confirm'>): Promise<boolean>
  showOverlay(state: OverlayState<'prompt'>): Promise<string | null>
  showOverlay(state: OverlayState<'alert'>): Promise<void>
  /** The implementation channel is kind-agnostic; callers only see the typed overloads. */
  showOverlay(state: OverlayState): Promise<unknown> {
    this.dismissPendingOverlay()
    return new Promise(resolve => {
      activeOverlayResolve = resolve
      activeOverlayKind = state.kind
      this.overlay = state
    })
  }

  /** Settle whatever is pending as a dismissal: confirm → false, prompt → null, alert → void. */
  dismissPendingOverlay = () => {
    const resolve = activeOverlayResolve
    const kind = activeOverlayKind
    activeOverlayResolve = null
    activeOverlayKind = null
    this.overlay = null
    if (!resolve) return
    if (kind === 'confirm') resolve(false)
    else if (kind === 'prompt') resolve(null)
    else resolve()
  }

  showConfirm = (message: string, danger = false): Promise<boolean> =>
    this.showOverlay({ kind: 'confirm', message, danger })

  /** Mirrors window.prompt: resolves the typed string, or null when dismissed. */
  showPrompt = (message: string, defaultValue = ''): Promise<string | null> =>
    this.showOverlay({ kind: 'prompt', message, defaultValue })

  showAlert = (message: string): Promise<void> =>
    this.showOverlay({ kind: 'alert', message })

  settleOverlay = (value: boolean | string | null) => {
    const resolve = activeOverlayResolve
    activeOverlayResolve = null
    activeOverlayKind = null
    this.overlay = null
    resolve?.(value)
  }

  /** Archive imports can navigate to metadata without remounting any editor. */
  openBook(fileName?: string) {
    this.workspacePage = 'book'
    if (fileName && this.firstImport) {
      this.fileName = fileName
    }
  }

  firstUploaded() {
    this.firstImport = false
  }

  /** Selecting a work page leaves all other pages' local state and scroll containers intact. */
  setWorkspacePage(page: WorkspacePage) {
    this.workspacePage = page
  }

  /** Clear cached editor drafts only for an explicit reset or replacement EPUB import. */
  resetWorkspaceView() {
    this.workspacePage = 'pages'
    this.workspaceRevision += 1
    // a reset is not a reading session ending, so the reader's stop page
    // must never be resurrected as the selection
    this.dismissPreview()
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

  setLoading(val: boolean, text: string = '') {
    this.isLoading = val
    this.loadingText = text
  }

  applyTheme(theme: ThemeMode) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      const resolved = resolveTheme(theme)
      if (resolved === 'light') {
        root.classList.add('light-theme')
        root.classList.remove('dark-theme')
        root.setAttribute('data-bs-theme', 'light')
      } else {
        root.classList.add('dark-theme')
        root.classList.remove('light-theme')
        root.setAttribute('data-bs-theme', 'dark')
      }
      // keep the mobile browser chrome in sync with the active surface color;
      // --bg in workspace.css is the token source, the index.html metas only carry the pre-CSS fallback
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
        || document.querySelector(`meta[name="theme-color"][media*="${resolved}"]`)?.getAttribute('content')
        || ''
      if (bg) {
        document
          .querySelectorAll('meta[name="theme-color"]')
          .forEach(meta => meta.setAttribute('content', bg))
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

  setLang(lang: LangKey) {
    this.lang = lang
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, lang)
    }
  }

  toggleLang() {
    const next: LangKey = this.lang === 'zh' ? 'en' : 'zh'
    this.setLang(next)
  }

  openPreview(index: number) {
    this.isPreviewOpen = true
    this.previewPageIndex = index
  }

  /** Closes the reader without touching the selection. */
  dismissPreview() {
    this.isPreviewOpen = false
    this.previewPageIndex = null
  }

  closePreview() {
    // Returning from the reader keeps its stop page selected so the grid,
    // inspector, and the next reading session resume where it left off.
    if (this.previewPageIndex !== null) {
      this.selectedPageIndex = this.previewPageIndex
    }
    this.dismissPreview()
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
    spreadPairs: number[][],
    totalPages: number
  ) {
    if (!this.isPreviewOpen || this.previewPageIndex === null || totalPages <= 0) return

    const isRTL = pageDirection === 'right'
    const isForward = isRTL ? direction === 'left' : direction === 'right'
    const pageIndex = Math.max(0, Math.min(totalPages - 1, this.previewPageIndex))

    // navigate by the same spread grouping the lightbox renders with,
    // so custom spreads (center / bound pairs) are never skipped
    const pairIndex = spreadPairs.findIndex(pair => pair.includes(pageIndex))
    if (pairIndex === -1) {
      if (isForward) {
        this.nextPreviewPage(totalPages, 1)
      } else {
        this.prevPreviewPage(1)
      }
      return
    }

    const targetPairIndex = isForward ? pairIndex + 1 : pairIndex - 1
    if (targetPairIndex < 0 || targetPairIndex >= spreadPairs.length) return

    const targetPair = spreadPairs[targetPairIndex]
    if (targetPair.length > 0) {
      this.openPreview(targetPair[0])
    }
  }

  toggleContainerBgFilled() {
    this.setContainerBgFilled(!this.containerBgFilled)
  }

  setContainerBgFilled(value: boolean) {
    this.containerBgFilled = value
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CONTAINER_BG_KEY, String(value))
    }
  }
}

export default Store
