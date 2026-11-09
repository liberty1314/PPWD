import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resourcesDir = join(root, 'resources')
const logoPngPath = join(root, '..', 'docs', 'img', 'logo.png')
const traySvgPath = join(resourcesDir, 'tray-icon.svg')
const publicDir = join(root, 'public')
const desktopLogoPath = join(root, 'src', 'assets', 'logo.png')
const extensionIconsDir = join(root, '..', 'ppwd-extension', 'public', 'icons')

const sourcePngBuffer = await sharp(logoPngPath).resize(1024, 1024).png().toBuffer()
const roundedMask = Buffer.from(
  '<svg width="1024" height="1024"><rect x="0" y="0" width="1024" height="1024" rx="220" fill="white"/></svg>'
)
const pngBuffer = await sharp(sourcePngBuffer)
  .composite([{ input: roundedMask, blend: 'dest-in' }])
  .png()
  .toBuffer()

await sharp(pngBuffer).resize(512, 512).png().toFile(desktopLogoPath)
await sharp(pngBuffer).resize(512, 512).png().toFile(join(extensionIconsDir, 'logo.png'))
await sharp(pngBuffer).resize(512, 512).png().toFile(join(resourcesDir, 'icon.png'))
await sharp(pngBuffer).resize(256, 256).png().toFile(join(publicDir, 'favicon.png'))
await sharp(traySvgPath).resize(22, 22).png().toFile(join(resourcesDir, 'tray-icon.png'))
// macOS 菜单栏另备 @2x，提升 Retina 清晰度
await sharp(traySvgPath).resize(44, 44).png().toFile(join(resourcesDir, 'tray-icon@2x.png'))

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(pngBuffer).resize(size, size).png().toBuffer())
)
const icoBuffer = await pngToIco(icoBuffers)
writeFileSync(join(resourcesDir, 'icon.ico'), icoBuffer)

for (const size of [16, 32, 48, 128]) {
  await sharp(pngBuffer).resize(size, size).png().toFile(join(extensionIconsDir, `icon-${size}.png`))
}

if (process.platform === 'darwin') {
  const iconsetDir = join(resourcesDir, 'icon.iconset')
  rmSync(iconsetDir, { recursive: true, force: true })
  mkdirSync(iconsetDir, { recursive: true })

  const iconsetEntries = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ]

  for (const [size, filename] of iconsetEntries) {
    await sharp(pngBuffer).resize(size, size).png().toFile(join(iconsetDir, filename))
  }

  const icnsPath = join(resourcesDir, 'icon.icns')
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`)
  } catch (error) {
    if (!existsSync(icnsPath)) {
      throw error
    }
    console.warn(
      '[generate-icons] iconutil 转换 icon.iconset 失败，已保留现有 resources/icon.icns'
    )
  }
  rmSync(iconsetDir, { recursive: true, force: true })
}

console.log('App icons generated in resources/ and public/favicon.png')
