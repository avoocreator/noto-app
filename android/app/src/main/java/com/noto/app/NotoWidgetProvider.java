package com.noto.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextPaint;
import android.text.TextUtils;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.ArrayList;

/**
 * Widget Noto 2×2 — kartu DAFTAR tugas yang warnanya mengikuti tema aplikasi.
 *
 * Cara kerja (100% OFFLINE — tanpa Supabase, tanpa token, tanpa internet):
 * - Aplikasi Noto menulis ringkasan tugas + palet tema aktif ke file
 *   widget-data.json di folder data aplikasi (src/lib/widget-local.ts)
 *   setiap kali data/tema berubah, lalu memicu refresh via WidgetSyncPlugin.
 * - Widget MEMBACA file itu langsung lalu MENGGAMBAR kartunya secara
 *   dinamis (bitmap): gradien membulat + garis tepi, DAFTAR TUGAS dengan
 *   lingkaran centang per baris (selesai = terisi + dicoret), progress bar
 *   tipis + rasio selesai, dan tombol bulat "+".
 * - Jumlah baris daftar MENGIKUTI UKURAN WIDGET: 2×2 memuat ±2 tugas,
 *   perbesar ke 2×3 / 2×4 agar lebih banyak tugas terlihat sekaligus.
 * - Saat app dibuka lagi / ada perubahan data → widget langsung diperbarui.
 *   Selain itu widget menyegarkan diri tiap ±30 menit (updatePeriodMillis).
 *
 * Klik: kartu → buka aplikasi, "+" → form tambah tugas (noto://add),
 * "⟳" → baca ulang file data.
 */
public class NotoWidgetProvider extends AppWidgetProvider {

    private static final String ACTION_REFRESH = "com.noto.app.WIDGET_REFRESH";
    private static final String DATA_FILE = "widget-data.json";

    // Ukuran layout dalam dp — HARUS sinkron dengan widget_noto.xml
    private static final float PAD_V = 19f;    // padding vertikal konten (10 atas + 9 bawah)
    private static final float HEADER_H = 16f; // baris brand/jumlah/refresh
    private static final float LIST_GAP = 6f;  // margin atas+bawah daftar (3+3)
    private static final float BOTTOM_H = 28f; // tinggi baris bawah (tombol +)
    private static final float ROW_H = 26f;    // tinggi satu baris tugas
    private static final float ROW_TEXT = 12.5f; // ukuran teks judul baris

    /** Palet warna widget — diisi dari theme_json (fallback: Noto Gelap). */
    private static class Theme {
        int bg = 0xFF101013;      // latar gradien awal
        int bg2 = 0xFF17171B;     // latar gradien akhir
        int border = 0xFF26262D;  // garis tepi tipis
        int fg = 0xFFEDEDF0;      // teks utama
        int muted = 0xFF9C9CA8;   // teks redup
        int accent = 0xFFF97316;  // aksen (brand, centang, progress, tombol +)
        int accentFg = 0xFFFFFFFF; // warna teks/garis di atas aksen
    }

    /** Satu baris daftar tugas di kartu. */
    private static class Row {
        final String title;
        final boolean done;
        Row(String title, boolean done) { this.title = title; this.done = done; }
    }

    /** Isi kartu untuk satu kondisi tampilan. */
    private static class Card {
        String count = "…";
        String label = "";        // teks kecil setelah angka (mis. "AKTIF")
        int countColor = 0;       // 0 = pakai warna teks utama tema
        final ArrayList<Row> rows = new ArrayList<>();
        String ratio = "";        // "2/5" di samping progress bar
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        pushUpdate(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            pushUpdate(context);
        }
    }

    /** Bangun & pasang tampilan SEMUA widget dari data lokal (offline). */
    public static void pushUpdate(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NotoWidgetProvider.class));

        Card card = new Card();
        Theme theme = new Theme();
        float progress = 0f;

        JSONObject row = readLocal(context);
        if (row == null) {
            // App belum pernah dibuka di HP ini (atau datanya belum ditulis)
            card.count = "N";
            card.label = "BUKA NOTO DULU";
            card.countColor = 0xFFF97316;
            card.rows.add(new Row("Buka aplikasi Noto sekali — kartu ini terisi otomatis (offline).", false));
        } else {
            applyTheme(row, theme);
            int count = row.optInt("todo_count", 0);
            int total = row.optInt("todo_total", -1);
            int done = row.optInt("todo_done", -1);
            if (total > 0 && done >= 0) {
                progress = done / (float) total;
                card.ratio = done + "/" + total;
            }
            parseRows(row, card.rows);
            if (count > 0) {
                card.count = String.valueOf(count);
                card.label = "AKTIF";
            } else {
                card.count = "✓";
                card.label = "SEMUA BERES";
                card.countColor = theme.accent;
                if (card.rows.isEmpty()) card.rows.add(new Row("Semua tugas selesai! 🎉", true));
            }
        }

        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context, id, card, theme, progress, manager));
        }
    }

    // ── Bangun tampilan ──────────────────────────────────────────────

    private static RemoteViews buildViews(Context context, int widgetId, Card card,
                                          Theme theme, float progress, AppWidgetManager manager) {
        float d = context.getResources().getDisplayMetrics().density;
        int[] sizeDp = widgetSizeDp(manager, widgetId);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_noto);

        // Latar kartu (gradien membulat + garis tepi) — warna tema
        views.setImageViewBitmap(R.id.widget_canvas,
                makeCanvas(Math.round(sizeDp[0] * d), Math.round(sizeDp[1] * d),
                        24 * d, theme, Math.max(1f, d)));

        // Warna teks mengikuti tema
        views.setTextColor(R.id.widget_brand, theme.accent);
        views.setTextColor(R.id.widget_refresh, theme.muted);
        views.setTextColor(R.id.widget_count, card.countColor != 0 ? card.countColor : theme.fg);
        views.setTextColor(R.id.widget_ratio, theme.muted);
        views.setTextViewText(R.id.widget_count, card.label.isEmpty() ? card.count : card.count + " " + card.label);
        views.setTextViewText(R.id.widget_ratio, card.ratio);

        // Daftar tugas (bitmap): tinggi = sisa ruang kartu
        int listWdp = Math.max(40, sizeDp[0] - 24); // padding kiri+kanan 12dp
        int listHdp = Math.round(sizeDp[1] - PAD_V - HEADER_H - LIST_GAP - BOTTOM_H);
        listHdp = Math.max((int) ROW_H, listHdp);
        views.setImageViewBitmap(R.id.widget_list,
                makeList(Math.round(listWdp * d), Math.round(listHdp * d), card.rows, theme, d));

        // Progress bar tipis (track redup + isi aksen) + rasio + tombol +
        int contentDp = sizeDp[0] - 24;                 // dikurangi padding kiri+kanan
        int progressDp = Math.max(20, contentDp - 34 - 28 - 14); // rasio + tombol + jarak
        views.setImageViewBitmap(R.id.widget_progress,
                makeProgress(Math.round(progressDp * d), Math.round(5 * d), progress, theme));

        // Tombol bulat "+" warna aksen
        views.setImageViewBitmap(R.id.widget_add, makePlus(Math.round(28 * d), theme));

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

        // Klik kartu → buka aplikasi
        Intent openApp = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openApp != null) {
            views.setOnClickPendingIntent(R.id.widget_root,
                    PendingIntent.getActivity(context, 20, openApp, flags));
        }

        // Tombol "+" → deep link ke form tambah tugas
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("noto://add"));
        add.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_add,
                PendingIntent.getActivity(context, 21, add, flags));

        // Tombol "⟳" → baca ulang file data
        Intent refresh = new Intent(context, NotoWidgetProvider.class);
        refresh.setAction(ACTION_REFRESH);
        views.setOnClickPendingIntent(R.id.widget_refresh,
                PendingIntent.getBroadcast(context, 22, refresh, flags));

        return views;
    }

    /** Ukuran widget saat ini dalam dp (dilaporkan launcher). */
    private static int[] widgetSizeDp(AppWidgetManager manager, int widgetId) {
        try {
            Bundle o = manager.getAppWidgetOptions(widgetId);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110);
            int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
            if (w < 56) w = 110;
            if (h < 56) h = 110;
            return new int[]{w, h};
        } catch (Exception e) {
            return new int[]{110, 110};
        }
    }

    // ── Bitmap dinamis (pengganti drawable statis agar warna bebas) ──

    /** Kanvas kartu: gradien lembut + sudut membulat + garis tepi tipis. */
    private static Bitmap makeCanvas(int w, int h, float radius, Theme t, float borderPx) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
        float half = borderPx * 0.5f + 0.5f;
        RectF r = new RectF(half, half, bmp.getWidth() - half, bmp.getHeight() - half);
        float rad = Math.min(radius, Math.min(r.width(), r.height()) / 2f);
        p.setShader(new LinearGradient(0, 0,
                bmp.getWidth() * 0.72f, bmp.getHeight(), t.bg, t.bg2, Shader.TileMode.CLAMP));
        c.drawRoundRect(r, rad, rad, p);
        p.setShader(null);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(borderPx);
        p.setColor(t.border);
        c.drawRoundRect(r, rad, rad, p);
        return bmp;
    }

    /**
     * Daftar tugas: tiap baris = lingkaran centang + judul (dipotong rapi).
     * Selesai → lingkaran terisi aksen + centang + teks dicoret redup.
     * Jumlah baris otomatis mengikuti tinggi bitmap (tinggi widget).
     */
    private static Bitmap makeList(int w, int h, ArrayList<Row> rows, Theme t, float d) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        if (rows.isEmpty() || w < 40 || h < ROW_H * d * 0.7f) return bmp;

        Canvas c = new Canvas(bmp);
        Paint cp = new Paint(Paint.ANTI_ALIAS_FLAG);           // lingkaran centang
        TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);   // teks judul
        tp.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        tp.setTextSize(ROW_TEXT * d);

        float rowH = ROW_H * d;
        int n = Math.min(rows.size(), (int) (h / rowH));
        for (int i = 0; i < n; i++) {
            Row r = rows.get(i);
            float cy = i * rowH + rowH / 2f;
            float cx = 7f * d;
            float rad = 5.2f * d;

            if (r.done) {
                cp.setStyle(Paint.Style.FILL);
                cp.setColor(t.accent);
                c.drawCircle(cx, cy, rad, cp);
                // centang: dua segmen garis pendek
                Paint chk = new Paint(Paint.ANTI_ALIAS_FLAG);
                chk.setColor(t.accentFg);
                chk.setStyle(Paint.Style.STROKE);
                chk.setStrokeWidth(1.8f * d);
                chk.setStrokeCap(Paint.Cap.ROUND);
                float k = 2.2f * d;
                c.drawLines(new float[]{
                        cx - k, cy, cx - k * 0.3f, cy + k * 0.7f,
                        cx - k * 0.3f, cy + k * 0.7f, cx + k, cy - k * 0.8f,
                }, chk);
            } else {
                cp.setStyle(Paint.Style.STROKE);
                cp.setStrokeWidth(1.7f * d);
                cp.setColor((t.muted & 0x00FFFFFF) | 0x99000000);
                c.drawCircle(cx, cy, rad, cp);
            }

            tp.setStrikeThruText(r.done);
            tp.setColor(r.done ? (t.muted & 0x00FFFFFF) | 0xC8000000 : t.fg);
            CharSequence ell = TextUtils.ellipsize(r.title, tp, w - 17f * d, TextUtils.TruncateAt.END);
            float ty = cy - (tp.ascent() + tp.descent()) / 2f;
            c.drawText(ell.toString(), 16f * d, ty, tp);
        }
        return bmp;
    }

    /** Progress bar: track pil redup + isi pil warna aksen. */
    private static Bitmap makeProgress(int w, int h, float frac, Theme t) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float rad = h / 2f;
        p.setColor((t.muted & 0x00FFFFFF) | 0x33000000);
        c.drawRoundRect(new RectF(0, 0, w, h), rad, rad, p);
        int fillW = Math.round(w * Math.max(0f, Math.min(1f, frac)));
        if (fillW > 0) {
            p.setColor(t.accent);
            c.drawRoundRect(new RectF(0, 0, Math.max(h, fillW), h), rad, rad, p);
        }
        return bmp;
    }

    /** Tombol bulat "+" warna aksen dengan simbol plus di tengah. */
    private static Bitmap makePlus(int size, Theme t) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(1, size), Math.max(1, size), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(t.accent);
        c.drawCircle(size / 2f, size / 2f, size / 2f, p);
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
        tp.setColor(t.accentFg);
        tp.setFakeBoldText(true);
        tp.setTextAlign(Paint.Align.CENTER);
        tp.setTextSize(size * 0.52f);
        float ty = size / 2f - (tp.ascent() + tp.descent()) / 2f;
        c.drawText("+", size / 2f, ty, tp);
        return bmp;
    }

    // ── Data lokal (offline) ─────────────────────────────────────────

    /** Baca widget-data.json yang ditulis aplikasi Noto (folder data app, offline). */
    private static JSONObject readLocal(Context context) {
        try {
            File f = new File(context.getFilesDir(), DATA_FILE);
            if (!f.exists()) return null;
            BufferedReader r = new BufferedReader(new FileReader(f));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            String s = sb.toString().trim();
            if (s.isEmpty()) return null;
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    /** Isi daftar baris dari "items" [{t,d}] — fallback ke "todos_text" (schema lama). */
    private static void parseRows(JSONObject row, ArrayList<Row> out) {
        JSONArray items = row.optJSONArray("items");
        if (items != null) {
            int n = Math.min(items.length(), 12);
            for (int i = 0; i < n; i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                String title = it.optString("t", "").trim();
                if (title.isEmpty()) continue;
                out.add(new Row(title, it.optBoolean("d", false)));
            }
            if (!out.isEmpty()) return;
        }
        String text = row.optString("todos_text", "");
        if (text == null || text.isEmpty()) return;
        String[] lines = text.split("\n");
        for (int i = 0; i < lines.length && i < 12; i++) {
            String s = lines[i].trim();
            if (s.isEmpty() || s.startsWith("Semua tugas selesai")) continue;
            out.add(new Row(s, false));
        }
    }

    /** Isi palet dari theme_json (objek JSON atau string JSON). */
    private static void applyTheme(JSONObject row, Theme t) {
        Object o = row.opt("theme_json");
        JSONObject j = null;
        if (o instanceof JSONObject) {
            j = (JSONObject) o;
        } else if (o instanceof String) {
            try {
                String s = ((String) o).trim();
                if (!s.isEmpty()) j = new JSONObject(s);
            } catch (Exception ignore) { }
        }
        if (j == null) return;
        t.bg = parseColor(j, "bg", t.bg);
        t.bg2 = parseColor(j, "bg2", t.bg2);
        t.border = parseColor(j, "border", t.border);
        t.fg = parseColor(j, "fg", t.fg);
        t.muted = parseColor(j, "muted", t.muted);
        t.accent = parseColor(j, "accent", t.accent);
        t.accentFg = parseColor(j, "accentFg", t.accentFg);
    }

    private static int parseColor(JSONObject j, String k, int fallback) {
        String v = j.optString(k, "");
        if (v == null || !v.matches("#[0-9a-fA-F]{6}")) return fallback;
        try {
            return Color.parseColor(v);
        } catch (Exception e) {
            return fallback;
        }
    }
}
