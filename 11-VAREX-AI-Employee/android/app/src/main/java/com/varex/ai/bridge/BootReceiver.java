package com.varex.ai.bridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.varex.ai.storage.SessionStore;

public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SessionStore store = new SessionStore(context);
        if (!store.hasSession() || !store.isConnected()) return;
        try {
            Intent service = new Intent(context, BridgeService.class);
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service);
            else context.startService(service);
        } catch (RuntimeException ignored) {
            store.setLastAction("افتح VAREX AI بعد إعادة تشغيل الهاتف لتفعيل الاتصال.");
        }
    }
}
