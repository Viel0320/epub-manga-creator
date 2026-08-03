# EPUB Manga Creator

[English](README.md) | 简体中文

现代、快速的 Web 端漫画/单行本图片打包生成 EPUB 工具。

生成的 EPUB 文件结构符合[日本数字漫画协会](http://www.digital-comic.jp/)（デジタルコミック協議会）的标准规范。

🚀 **[点击此处在线体验应用](https://viel0320.github.io/epub-manga-creator)**

---

## 功能特性

- **现代构建技术栈**：基于 **Vite 8**、**React 19** 和 **MobX 6** 构建，提供极速的开发启动、即时热更新（HMR）及优化的生产环境打包。
- **PNPM 包管理器**：使用 **pnpm** 进行高效的依赖管理和磁盘空间利用。
- **工作区自动持久化**：内置基于 IndexedDB 的本地存储引擎，自动实时保存工作区状态、图片 Blob 与配置，防止页面刷新或意外关闭导致数据丢失。
- **双规格 EPUB 重导入与解析器**：全功能 EPUB 导入解析器，支持上传现有 EPUB 文件并还原编辑。同时兼容 EPUB 3 (`<nav epub:type="toc">`、`properties="cover-image"`) 与 EPUB 2 (`toc.ncx`、`<guide>`、`<meta name="cover">`) 规范。
- **标准化页面适配模式**：支持 `contain`（适应）、`cover`（裁切）、`fill`（拉伸）三大 CSS / SVG `preserveAspectRatio` 标准对齐与尺寸填充模式。
- **全屏沉浸式 Lightbox 预览**：内置交互式全屏阅读器，支持单页与双页连页无缝预览、缩放与排版排查。
- **多语言支持 (L10n)**：内置支持 **简体中文** 与 **英文**。
  - 首次加载自动识别浏览器语言偏好。
  - 可以在导航栏平滑切换语言。
  - 自动本地保存（`localStorage`）你的语言偏好设置。
- **漫画打包核心功能**：
  - 支持图片分页控制、双页切割/拼页处理、翻页方向设置（日漫右开/RTL 或普通左开/LTR）。
  - 内置日本主要出版商及常见主题分类数据。
  - 支持“预设保存”功能，方便重复复用元数据。

---

## 跨阅读器兼容性说明

本项目致力于通过规范化的结构输出，使**同一份 EPUB 文件**在不同阅读应用与设备上均能获得出色的兼容体验。以下为常见阅读器与设备的实测验证与表现总结：

- [Starrea](https://apps.microsoft.com/detail/9p8xwg60cqd2)（Windows）：不支持 Spine 跨页拼页与图片拉伸样式
- [Readest](https://github.com/readest/readest)（Android & Windows）：会覆盖图片自定义样式；Android 端不支持 Spine 跨页拼页
- [Calibre](https://calibre-ebook.com/)（Windows）：内置阅读器不支持 Spine 跨页拼页
- [Rodel Reader](https://apps.microsoft.com/detail/9p6796l4r67r)（漫画模式 / Manga mode）（Windows）：自研渲染引擎会剥离传入的自定义 CSS 样式
- [Kindle 应用与设备](https://www.amazon.com/sendtokindle)（通过 Send to Kindle 投递；Android、Windows 及 KPW5 上的 Kindle OS 5.19.2）：会覆盖图片样式；受 Kindle 排版算法影响，跨页预览偶有误触发（Spine 拼页功能本身正常）
- [Jane Reader](https://janereader.com)（Windows）：不支持 Spine 跨页拼页，会覆盖图片样式
- [Koodo Reader](https://www.koodoreader.com/zh)（Web）：不支持 Spine 跨页拼页，会覆盖图片样式

---

## 本地开发指南

### 环境要求

- **Node.js**：推荐 v24.x 或更高
- **包管理器**：[PNPM](https://pnpm.io/)

### 快速开始

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **启动开发服务器**
   ```bash
   pnpm start
   ```
   在浏览器中打开终端输出的地址（通常为 `http://localhost:5173`）。

3. **打包生产环境**
   ```bash
   pnpm build
   ```
   进行 TypeScript 校验并将静态资源打包至 `dist/` 目录。

4. **预览生产打包产物**
   ```bash
   pnpm preview
   ```
   启动本地服务器以测试 `dist/` 目录下的构建产物。

---

## 致谢

特别感谢以下上游项目提供的灵感与基础支持：

- [wing-kai/epub-manga-creator](https://github.com/wing-kai/epub-manga-creator)
- [Joycai/epub-manga-creator](https://github.com/Joycai/epub-manga-creator)

