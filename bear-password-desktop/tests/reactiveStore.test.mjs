import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, createStateStore, ref } from '../src/stores/reactiveStore.ts'

test('framework-neutral stores expose unwrapped state and notify subscribers', () => {
  const useCounter = createStateStore(() => {
    const count = ref(1)
    return {
      count,
      doubled: computed(() => count.value * 2),
      increment: () => { count.value += 1 }
    }
  })
  const counter = useCounter()
  let notifications = 0
  const unsubscribe = counter.subscribe(() => { notifications += 1 })

  assert.equal(counter.count, 1)
  assert.equal(counter.doubled, 2)
  counter.increment()
  assert.equal(counter.count, 2)
  assert.equal(counter.doubled, 4)
  assert.equal(notifications, 1)

  unsubscribe()
  counter.count = 3
  assert.equal(counter.doubled, 6)
  assert.equal(notifications, 1)
})
