import test from 'node:test'
import assert from 'node:assert/strict'
import {
  entryMatchesPage,
  getPageHostLabel,
  getPageWebsiteUrl,
  websiteMatchesPage
} from './websiteMatch.ts'

test('host matching respects subdomains and explicit ports', () => {
  assert.equal(websiteMatchesPage('example.com', 'https://login.example.com/path'), true)
  assert.equal(websiteMatchesPage('example.com', 'https://notexample.com/path'), false)
  assert.equal(websiteMatchesPage('example.com:8443', 'https://example.com:8443/path'), true)
  assert.equal(websiteMatchesPage('example.com:8443', 'https://example.com/path'), false)
})

test('path matching ignores query and fragment but preserves path', () => {
  assert.equal(websiteMatchesPage('https://example.com/login/', 'https://example.com/login?next=1#form', 'path'), true)
  assert.equal(websiteMatchesPage('https://example.com/login', 'https://example.com/account', 'path'), false)
  assert.equal(getPageWebsiteUrl('example.com/login?next=1'), 'https://example.com/login')
})

test('wildcards, IP defaults, and search labels keep their established behavior', () => {
  assert.equal(websiteMatchesPage('*.example.com', 'https://a.example.com'), true)
  assert.equal(websiteMatchesPage('192.168.1.2', 'http://192.168.1.2'), true)
  assert.equal(getPageHostLabel('https://example.com:8443/a'), 'example.com:8443')
  assert.equal(entryMatchesPage([], 'https://example.com'), false)
})
