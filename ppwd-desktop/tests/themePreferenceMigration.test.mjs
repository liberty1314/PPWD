import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateThemePreferences } from '../src/utils/themePreferenceMigration.ts'

const defaults = {
  appearanceMode: 'system',
  themeDesign: 'liquid',
  accentColor: 'blue'
}

test('legacy appearance choices migrate without discarding valid current fields', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'midnight' }), { ...defaults, appearanceMode: 'dark' })
  assert.deepEqual(migrateThemePreferences({ theme: 'rose' }), defaults)
  assert.deepEqual(migrateThemePreferences({ theme: 'light' }), { ...defaults, appearanceMode: 'light' })
})

test('valid theme preference fields survive migration', () => {
  assert.deepEqual(migrateThemePreferences({
    appearanceMode: 'dark',
    themeDesign: 'contrast',
    accentColor: 'purple'
  }), {
    appearanceMode: 'dark',
    themeDesign: 'contrast',
    accentColor: 'purple'
  })
})

test('invalid preference fields use defaults independently', () => {
  assert.deepEqual(migrateThemePreferences({
    appearanceMode: 'sepia',
    themeDesign: 'unknown',
    accentColor: 'pink'
  }), defaults)
})

test('missing and invalid legacy values use install defaults', () => {
  assert.deepEqual(migrateThemePreferences({ theme: 'unknown' }), defaults)
  assert.deepEqual(migrateThemePreferences({ theme: null }), defaults)
})
