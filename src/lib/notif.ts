// ── Notifikasi lintas platform (browser PWA + app Android) ─────────
// Di browser: Web Notification API biasa.
// Di app Android (Capacitor WebView): API web Notification TIDAK
// tersedia — dulu selalu gagal ("Gagal meminta izin notifikasi").
// Sekarang izin & notifikasi dijembatani ke sistem Android lewat
// @capacitor/local-notifications → dialog izin bawaan Android 13+
// (POST_NOTIFICATIONS) + notifikasi asli di system tray.

'use client'

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export type NotifPermission = 'granted' | 'denied' | 'default'

/** true bila Noto berjalan sebagai app Android (bukan browser). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** Cek status izin notifikasi saat ini. */
export async function getNotifPermission(): Promise<NotifPermission> {
  if (isNativeApp()) {
    try {
      const s = await LocalNotifications.checkPermissions()
      return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'default'
    } catch {
      return 'default'
    }
  }
  if (typeof Notification === 'undefined') return 'default'
  return Notification.permission as NotifPermission
}

/** Minta izin notifikasi (dialog sistem di Android, prompt browser di web). */
export async function requestNotifPermission(): Promise<NotifPermission> {
  if (isNativeApp()) {
    try {
      const s = await LocalNotifications.requestPermissions()
      return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'default'
    } catch {
      return 'denied'
    }
  }
  if (typeof Notification === 'undefined') return 'default'
  try {
    return (await Notification.requestPermission()) as NotifPermission
  } catch {
    return 'denied'
  }
}

/** ID unik deterministik dari tag (plugin Android butuh integer). */
function notifIdFromTag(tag: string, salt: number): number {
  let h = salt
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return (h % 2000000000) + 1
}

/**
 * Tampilkan notifikasi: asli di system tray Android saat dijalankan
 * sebagai APK, atau notifikasi web di browser. Gagal selalu di-swallow
 * supaya toast + suara di aplikasi tetap jalan.
 */
export async function showNotif(title: string, body: string, tag?: string): Promise<void> {
  if (isNativeApp()) {
    try {
      if ((await getNotifPermission()) !== 'granted') return
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifIdFromTag(tag ?? title, 7),
            title,
            body,
            ...(tag ? { tag } : {}),
          },
        ],
      })
    } catch {
      // diam — suara + toast in-app tetap berbunyi
    }
    return
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png', tag })
    } catch {
      // diam
    }
  }
}
