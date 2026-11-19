# QuickSo 水印相机生成器

双击 `index.html` 即可使用，也可以将目录内容部署到静态网站。无需安装依赖或启动服务。支持 `?embed=1` 隐藏独立站页头。

选择或拖入浏览器可读取的照片，在“水印模板”中选择样式。默认模板为「元道-现场拍照」：手动填写经度、纬度、坐标系、地址、时间、海拔、天气和备注，也可通过“填入示例”快速试用。天气图标可按文字自动识别，也可手动选择或关闭。“排版设置”可调整字号、压暗底部，或修改中央「现场拍照」和右下角弧形「元道经纬相机」水印；清空文字即可隐藏对应水印。

预览和下载在本地完成，支持 JPG 和 PNG。下载保留照片比例，不裁切；超过 1600 万像素或单边超过 8192 像素时会等比缩小并提示。浏览器不支持的格式（如部分手机上的 HEIC）需先转成 JPG 或 PNG；动图导出为静态图片。导出图片由画布重新编码，不复制原图 EXIF。

新增模板时，在 `watermark.js` 的 `templates` 中登记名称、绘制函数和可选示例，在 `index.html` 中添加同 ID 的 `data-template-panel` 设置区。预览和下载共用所选模板的绘制函数。

参考了 GitHub 上的 [watermarkjs](https://github.com/brianium/watermarkjs) 和 [Media-Watermarking-Tool](https://github.com/Barzil-1/Media-Watermarking-Tool) 的本地处理、文件输入和 Canvas 绘制思路。项目使用独立实现，无运行时依赖。
