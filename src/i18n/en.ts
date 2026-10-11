const en = {
  /** Publication-shell labels stay separate from legacy editor and import terminology. */
  workspace: {
    navigation: 'Workspace',
    pages: 'Page Layout',
    untitled: 'Untitled',
    preview: 'Read Preview',
    export: 'Export EPUB',
    properties: 'Page Inspector',
    noSelection: 'Select a Page',
    emptyImport: 'Add pages from the Import menu above',
    noBookmark: 'Unassigned',
    pageTools: 'Page Actions',
    replaceImage: 'Replace Image',
    spread: 'Spread Settings',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
  },
  // Nav / Toolbar
  nav: {
    import: 'Import',
    importImage: 'Image Files',
    importZip: 'ZIP / CBZ Archive',
    importEpub: 'EPUB File',
    insertBlankPage: 'Insert Blank Page',
    move: 'Move Page',
    bookmark: 'Start of Chapter',
    split: 'Split in Half',
    delete: 'Delete Page',
    theme: 'Theme',
    reset: 'Clear',
    undo: 'Undo',
    lang: 'Language',
  },

  // Confirm dialogs
  confirm: {
    reset: 'Clear the workspace? All imported pages will be removed. This cannot be undone.',
    importEpubReplace: 'Importing an EPUB will replace the current workspace. All imported pages will be removed. Continue?',
    ok: 'Confirm',
    cancel: 'Cancel',
  },

  // Page operation prompts
  prompt: {
    newPageIndex: (max: number) => `Move to page (1 – ${max}):`,
    insertPageIndex: (max: number) => `Insert at page (1 – ${max}):`,
    removePage: (idx: number) => `Remove page ${idx + 1}?`,
    removeCover: 'Remove the cover page?',
  },

  // Alert messages
  alert: {
    error: 'Error',
    importedImages: (count: number) => `Successfully imported ${count} page(s)`,
    importedEpub: (count: number) => `Successfully imported EPUB (${count} pages)`,
    importImagesFailed: (count: number) => `${count} image(s) could not be imported`,
    importEpubFailed: 'Failed to import EPUB',
    generateFailed: 'Failed to generate EPUB',
    zipNoImages: 'No images found in the archive',
    zipReadFailed: 'Failed to read the archive',
    splitFailed: 'Failed to split the page',
    replaceImageFailed: 'Failed to read the image',
  },

  // Main area
  main: {
    appTitle: 'EPUB Manga Creator',
    appSubtitle: 'Create & edit EPUB manga e-books easily',
    appMaintainer: 'Viel0320',
    restoreDetected: 'Detected an interrupted local project. Click to restore progress.',
    restoredSuccess: (count: number) => `Workspace restored from local backup (${count} pages)`,
    restoredPartial: (restored: number, failed: number) => `Restored ${restored} pages, ${failed} could not be read`,
  },

  // Lightbox (page preview)
  lightbox: {
    page: 'Page',
    blankPage: 'Blank page',
    originImage: 'Original Size',
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

  book: {
    editorTitle: 'Book Info',
    filename: 'Filename',
    id: 'Book ID (dc:identifier)',
    isbn: 'ISBN',
    title: 'Title (dc:title)',
    author: 'Author (dc:creator)',
    subject: 'Subject (dc:subject)',
    publisher: 'Publisher (dc:publisher)',
    language: 'Language (dc:language)',
    seriesName: 'Series (belongs-to-collection)',
    seriesVolume: 'Volume (group-position)',
    description: 'Description (dc:description)',
    date: 'Publication Date (dc:date)',
    chooseDate: 'Choose date',
    contributor: 'Contributor (dc:contributor)',
    roleIll: 'Artist (ill)',
    roleTrl: 'Translator (trl)',
    roleEdt: 'Editor (edt)',
    addContributor: 'Add Contributor',
    saveSet: 'Save Preset',
    removeSet: 'Delete Preset',
    analyze: 'Smart Extract',
  },

  // Editor – Contents / TOC
  contents: {
    editorTitle: 'Table of Contents',
    colIndex: 'Page',
    colTitle: 'Title',
    formMode: 'Form Mode',
    plainMode: 'Text Mode',
    sort: 'Sort',
    save: 'Save TOC',
    /** Saving an in-page directory editor reports completion without closing the work page. */
    saved: 'Table of contents saved',
    saveSet: 'Save Preset',
    removeSet: 'Delete Preset',
    placeholder: 'e.g.\n 1. Cover\n 2. Chapter 1\n 3. Chapter 2',
    autoGenerate: 'Auto Generate',
    autoSmart: 'Smart Detect',
    autoFolder: 'By Folders',
    autoInterval: 'Fixed Interval',
    autoFilename: 'By Filenames',
    autoPage: 'Page by Page',
    removeExceptCover: 'Clear Chapters',
    intervalPrompt: 'Enter interval (pages):',
    autoSuccess: (count: number) => `Generated ${count} chapter(s)`,
    noPages: 'No image pages available to generate TOC',
    tocCover: 'Cover',
    tocChapter: (num: number) => `Chapter ${num}`,
    tocPage: (num: number) => `Page ${num}`,
    indent: 'Indent',
    outdent: 'Outdent',
  },

  // Editor – Page settings
  page: {
    editorTitle: 'Layout Settings',
    size: 'Page Size',
    show: 'Reading Layout',
    fit: 'Scale Mode',
    direction: 'Reading Flow',
    cover: 'Cover Layout',
    coverPage: 'Cover',
    imageTag: 'Markup Tag',
    swapSize: 'Swap Dimensions',
    background: 'Preview Background',
  },

  // Option labels (shared)
  option: {
    twoPages: 'Two-Page Spread',
    onePage: 'Single Page',
    contain: 'Fit',
    cover: 'Crop',
    fill: 'Stretch',
    rightJP: 'Right to Left (Japanese)',
    left: 'Left to Right',
    firstPage: 'Include Cover',
    alone: 'Cover Alone',
    noFill: 'No Fill',
    whiteFill: 'White Fill',
    singlePageBadge: 'Single',
    boundSpreadBadge: 'Spread',
    setSingle: 'Set to Single Page',
    removeSingle: 'Auto Spread',
    bindPrev: 'Pair with Previous',
    removeBindPrev: 'Unpair Spread',
    bindNext: 'Pair with Next',
    removeBindNext: 'Unpair Spread',
  },

  // Language self-names, identical in both locales
  lang: {
    en: 'English',
    zh: '简体中文',
  },
} as const

export default en

type SectionLocale<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : string
}

export type Locale = {
  /** Require both locales to cover every publication-shell control. */
  workspace: Record<keyof typeof en.workspace, string>
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
