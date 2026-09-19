package com.varex.ai.bridge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import com.varex.ai.MainActivity;
import com.varex.ai.R;
import com.varex.ai.network.ApiClient;
import com.varex.ai.network.ApiException;
import com.varex.ai.storage.SessionStore;

import org.json.JSONObject;

import java.net.URLEncoder;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class BridgeService extends Service {
    public static final String ACTION_EVENT = "com.varex.ai.BRIDGE_EVENT";
    private static final String CHANNEL_ID = "varex_ai_bridge";
    private static final int NOTIFICATION_ID = 7041;
    private ScheduledExecutorService scheduler;
    private SessionStore store;
    private ApiClient api;

    @Override public void onCreate() {
        super.onCreate();
        store = new SessionStore(this);
        api = new ApiClient(store);
        createChannel();
        Notification notification = notification("هاتفك متصل بالموظف الذكي");
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(NOTIFICATION_ID, notification);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!store.hasSession() || !store.isConnected() || store.organizationId().isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (scheduler == null || scheduler.isShutdown()) {
            scheduler = Executors.newSingleThreadScheduledExecutor();
            scheduler.scheduleWithFixedDelay(this::poll, 0, 3, TimeUnit.SECONDS);
        }
        return START_STICKY;
    }

    private void poll() {
        if (!store.hasSession() || !store.isConnected()) { stopSelf(); return; }
        try {
            JSONObject pendingResult = store.pendingResult();
            if (pendingResult != null) {
                deliverResult(pendingResult);
                return;
            }
            String query = "?organization_id=" + encode(store.organizationId()) + "&device_id=" + encode(store.deviceId());
            JSONObject response = api.getObject("/devices/commands" + query);
            JSONObject command = response.optJSONObject("command");
            if (command == null) return;
            String executionId = command.optString("id", "");
            if (executionId.isEmpty()) return;
            updateNotification("جاري تنفيذ: " + command.optString("app_key", "مهمة الهاتف"));
            ExecutionResult result = new CommandExecutor(this, store).execute(command);
            JSONObject body = new JSONObject()
                    .put("organization_id", store.organizationId())
                    .put("device_id", store.deviceId())
                    .put("status", result.status)
                    .put("summary", result.summary)
                    .put("error_code", result.errorCode)
                    .put("details", result.details);
            JSONObject savedResult = new JSONObject()
                    .put("execution_id", executionId)
                    .put("body", body)
                    .put("summary", result.summary);
            store.setPendingResult(savedResult);
            deliverResult(savedResult);
        } catch (Exception exception) {
            String message = exception.getMessage() == null ? "تعذر الاتصال بالخادم" : exception.getMessage();
            updateNotification("بانتظار اتصال آمن بالخادم");
            sendEvent(message);
        }
    }

    private void deliverResult(JSONObject savedResult) throws Exception {
        String executionId = savedResult.optString("execution_id", "");
        JSONObject body = savedResult.optJSONObject("body");
        if (executionId.isEmpty() || body == null) {
            store.clearPendingResult();
            throw new IllegalStateException("نتيجة محلية غير صالحة؛ تم حذفها بأمان");
        }
        try {
            api.post("/devices/commands/" + encode(executionId) + "/result", body);
        } catch (ApiException exception) {
            if (exception.statusCode() != 409) throw exception;
            store.clearPendingResult();
            String closed = "أغلق الخادم المهمة مسبقاً؛ لم يُعَد تنفيذها على الهاتف";
            store.setLastAction(closed);
            updateNotification(closed);
            sendEvent(closed);
            return;
        }
        store.clearPendingResult();
        String summary = savedResult.optString("summary", "تم إرسال نتيجة المهمة إلى VAREX AI");
        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        store.setLastAction(stamp + " — " + summary);
        updateNotification(summary);
        sendEvent(summary);
    }

    private void sendEvent(String message) {
        Intent event = new Intent(ACTION_EVENT).setPackage(getPackageName()).putExtra("message", message);
        sendBroadcast(event);
    }

    private Notification notification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle("VAREX AI")
                .setContentText(text)
                .setContentIntent(open)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    private void createChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, getString(R.string.bridge_channel), NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.bridge_channel_description));
        channel.setShowBadge(false);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, notification(text));
    }

    private static String encode(String value) {
        try { return URLEncoder.encode(value, "UTF-8"); }
        catch (Exception ignored) { return value; }
    }

    @Override public void onDestroy() {
        if (scheduler != null) scheduler.shutdownNow();
        scheduler = null;
        super.onDestroy();
    }

    @Override public void onTimeout(int startId, int fgsType) {
        store.setLastAction("أوقف Android خدمة الاتصال مؤقتاً؛ افتح VAREX AI لإعادة تشغيلها.");
        stopSelf(startId);
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
