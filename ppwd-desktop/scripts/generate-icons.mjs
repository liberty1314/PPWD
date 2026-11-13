import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const repoRoot = join(root, '..')
const resourcesDir = join(root, 'resources')
const sourceLogoPath = join(repoRoot, 'docs', 'img', 'logo.png')
const brandMarkPath = join(root, 'src', 'assets', 'brand-mark.png')
const traySvgPath = join(resourcesDir, 'tray-icon.svg')
const publicDir = join(root, 'public')
const extensionIconsDir = join(root, '..', 'ppwd-extension', 'public', 'icons')

// 图三已是白底正方形构图，直接等比缩放，避免裁切时改变原图内容。
const markBuffer = await sharp(sourceLogoPath).resize(1024, 1024).png().toBuffer()

await sharp(markBuffer).png().toFile(brandMarkPath)
await sharp(markBuffer).resize(512, 512).png().toFile(join(extensionIconsDir, 'logo.png'))
await sharp(markBuffer).resize(512, 512).png().toFile(join(resourcesDir, 'icon.png'))
await sharp(markBuffer).resize(256, 256).png().toFile(join(publicDir, 'favicon.png'))
await sharp(traySvgPath).resize(22, 22).png().toFile(join(resourcesDir, 'tray-icon.png'))
await sharp(traySvgPath).resize(44, 44).png().toFile(join(resourcesDir, 'tray-icon@2x.png'))

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(markBuffer).resize(size, size).png().toBuffer())
)
writeFileSync(join(resourcesDir, 'icon.ico'), await pngToIco(icoBuffers))

for (const size of [16, 32, 48, 128]) {
  await sharp(markBuffer).resize(size, size).png().toFile(join(extensionIconsDir, `icon-${size}.png`))
}

if (process.platform === 'darwin') {
  const iconsetDir = join(resourcesDir, 'icon.iconset')
  rmSync(iconsetDir, { recursive: true, force: true })
  mkdirSync(iconsetDir, { recursive: true })
  const iconsetEntries = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']
  ]
  for (const [size, filename] of iconsetEntries) {
    await sharp(markBuffer).resize(size, size).png().toFile(join(iconsetDir, filename))
  }
  const icnsPath = join(resourcesDir, 'icon.icns')
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`)
  } catch (error) {
    if (!existsSync(icnsPath)) throw error
    console.warn('[generate-icons] iconutil 转换失败，已保留现有 resources/icon.icns')
  }
  rmSync(iconsetDir, { recursive: true, force: true })
}

console.log('App icons generated from docs/img/logo.png')
