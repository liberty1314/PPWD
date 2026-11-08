import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateThemePreferences } from '../src/utils/themePreferenceMigration.ts'

test('legacy theme choices migrate to liquid glass with system appearance', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'midnight' }), {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
  assert.deepEqual(migrateThemePreferences({ theme: 'rose' }), {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
  assert.deepEqual(migrateThemePreferences({ theme: 'system' }), {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
})

test('legacy preference fields are overridden and migration is idempotent', () => {
  const existing = {
    appearanceMode: 'dark',
    themeDesign: 'contrast',
    accentColor: 'purple'
  }
  const first = migrateThemePreferences({ theme: 'noir', ...existing })
  const second = migrateThemePreferences({ theme: 'noir', ...first })

  assert.deepEqual(first, {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
  assert.deepEqual(second, first)
})

test('missing and invalid legacy values use the new install defaults', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'unknown' }), {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
  assert.deepEqual(migrateThemePreferences({ theme: null }), {
    appearanceMode: 'system',
    themeDesign: 'liquid',
    accentColor: 'blue'
  })
})
