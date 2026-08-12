const en = {
  // Nav / Toolbar
  nav: {
    import: 'Import',
    book: 'Book',
    contents: 'TOC',
    page: 'Page',
    importImage: 'Image files',
    importZip: 'ZIP / CBZ archive',
    importEpub: 'EPUB file',
    insertBlankPage: 'Blank',
    generate: 'EPUB',
    ruler: 'Fit',
    move: 'Move',
    bookmark: 'Mark',
    split: 'Split',
    delete: 'Delete',
    theme: 'Theme',
    themeLight: 'Theme: Light',
    themeDark: 'Theme: Dark',
    themeAuto: 'Theme: Auto (system)',
    reset: 'Reset',
    undo: 'Undo',
    lang: 'Language',
    langZh: '简体中文',
    langEn: 'English',
    previewBg: 'Preview Bg',
    previewBgFilled: 'Preview Bg: Solid White',
    previewBgTransparent: 'Preview Bg: Transparent',
  },

  // Confirm dialogs
  confirm: {
    reset: 'Clear the workspace? All imported pages will be removed. This cannot be undone.',
  },

  // Page operation prompts
  prompt: {
    newPageIndex: (max: number) => `New page index (1 – ${max}):`,
    insertPageIndex: (max: number) => `Insert at index (1 – ${max}):`,
    removePage: (idx: number) => `Remove page ${idx + 1}?`,
    removeCover: 'Remove the cover page?',
  },

  // Alert messages
  alert: {
    error: 'Error',
    importImagesFailed: (count: number) => `${count} image(s) could not be imported`,
    zipNoImages: 'No images found in the archive',
    zipReadFailed: 'Failed to read the archive',
    splitFailed: 'Failed to split the page',
  },

  // Main area
  main: {
    appTitle: 'EPUB Manga Creator V3',
    appSubtitle: 'Create & edit EPUB manga e-books easily',
    appMaintainer: 'Viel0320',
    ready: 'Ready 🚀',
    import: 'Import',
    zoomPreview: 'Zoom preview',
    restoreDetected: 'Detected a backup from your last session. Would you like to restore it?',
    restore: 'Restore',
    dismiss: 'Dismiss',
    restoredSuccess: (count: number) => `Workspace restored from local backup (${count} pages)`,
    restoredPartial: (restored: number, failed: number) => `Restored ${restored} pages, ${failed} could not be read`,
  },

  // Lightbox (page preview)
  lightbox: {
    page: 'Page',
    blankPage: 'Blank page',
    originImage: 'Original',
    close: 'Close',
    prev: 'Previous page',
    next: 'Next page',
  },

  // Loading overlay
  loading: {
    generating: 'Generating EPUB…',
    importingEpub: 'Importing EPUB…',
    importingImages: 'Importing images…',
  },

  // Modal – Book settings
  book: {
    modalTitle: 'Book',
    filename: 'Filename',
    id: 'ID (dc:identifier)',
    isbn: 'ISBN (isbn)',
    title: 'Title (dc:title)',
    author: 'Author (dc:creator)',
    subject: 'Subject (dc:subject)',
    publisher: 'Publisher (dc:publisher)',
    language: 'Language (dc:language)',
    seriesName: 'Series Name (belongs-to-collection)',
    seriesVolume: 'Volume (group-position)',
    description: 'Description (dc:description)',
    date: 'Date (dc:date)',
    contributor: 'Contributor (dc:contributor)',
    roleIll: 'Illustrator (ill)',
    roleTrl: 'Translator (trl)',
    roleEdt: 'Editor (edt)',
    addContributor: 'Add Contributor',
    saveSet: 'Save set',
    removeSet: 'Remove set',
    analyze: 'Auto-fill',
  },

  // Modal – Contents / TOC
  contents: {
    modalTitle: 'Contents',
    colIndex: 'Index',
    colTitle: 'Title',
    formMode: 'Form mode',
    plainMode: 'Plain text mode',
    sort: 'Sort',
    save: 'Save',
    saveSet: 'Save set',
    removeSet: 'Remove set',
    placeholder: 'e.g.\n 1. Cover\n 2. Chapter 1\n 3. Chapter 2',
    autoGenerate: 'Auto Generate',
    autoSmart: 'Smart Detect (Chapter/Folder)',
    autoFolder: 'By Subfolder Structure',
    autoInterval: 'By Fixed Page Interval',
    autoFilename: 'By Image Filename',
    autoPage: 'By Page Number',
    removeExceptCover: 'Clear',
    intervalPrompt: 'Enter interval (pages):',
    autoSuccess: (count: number) => `Generated ${count} TOC items`,
    noPages: 'No image pages available to generate TOC',
    tocCover: 'Cover',
    tocChapter: (num: number) => `Chapter ${num}`,
    tocPage: (num: number) => `Page ${num}`,
  },

  // Modal – Page settings
  page: {
    modalTitle: 'Page',
    size: 'Size',
    show: 'Show',
    fit: 'Fit',
    direction: 'Direction',
    cover: 'Cover',
    imageTag: 'Image tag',
  },

  // Option labels (shared)
  option: {
    center: 'Center',
    twoPages: 'Two pages',
    onePage: 'One page',
    contain: 'Fit',
    cover: 'Crop',
    fill: 'Stretch',
    rightJP: 'Right (Japanese)',
    left: 'Left',
    firstPage: 'First page',
    alone: 'Alone',
    singlePageBadge: 'Single Page',
    boundSpreadBadge: 'Bound Spread',
    setSingle: 'Set to Single Page',
    removeSingle: 'Remove Single Page (Auto)',
    bindPrev: 'Bind Spread (Previous)',
    removeBindPrev: 'Unbind Spread',
    bindNext: 'Bind Spread (Next)',
    removeBindNext: 'Unbind Spread',
  },

  // Language switcher
  lang: {
    en: 'EN',
    zh: '中文',
  },
} as const

export default en

type SectionLocale<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : string
}

export type Locale = {
  nav: Record<keyof typeof en.nav, string>
  prompt: {
    newPageIndex: (max: number) => string
    insertPageIndex: (max: number) => string
    removePage: (idx: number) => string
    removeCover: string
  }
  alert: SectionLocale<typeof en.alert>
  confirm: Record<keyof typeof en.confirm, string>
  main: SectionLocale<typeof en.main>
  lightbox: Record<keyof typeof en.lightbox, string>
  loading: Record<keyof typeof en.loading, string>
  book: Record<keyof typeof en.book, string>
  contents: SectionLocale<typeof en.contents>
  page: Record<keyof typeof en.page, string>
  option: Record<keyof typeof en.option, string>
  lang: Record<keyof typeof en.lang, string>
}
