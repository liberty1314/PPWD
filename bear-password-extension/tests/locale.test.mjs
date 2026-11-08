import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOCALE_PREFERENCE,
  normalizeLocalePreference,
  resolveLocale,
  subscribeSystemLocaleChange,
  syncSystemLocale
} from '../src/shared/locale/locale.ts'

test('locale preference normalization keeps supported values and falls back safely', () => {
  assert.equal(normalizeLocalePreference('en-US'), 'en')
  assert.equal(normalizeLocalePreference('ja'), 'ja')
  assert.equal(normalizeLocalePreference('unsupported'), DEFAULT_LOCALE_PREFERENCE)
  assert.equal(normalizeLocalePreference(undefined), DEFAULT_LOCALE_PREFERENCE)
})

test('system locale resolution uses the browser locale when requested', () => {
  const previousNavigator = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'ja-JP' }
  })

  try {
    assert.equal(resolveLocale('system'), 'ja')
    assert.equal(resolveLocale('en'), 'en')
  } finally {
    if (previousNavigator === undefined) {
      delete globalThis.navigator
    } else {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator })
    }
  }
})

test('system locale changes notify active listeners and unsubscribe removes them', () => {
  let calls = 0
  const unsubscribe = subscribeSystemLocaleChange(() => calls++)

  syncSystemLocale()
  unsubscribe()
  syncSystemLocale()

  assert.equal(calls, 1)
})
