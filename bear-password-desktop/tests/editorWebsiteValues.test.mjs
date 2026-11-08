import test from 'node:test'
import assert from 'node:assert/strict'
import { getEditorWebsiteText, getEditorWebsites } from '../src/utils/editorWebsiteValues.ts'

test('editor website input tolerates entries without a website list', () => {
  assert.equal(getEditorWebsiteText(undefined), '')
})

test('editor website input formats saved website values', () => {
  assert.equal(getEditorWebsiteText(['example.com', 'login.example.com']), 'example.com, login.example.com')
  assert.deepEqual(getEditorWebsites(['example.com', undefined, 42]), ['example.com'])
})
