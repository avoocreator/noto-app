package app.noto.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget 2×2: judul + sampai 5 baris tugas/catatan, tombol "+ Catatan". Data dari SharedPreferences. */
public class NotoWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "noto_widget";
    private static final int[] LINE_IDS = { R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("summary", null);
        for (int id : ids) mgr.updateAppWidget(id, build(ctx, raw));
    }

    private RemoteViews build(Context ctx, String raw) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_noto);
        String title = "Noto", subtitle = "Buka untuk memuat";
        JSONArray lines = new JSONArray();
        try {
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                title = o.optString("title", title);
                subtitle = o.optString("subtitle", "");
                lines = o.optJSONArray("lines");
                if (lines == null) lines = new JSONArray();
            }
        } catch (Exception ignored) { }
        v.setTextViewText(R.id.w_title, title);
        v.setTextViewText(R.id.w_sub, subtitle);
        for (int i = 0; i < LINE_IDS.length; i++) {
            String t = "";
            if (i < lines.length()) {
                JSONObject l = lines.optJSONObject(i);
                if (l != null) {
                    JSONObject task = l.optJSONObject("task");
                    String mark = task == null ? "• " : (task.optBoolean("done") ? "✓ " : "○ ");
                    t = mark + l.optString("text", "");
                }
            }
            v.setTextViewText(LINE_IDS[i], t);
        }
        v.setOnClickPendingIntent(R.id.w_root, link(ctx, "noto://daily", 1));
        v.setOnClickPendingIntent(R.id.w_add, link(ctx, "noto://new", 2));
        return v;
    }

    private PendingIntent link(Context ctx, String uri, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
