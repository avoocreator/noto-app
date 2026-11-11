package app.noto.mobile;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jembatan JS → widget: simpan JSON ringkasan di SharedPreferences lalu minta widget menggambar ulang. */
@CapacitorPlugin(name = "NotoWidget")
public class NotoWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json", "{}");
        Context ctx = getContext();
        ctx.getSharedPreferences(NotoWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString("summary", json).apply();
        Intent i = new Intent(ctx, NotoWidgetProvider.class);
        i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        int[] ids = AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, NotoWidgetProvider.class));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(i);
        call.resolve(new JSObject());
    }
}
