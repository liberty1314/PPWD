import test from 'node:test'
import assert from 'node:assert/strict'
import { canHideDockIcon, resolveDockSettingsAtStartup } from '../electron/main/dockPolicy.ts'

test('Dock icon can only be hidden when a working tray reopen route exists', () => {
  assert.equal(canHideDockIcon(true), true)
  assert.equal(canHideDockIcon(false), false)
})

test('startup restores the Dock icon when the tray reopen route is unavailable', () => {
  assert.deepEqual(resolveDockSettingsAtStartup({ hidden: true }, false), { hidden: false })
  assert.deepEqual(resolveDockSettingsAtStartup({ hidden: true }, true), { hidden: true })
})
