import JSZip from 'jszip'
import getTemplateContainerXml from 'template/container.xml'
import getTemplateFixedLayoutJpCss from 'template/fixed-layout-jp.css'
import { EpubBookData } from './types'
import { buildTocNavigationDocument } from './toc-builder'
import { buildPageFiles } from './page-builder'
import { buildStandardOpfDocument } from './opf-builder'

export * from './types'

export class EpubBuilder {
  /**
   * 构建并导出 EPUB 文件
   * 严格按照 EPUB OCF 规范文件顺序写入 ZIP 容器
   */
  static async buildAndDownload(data: EpubBookData): Promise<void> {
    const coverAlone = data.coverPosition === 'alone'

    // 1. 构建页面与图片资源
    const pageResult = buildPageFiles(data)

    // 2. 构建目录导航文档（过滤指向不存在页面的条目，避免导出死链）
    const validContents = data.contents.filter(
      item => item.pageIndex === null || (item.pageIndex >= 0 && item.pageIndex < data.pages.length)
    )
    const tocContent = buildTocNavigationDocument(validContents, coverAlone)

    // 3. 构建 OPF 主包描述文件
    const opfResult = buildStandardOpfDocument(
      data,
      pageResult.opfWidth,
      pageResult.opfHeight
    )

    // 4. 读取标准模板文件
    const containerXmlContent = getTemplateContainerXml()
    const fixedLayoutJpCssContent = getTemplateFixedLayoutJpCss()

    // 5. 初始化 JSZip 容器并按 EPUB 规范顺序依次写入文件
    const zip = new JSZip()

    // [顺序 1]: mimetype 必须是 zip 中第 1 个 entry 且以 STORE 无压缩方式存储
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

    // [顺序 2]: META-INF/container.xml 根引导文件
    zip.file('META-INF/container.xml', containerXmlContent)

    // [顺序 3]: OEBPS/standard.opf 包描述文件 (Manifest & Spine)
    zip.file('OEBPS/standard.opf', opfResult.opfContent)

    // [顺序 4]: OEBPS/navigation-documents.xhtml 导航/目录文档
    zip.file('OEBPS/navigation-documents.xhtml', tocContent)

    // [顺序 5]: OEBPS/style/fixed-layout-jp.css 样式文件
    zip.file('OEBPS/style/fixed-layout-jp.css', fixedLayoutJpCssContent)

    // [顺序 6]: OEBPS/text/*.xhtml 页面 XHTML
    for (const textFile of pageResult.textFiles) {
      zip.file(textFile.path, textFile.content)
    }

    // [顺序 7]: OEBPS/image/* 图片资源
    for (const imageFile of pageResult.imageFiles) {
      zip.file(imageFile.path, imageFile.content)
    }

    // 6. 打包生成 EPUB Blob
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE'
    })

    // 7. 触发文件下载（延迟 revoke，避免部分浏览器下载被中断）
    const anchor = document.createElement('a')
    const objectURL = window.URL.createObjectURL(blob)
    anchor.download = (data.bookTitle.trim() || 'untitled') + '.epub'
    anchor.href = objectURL
    anchor.click()
    setTimeout(() => window.URL.revokeObjectURL(objectURL), 10000)
  }
}
