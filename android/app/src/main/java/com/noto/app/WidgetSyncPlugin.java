package com.noto.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin Capacitor kecil: jembatan agar web app bisa memicu refresh widget
 * setiap kali data/tema berubah (dipanggil dari src/lib/widget-local.ts).
 * Widget sendiri membaca data dari file lokal — 100% offline.
 */
@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        NotoWidgetProvider.pushUpdate(getContext());
        call.resolve();
    }
}
