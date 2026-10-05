'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bell, BellOff, Check, Cloud, CloudOff, Copy, Download, Info, Loader2, LogOut,
  Mail, Palette, RefreshCw, Save, Smartphone, Trash2, Upload, Volume2,
} from 'lucide-react'
import { api } from '@/lib/client'
import { useSettings, type FontChoice } from '@/lib/store'
import { ACCENT_SWATCHES, THEMES, applyTheme } from '@/lib/themes'
import { SOUND_PRESETS, playPreset, playDataUrl, type SoundPresetId } from '@/lib/sounds'
import { idbDel, idbGet, idbSet, CUSTOM_SOUND_KEY } from '@/lib/sound-store'
import {
  checkAuthState, normalizeSupabaseKey, normalizeSupabaseUrl,
  onSyncChange, scheduleSync, sendOtp, signOutCloud, syncNow, verifyOtp,
  type CloudSyncState,
} from '@/lib/sync'
import { getNotifPermission, requestNotifPermission } from '@/lib/notif'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const FONTS: { id: FontChoice; label: string; className: string }[] = [
  { id: 'sans', label: 'Sans (modern)', className: 'font-sans' },
  { id: 'serif', label: 'Serif (buku)', className: 'font-serif' },
  { id: 'mono', label: 'Mono (kode)', className: 'font-mono' },
]

export function SettingsView() {
  const settings = useSettings()
  const [notifPermission, setNotifPermission] = useState<string>('default')
  const [hasCustomSound, setHasCustomSound] = useState(false)
  const [customName, setCustomName] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const soundFileRef = useRef<HTMLInputElement>(null)

  // Cloud sync state
  const [cloudState, setCloudState] = useState<CloudSyncState>('unconfigured')
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudEmail, setCloudEmail] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)

  useEffect(() => {
    // Di APK Android izin dicek via plugin native; di browser via web API.
    getNotifPermission().then(setNotifPermission)
    idbGet(CUSTOM_SOUND_KEY).then((v) => setHasCustomSound(Boolean(v))).catch(() => {})
  }, [])

  // Pantau status sinkronisasi cloud + sesi login
  useEffect(() => {
    const un = onSyncChange((s, m) => {
      setCloudState(s)
      setCloudMsg(m ?? '')
    })
    void checkAuthState().then((e) => {
      setCloudEmail(e)
      if (e) void syncNow().catch(() => {})
    })
    return un
  }, [])

  const sendCode = async () => {
    if (!emailInput.includes('@')) return toast.error('Masukkan email yang valid')
    setOtpBusy(true)
    const r = await sendOtp(emailInput)
    setOtpBusy(false)
    if (r.ok) {
      setOtpSent(true)
      toast.success(r.message)
    } else toast.error(r.message)
  }

  const verifyCode = async () => {
    if (otpInput.trim().length < 6) return toast.error('Kode 6 digit belum lengkap')
    setOtpBusy(true)
    const r = await verifyOtp(emailInput, otpInput)
    setOtpBusy(false)
    if (r.ok) {
      setOtpSent(false)
      setOtpInput('')
      setCloudEmail(await checkAuthState())
      toast.success(r.message)
    } else toast.error(r.message)
  }

  const logoutCloud = async () => {
    await signOutCloud()
    setCloudEmail(null)
    setOtpSent(false)
    toast.success('Keluar dari cloud')
  }

  const requestPermission = async () => {
    try {
      const p = await requestNotifPermission()
      setNotifPermission(p)
      if (p === 'granted') toast.success('Izin notifikasi diberikan!')
      else if (p === 'denied')
        toast.info(
          'Izin ditolak. Di HP: tahan ikon Noto → Info aplikasi → Notifikasi → aktifkan manual.',
          { duration: 8000 },
        )
      else toast.info('Izin notifikasi tidak diberikan. Pengingat tetap tampil sebagai toast.')
    } catch {
      toast.error('Gagal meminta izin notifikasi')
    }
  }

  const testSound = async () => {
    if (settings.useCustomSound && hasCustomSound) {
      const d = await idbGet<string>(CUSTOM_SOUND_KEY)
      if (d) return playDataUrl(d, settings.notifVolume)
    }
    playPreset(settings.soundPreset, settings.notifVolume)
  }

  const onUploadSound = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Ukuran maksimal 3 MB')
      return
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      await idbSet(CUSTOM_SOUND_KEY, dataUrl)
      setHasCustomSound(true)
      setCustomName(file.name)
      settings.set({ useCustomSound: true })
      toast.success('Suara kustom tersimpan!')
      void playDataUrl(dataUrl, settings.notifVolume)
    } catch {
      toast.error('Gagal menyimpan suara')
    }
  }

  const removeCustomSound = async () => {
    await idbDel(CUSTOM_SOUND_KEY)
    setHasCustomSound(false)
    setCustomName('')
    settings.set({ useCustomSound: false })
    toast.success('Suara kustom dihapus')
  }

  const exportData = async () => {
    try {
      const data = await api<Record<string, unknown>>('/api/backup')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `noto-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Cadangan diunduh')
    } catch {
      toast.error('Gagal mengekspor data')
    }
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await api('/api/backup', { method: 'POST', body: JSON.stringify({ mode: 'replace', data }) })
      toast.success('Data berhasil dipulihkan! Memuat ulang…')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      toast.error('File cadangan tidak valid')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full pb-28 md:pb-12 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalisasi Noto sesukamu.</p>
      </header>

      {/* ── Tampilan ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-primary" /> Tampilan
        </h2>
        <p className="text-xs text-muted-foreground mb-4">8 mode warna siap pakai + aksen bebas.</p>

        <Label className="text-xs text-muted-foreground">Mode Warna</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2 mb-5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => settings.set({ themeId: t.id })}
              className={cn(
                'rounded-xl border-2 p-2.5 text-left transition-all hover:-translate-y-0.5',
                settings.themeId === t.id ? 'border-primary shadow-md' : 'border-border',
              )}
            >
              <div className="flex gap-1 mb-2">
                {[t.vars.background, t.vars.card, t.vars.primary, t.vars.foreground].map((c, i) => (
                  <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs font-bold flex items-center gap-1">
                {t.name}
                {settings.themeId === t.id && <Check className="w-3 h-3 text-primary" />}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>

        <Label className="text-xs text-muted-foreground">Warna Aksen (kustom)</Label>
        <div className="flex items-center gap-2 flex-wrap mt-2 mb-1.5">
          <button
            onClick={() => settings.set({ accent: '' })}
            className={cn(
              'h-7 px-2.5 rounded-full text-xs font-semibold border transition-all',
              settings.accent === '' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
            )}
          >
            Bawaan tema
          </button>
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => { settings.set({ accent: c }); requestAnimationFrame(() => applyTheme(settings.themeId, c, settings.radius)) }}
              aria-label={`Aksen ${c}`}
              className={cn('w-7 h-7 rounded-full transition-transform hover:scale-110', settings.accent === c && 'ring-2 ring-offset-2 ring-offset-background scale-110')}
              style={{ background: c, boxShadow: settings.accent === c ? `0 0 0 2px ${c}` : undefined }}
            />
          ))}
          <Input
            value={settings.accent}
            onChange={(e) => {
              const v = e.target.value
              settings.set({ accent: v })
              if (/^#[0-9a-fA-F]{6}$/.test(v)) applyTheme(settings.themeId, v, settings.radius)
            }}
            placeholder="#F97316"
            className="w-28 h-7 text-xs font-mono"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label className="text-xs text-muted-foreground">Font Catatan</Label>
            <div className="flex gap-1.5 mt-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => settings.set({ noteFont: f.id })}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-xs font-semibold transition-all',
                    f.className,
                    settings.noteFont === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  {f.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Kelengkungan Sudut</Label>
            <div className="flex items-center gap-3 mt-3">
              <Slider
                value={[settings.radius]}
                min={0.25} max={1.5} step={0.05}
                onValueChange={([v]) => { settings.set({ radius: v }); applyTheme(settings.themeId, settings.accent, v) }}
                className="flex-1"
              />
              <span className="text-xs font-mono text-muted-foreground w-10">{settings.radius.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Notifikasi & Suara ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold flex items-center gap-2 mb-1">
          {settings.notifEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          Notifikasi &amp; Suara
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Pengingat berbunyi saat aplikasi terbuka (termasuk di latar tab aktif).
        </p>

        <div className="flex items-center justify-between py-2 border-b border-border/60">
          <div>
            <p className="text-sm font-semibold">Aktifkan pengingat</p>
            <p className="text-xs text-muted-foreground">Periksa tenggat &amp; pengingat tiap 20 detik</p>
          </div>
          <Switch
            checked={settings.notifEnabled}
            onCheckedChange={(v) => settings.set({ notifEnabled: v })}
            aria-label="Aktifkan pengingat"
          />
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border/60 gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Izin notifikasi sistem</p>
            <p className="text-xs text-muted-foreground">
              Notifikasi muncul bahkan saat tab lain aktif — di APK lewat dialog izin Android, di browser lewat prompt notifikasi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                notifPermission === 'granted' && 'border-emerald-500/50 text-emerald-500',
                notifPermission === 'denied' && 'border-red-500/50 text-red-500',
              )}
            >
              {notifPermission === 'granted' ? 'Diizinkan' : notifPermission === 'denied' ? 'Ditolak' : 'Belum diminta'}
            </Badge>
            {notifPermission !== 'granted' && notifPermission !== 'denied' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={requestPermission}>
                Minta izin
              </Button>
            )}
          </div>
        </div>

        <div className="py-3 border-b border-border/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-muted-foreground" /> Volume
            </p>
            <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.notifVolume * 100)}%</span>
          </div>
          <Slider
            value={[settings.notifVolume]}
            min={0} max={1} step={0.05}
            onValueChange={([v]) => settings.set({ notifVolume: v })}
          />
        </div>

        <div className="py-3 border-b border-border/60">
          <Label className="text-xs text-muted-foreground">Nada Notifikasi</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {SOUND_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => { settings.set({ soundPreset: p.id as SoundPresetId, useCustomSound: false }); playPreset(p.id as SoundPresetId, settings.notifVolume) }}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5',
                  !settings.useCustomSound && settings.soundPreset === p.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border',
                )}
              >
                <p className="text-xs font-bold">{p.emoji} {p.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3">
          <Label className="text-xs text-muted-foreground">Suara Kustom (MP3/OGG/WAV, maks 3MB)</Label>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <input
              ref={soundFileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUploadSound(f)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => soundFileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Unggah suara
            </Button>
            {hasCustomSound && (
              <>
                <Badge variant="outline" className="text-xs gap-1 max-w-44">
                  <span className="truncate">{customName || 'suara-kustom'}</span>
                </Badge>
                <Button
                  variant={settings.useCustomSound ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => settings.set({ useCustomSound: !settings.useCustomSound })}
                >
                  {settings.useCustomSound ? <Check className="w-3.5 h-3.5" /> : null}
                  {settings.useCustomSound ? 'Dipakai' : 'Gunakan'}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={removeCustomSound}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={testSound}>
              <Volume2 className="w-3.5 h-3.5" /> Uji suara
            </Button>
          </div>
        </div>
      </section>

      {/* ── Cloud & Sinkronisasi ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold flex items-center gap-2 mb-1">
          {cloudState === 'error' || cloudState === 'offline' ? (
            <CloudOff className="w-4 h-4 text-destructive" />
          ) : (
            <Cloud className={cn('w-4 h-4', cloudState === 'ok' ? 'text-emerald-500' : 'text-primary')} />
          )}
          Cloud &amp; Sinkronisasi
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Hubungkan Supabase agar catatan &amp; tugas sinkron otomatis antara HP (APK) dan laptop (web).
        </p>

        {/* Status */}
        <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-muted/50 border border-border/60 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {cloudState === 'syncing' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
            {cloudState === 'ok' && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
            {(cloudState === 'error' || cloudState === 'offline') && <CloudOff className="w-4 h-4 text-destructive shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {cloudEmail ?? 'Belum login ke cloud'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {
                  cloudState === 'unconfigured' ? 'Supabase belum dihubungkan' :
                  cloudState === 'syncing' ? (cloudMsg || 'Menyinkronkan…') :
                  cloudState === 'ok' ? (cloudMsg || 'Semua data tersinkron') :
                  cloudState === 'offline' ? 'Tidak ada koneksi internet' :
                  cloudState === 'idle' ? (cloudMsg || 'Menunggu login') :
                  (cloudMsg || 'Terjadi galat sinkronisasi')
                }
              </p>
            </div>
          </div>
          {cloudEmail && (
            <Button
              variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0"
              onClick={() => { void syncNow().then((r) => r.ok ? toast.success(r.message) : toast.error(r.message)) }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sinkron
            </Button>
          )}
        </div>

        {/* Kredensial Supabase */}
        {!cloudEmail && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Project URL</Label>
                <Input
                  value={settings.supabaseUrl}
                  onChange={(e) => settings.set({ supabaseUrl: e.target.value.trim() })}
                  onBlur={() => settings.set({ supabaseUrl: normalizeSupabaseUrl(settings.supabaseUrl) })}
                  placeholder="https://xxxx.supabase.co"
                  className="h-9 text-xs font-mono mt-1"
                  autoCapitalize="off" spellCheck={false}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Anon Key</Label>
                <Input
                  value={settings.supabaseAnonKey}
                  onChange={(e) => settings.set({ supabaseAnonKey: normalizeSupabaseKey(e.target.value) })}
                  onBlur={() => settings.set({ supabaseAnonKey: normalizeSupabaseKey(settings.supabaseAnonKey) })}
                  placeholder="eyJhbGciOi…"
                  className="h-9 text-xs font-mono mt-1"
                  autoCapitalize="off" spellCheck={false}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tempel apa adanya — akhiran <span className="font-mono">/rest/v1</span> pada URL dan spasi pada key otomatis dibersihkan. Keduanya didapat dari Supabase → Project Settings → API. Disimpan hanya di perangkat ini.
            </p>

            {/* Login OTP */}
            <div className="rounded-xl border border-border/60 p-3 space-y-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="email@kamu.com"
                    type="email"
                    className="h-9 pl-8 text-sm"
                    disabled={!settings.supabaseUrl || !settings.supabaseAnonKey}
                  />
                </div>
                <Button
                  size="sm" variant="outline" className="h-9 text-xs shrink-0"
                  disabled={otpBusy || !settings.supabaseUrl || !settings.supabaseAnonKey}
                  onClick={sendCode}
                >
                  {otpBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Kirim kode
                </Button>
              </div>
              {otpSent && (
                <div className="flex gap-2">
                  <Input
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Kode 6 digit dari email"
                    inputMode="numeric"
                    className="h-9 text-sm font-mono tracking-[0.3em]"
                  />
                  <Button size="sm" className="h-9 text-xs shrink-0" disabled={otpBusy} onClick={verifyCode}>
                    {otpBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Verifikasi
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Login tanpa sandi — kode dikirim Supabase ke emailmu. Data tiap pengguna terlindungi RLS.
              </p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Isi email seharusnya <b>kode 6 digit</b>. Kalau yang datang cuma link (atau linknya membuka situs lain): proyek Supabase baru mengunci edit template sampai SMTP kustom dipasang — ikuti PANDUAN bagian 4.5 (Brevo → template → Site URL). Tanpa SMTP pun bisa masuk: atur Site URL dulu, lalu <b>klik link</b> di email.
              </p>
            </div>
          </div>
        )}

        {/* Sudah login */}
        {cloudEmail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/60">
              <div>
                <p className="text-sm font-semibold">Sinkron otomatis</p>
                <p className="text-xs text-muted-foreground">Tiap perubahan dikirim ±4 detik kemudian</p>
              </div>
              <Switch
                checked={settings.cloudAutoSync}
                onCheckedChange={(v) => { settings.set({ cloudAutoSync: v }); if (v) scheduleSync() }}
                aria-label="Sinkron otomatis"
              />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">Data tersinkron dengan semua perangkat yang login email yang sama.</p>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-destructive" onClick={logoutCloud}>
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── Widget ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold flex items-center gap-2 mb-1">
          <Smartphone className="w-4 h-4 text-primary" /> Widget HP
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          APK Android Noto membawa widget layar utama 2×2 — angka tugas aktif, progres, dan tombol tambah cepat.
          Widget berjalan <b>offline</b>: datanya diambil langsung dari aplikasi Noto di HP ini, jadi tidak perlu login cloud sama sekali.
          Buka aplikasinya sekali, widget otomatis terisi — dan warnanya selalu mengikuti tema yang kamu pakai di sini.
        </p>
      </section>

      {/* ── Data ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold flex items-center gap-2 mb-1">
          <Save className="w-4 h-4 text-primary" /> Data &amp; Cadangan
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Semua data tersimpan di database. Ekspor rutin sebagai cadangan, atau pindahkan ke perangkat lain.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file" accept="application/json" className="hidden"
            id="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importData(f)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={exportData}>
            <Download className="w-3.5 h-3.5" /> Ekspor JSON
          </Button>
          <Button
            variant="outline" size="sm" className="text-xs gap-1.5"
            onClick={() => document.getElementById('import-file')?.click()}
          >
            <Upload className="w-3.5 h-3.5" /> Impor JSON
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => setResetOpen(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Reset Tampilan
          </Button>
        </div>
      </section>

      {/* ── Tentang ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center gap-4">
        { }
        <img src="/icons/logo-64.png" alt="Logo Noto" className="w-14 h-14 rounded-2xl" />
        <div className="flex-1">
          <p className="font-bold">Noto <span className="text-xs font-medium text-muted-foreground">v2.0</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workspace pribadi: catatan Markdown, tugas, kanvas, APK Android dengan widget asli, dan sinkron cloud. Gratis selamanya, datamu milikmu.
          </p>
        </div>
        <Info className="w-4 h-4 text-muted-foreground shrink-0" />
      </section>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset pengaturan tampilan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tema, aksen, dan preferensi suara kembali ke bawaan. Catatan &amp; tugas tidak terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { settings.reset(); toast.success('Tampilan direset') }}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
