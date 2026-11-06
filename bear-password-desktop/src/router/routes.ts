import type { RouteRecordRaw } from 'vue-router'

const VaultView = () => import('@/views/vault/VaultViewHost.vue')

export const routes: RouteRecordRaw[] = [
  { path: '/setup', name: 'Setup', component: () => import('@/views/unlock/SetupView.vue') },
  { path: '/bind', name: 'Bind', component: () => import('@/views/unlock/BindView.vue') },
  { path: '/unlock', name: 'Unlock', component: () => import('@/views/unlock/UnlockView.vue') },
  { path: '/recover', name: 'Recover', component: () => import('@/views/unlock/RecoverView.vue') },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresUnlock: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { title: '首页', icon: 'dashboard' }
      },
      { path: 'vault', name: 'Vault', component: VaultView, meta: { title: '密码库', icon: 'vault' } },
      {
        path: 'favorites',
        name: 'Favorites',
        component: VaultView,
        meta: { title: '收藏夹', icon: 'favorites', mode: 'favorites' }
      },
      {
        path: 'recent',
        name: 'Recent',
        component: VaultView,
        meta: { title: '最近访问', icon: 'recent', mode: 'recent' }
      },
      { path: 'settings', redirect: '/dashboard' },
      { path: 'profile', redirect: '/dashboard' }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]
