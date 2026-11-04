import type { DashboardStats } from '@/types'
import {
  fetchOfflinePasswordEntriesRaw,
  getOfflineFavoriteMetaApi,
  getOfflineRecentVisitMetaApi
} from '@/api/offlineVaultLocal'

/** 仪表盘统计 */
export async function getDashboardStatsApi(): Promise<DashboardStats> {
  const [entries, favorites, recents] = await Promise.all([
    fetchOfflinePasswordEntriesRaw(),
    getOfflineFavoriteMetaApi(),
    getOfflineRecentVisitMetaApi()
  ])

  return {
    totalPasswords: entries.length,
    favoriteCount: favorites.length,
    recentCount: recents.length
  }
}
