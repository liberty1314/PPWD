import { useSyncExternalStore } from 'react'

export interface Ref<T> {
  value: T
  subscribe: (listener: () => void) => () => void
}

export type StoreGeneric = Record<string, unknown> & {
  subscribe: (listener: () => void) => () => void
  version: number
}

type UnwrapStore<T> = {
  [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K]
}

export function ref<T>(initialValue: T): Ref<T> {
  let value = initialValue
  const listeners = new Set<() => void>()
  return {
    get value() { return value },
    set value(next) {
      if (Object.is(value, next)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export function computed<T>(getValue: () => T): Ref<T> {
  return { get value() { return getValue() }, subscribe: () => () => undefined }
}

export function createStateStore<T extends Record<string, unknown>>(
  setup: () => T
): (() => UnwrapStore<T> & StoreGeneric) {
  let instance: (UnwrapStore<T> & StoreGeneric) | null = null
  const subscribers = new Set<() => void>()
  let version = 0
  const subscribe = (listener: () => void): (() => void) => {
    subscribers.add(listener)
    return () => subscribers.delete(listener)
  }

  const useStore = (() => {
    if (!instance) {
      const values = setup()
      const store = {} as UnwrapStore<T> & StoreGeneric
      for (const [key, value] of Object.entries(values)) {
        if (value && typeof value === 'object' && 'value' in value) {
          const stateRef = value as Ref<unknown>
          Object.defineProperty(store, key, {
            enumerable: true,
            get: () => stateRef.value,
            set: (next) => { stateRef.value = next }
          })
          stateRef.subscribe(() => {
            version += 1
            subscribers.forEach((listener) => listener())
          })
        } else {
          Object.defineProperty(store, key, { enumerable: true, value })
        }
      }
      Object.defineProperty(store, 'subscribe', { value: subscribe })
      Object.defineProperty(store, 'version', { get: () => version })
      instance = store
    }
    return instance
  }) as (() => UnwrapStore<T> & StoreGeneric)
  return useStore
}

export function useStoreSnapshot<T extends StoreGeneric>(store: () => T): T {
  const instance = store()
  return useSyncExternalStore(instance.subscribe, () => instance.version, () => instance.version) as unknown as T
}
