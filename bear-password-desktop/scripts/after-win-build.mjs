import {
  existsSync,
  readdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { releaseDir } from '../../scripts/release-dir.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const setupPath = join(releaseDir, 'PPWD-Setup.exe')

const extraArtifacts = [
  'PPWD-win-x64.zip',
  'PPWD-Windows-安装包.zip',
  'PPWD-Setup.exe.blockmap',
  'latest.yml',
  '安装说明.txt',
  'win-unpacked',
  'builder-debug.yml',
  'builder-effective-config.yaml'
]

if (!existsSync(releaseDir)) {
  console.warn('[after-win-build] release 目录不存在，跳过')
  process.exit(0)
}

function renameArtifact(oldName, newName) {
  const from = join(releaseDir, oldName)
  const to = join(releaseDir, newName)
  if (!existsSync(from) || from === to) return
  if (existsSync(to)) {
    rmSync(to, { force: true })
  }
  renameSync(from, to)
}

for (const name of readdirSync(releaseDir)) {
  const nsisMatch = name.match(/^PPWD(?: Setup)?(?:\s[\d.]+)?\.exe$/i)
  if (nsisMatch) {
    renameArtifact(name, 'PPWD-Setup.exe')
  }
}

for (const name of extraArtifacts) {
  rmSync(join(releaseDir, name), { recursive: true, force: true })
}

if (existsSync(setupPath)) {
  console.log(`[after-win-build] Windows 产物：${setupPath}`)
} else {
  console.warn('[after-win-build] 未生成 PPWD-Setup.exe')
}
