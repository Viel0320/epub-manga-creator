import type { Locale } from './en'

const zh: Locale = {
  nav: {
    import: '导入',
    book: '书籍',
    contents: '目录',
    page: '页面',
    importImage: '图片文件',
    importZip: 'ZIP 压缩包',
    insertBlankPage: '空白页',
    generate: '生成',
    ruler: '原图',
    move: '移动',
    bookmark: '书签',
    split: '拆分',
    delete: '删除',
    theme: '主题',
    themeLight: '主题：浅色',
    themeDark: '主题：深色',
    themeAuto: '主题：跟随系统',
    reset: '清空',
    undoSplit: '撤销',
  },

  confirm: {
    reset: '确定要清空工作区吗？所有已导入的页面都将被移除，此操作不可撤销。',
  },

  prompt: {
    newPageIndex: (max: number) => `新页码（1 – ${max}）：`,
    insertPageIndex: (max: number) => `插入位置（1 – ${max}）：`,
    removePage: (idx: number) => `确认删除第 ${idx + 1} 页？`,
  },

  alert: {
    error: '错误',
  },

  main: {
    ready: '准备就绪 🚀',
    import: '导入',
    zoomPreview: '放大预览',
    restoreDetected: '检测到您上次未完成的项目，是否恢复进度？',
    restore: '恢复',
    dismiss: '忽略',
  },

  lightbox: {
    page: '页面',
    blankPage: '空白页',
    close: '关闭',
    prev: '上一页',
    next: '下一页',
  },

  loading: {
    generating: '正在生成 EPUB…',
  },

  book: {
    modalTitle: '书籍信息',
    filename: '文件名',
    id: 'ID',
    title: '标题',
    author: '作者',
    subject: '主题',
    publisher: '出版商',
    saveSet: '保存预设',
    removeSet: '删除预设',
    analyze: '自动填写',
  },

  contents: {
    modalTitle: '目录',
    colIndex: '页码',
    colTitle: '标题',
    formMode: '表单模式',
    plainMode: '纯文本模式',
    sort: '排序',
    save: '保存',
    saveSet: '保存预设',
    removeSet: '删除预设',
    placeholder: '例如\n 1. 封面\n 2. 第一章\n 3. 第二章',
    autoGenerate: '自动生成',
    autoSmart: '智能识别 (章节/文件夹)',
    autoFolder: '按文件夹分组',
    autoInterval: '按固定页数间隔',
    autoFilename: '按图片文件名',
    autoPage: '按页码 (第 N 页)',
    removeExceptCover: '清理目录',
    intervalPrompt: '请输入间隔页数：',
    autoSuccess: (count: number) => `已自动生成 ${count} 个目录项`,
    noPages: '暂无可用页面，无法生成目录',
  },

  page: {
    modalTitle: '页面设置',
    size: '尺寸',
    position: '对齐方式',
    show: '显示模式',
    fit: '适配模式',
    direction: '阅读方向',
    cover: '封面',
    imageTag: '图片标签',
  },

  option: {
    center: '居中',
    between: '内侧',
    twoPages: '双页',
    onePage: '单页',
    stretch: '拉伸',
    fit: '适应',
    fill: '填充',
    rightJP: '右翻（日式）',
    left: '左翻',
    firstPage: '首页',
    alone: '独立封面',
    setCenter: '设为居中 (Spread Center)',
    removeCenter: '取消居中 (恢复自动)',
  },

  lang: {
    en: 'EN',
    zh: '中文',
  },
}

export default zh
