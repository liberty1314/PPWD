<template>
  <component :is="vaultViewComponent" v-if="vaultViewComponent" />
  <VaultViewPlaceholder v-else />
</template>

<script lang="ts">
export default {
  name: 'VaultView'
}
</script>

<script setup lang="ts">
import { onMounted, shallowRef, type Component } from 'vue'
import VaultViewPlaceholder from '@/views/vault/VaultViewPlaceholder.vue'
import { getPreloadedVaultView, preloadVaultViewChunk } from '@/utils/vaultViewPreload'

const vaultViewComponent = shallowRef<Component | null>(getPreloadedVaultView())

function setVaultViewComponent(component: Component): void {
  vaultViewComponent.value = component
}

onMounted(() => {
  if (vaultViewComponent.value) return
  requestAnimationFrame(() => {
    void preloadVaultViewChunk().then((component) => {
      setVaultViewComponent(component)
    })
  })
})
</script>
