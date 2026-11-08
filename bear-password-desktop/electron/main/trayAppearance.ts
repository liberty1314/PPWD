import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_TRAY_MENU_LABELS,
  type TrayAppearanceSnapshot,
  type TrayMenuLabels
} from '../../shared/trayMenu'

function getSnapshotPath(): string {
  return join(app.getPath('userData'), 'tray-appearance.json')
}

function mergeLabels(labels?: Partial<TrayMenuLabels>): TrayMenuLabels {
  return {
    ...DEFAULT_TRAY_MENU_LABELS,
    ...labels,
    locales: { ...DEFAULT_TRAY_MENU_LABELS.locales, ...labels?.locales },
    fonts: { ...DEFAULT_TRAY_MENU_LABELS.fonts, ...labels?.fonts }
  }
}

export function saveTrayAppearanceSnapshot(snapshot: TrayAppearanceSnapshot): TrayAppearanceSnapshot {
  const normalized: TrayAppearanceSnapshot = {
    locale: snapshot.locale,
    font: snapshot.font,
    labels: mergeLabels(snapshot.labels)
  }
  writeFileSync(getSnapshotPath(), JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

export function loadTrayAppearanceSnapshot(): TrayAppearanceSnapshot {
  const filePath = getSnapshotPath()
  if (!existsSync(filePath)) {
    return {
      locale: 'zh-CN',
      font: 'system',
      labels: DEFAULT_TRAY_MENU_LABELS
    }
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<TrayAppearanceSnapshot>
    return {
      locale: typeof raw.locale === 'string' ? raw.locale : 'zh-CN',
      font: typeof raw.font === 'string' ? raw.font : 'system',
      labels: mergeLabels(raw.labels)
    }
  } catch {
    return {
      locale: 'zh-CN',
      font: 'system',
      labels: DEFAULT_TRAY_MENU_LABELS
    }
  }
}
