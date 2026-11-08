import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateThemePreferences } from '../src/utils/themePreferenceMigration.ts'

test('legacy theme migration preserves appearance and maps design and accent defaults', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'midnight' }), {
    appearanceMode: 'dark',
    themeDesign: 'classic',
    accentColor: 'teal'
  })
  assert.deepEqual(migrateThemePreferences({ theme: 'rose' }), {
    appearanceMode: 'light',
    themeDesign: 'classic',
    accentColor: 'coral'
  })
  assert.deepEqual(migrateThemePreferences({ theme: 'system' }), {
    appearanceMode: 'system',
    themeDesign: 'classic',
    accentColor: 'blue'
  })
})

test('new theme fields win over legacy values and migration is idempotent', () => {
  const existing = {
    appearanceMode: 'light',
    themeDesign: 'soft',
    accentColor: 'purple'
  }
  const first = migrateThemePreferences({ theme: 'noir', ...existing })
  const second = migrateThemePreferences({ theme: 'noir', ...first })

  assert.deepEqual(first, existing)
  assert.deepEqual(second, first)
})

test('missing and invalid legacy values use the new install defaults', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'unknown' }), {
    appearanceMode: 'system',
    themeDesign: 'classic',
    accentColor: 'blue'
  })
  assert.deepEqual(migrateThemePreferences({ theme: null }), {
    appearanceMode: 'system',
    themeDesign: 'classic',
    accentColor: 'blue'
  })
})
