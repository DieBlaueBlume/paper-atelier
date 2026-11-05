# 第三方组件

离线 HTML 内嵌 pdf-lib 1.17.1（MIT）和 Mozilla PDF.js 5.6.205（Apache-2.0），以及随这两个发行包分发的 PDF 编解码、字体与字符映射资源。pdf-lib 的构建还包含 @pdf-lib/standard-fonts、@pdf-lib/upng、pako 与 tslib。

构建程序从安装包读取许可及版权说明，写入成品的 licenses 区块。字体与解码器适用各自的许可。版本与包完整性校验值见 package-lock.json。

Playwright 仅用于开发测试，不随用户下载的 HTML 分发。
