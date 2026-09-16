package com.varex.ai.actions;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.BatteryManager;
import android.provider.Settings;

import com.varex.ai.bridge.ExecutionResult;
import com.varex.ai.bridge.InstructionParser;

import org.json.JSONObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SettingsExecutor {
    private final Context context;

    public SettingsExecutor(Context context) { this.context = context; }

    public ExecutionResult execute(String action, String target, JSONObject payload) {
        try {
            String instruction = InstructionParser.normalizeDigits(payload.optString("instruction", target)).toLowerCase();
            if (action.equals("view")) return status();
            if (action.equals("open")) return open(instruction);
            if (action.equals("change")) return change(instruction, payload);
            return ExecutionResult.failed("UNSUPPORTED_SETTINGS_ACTION", "عملية الإعدادات غير مدعومة");
        } catch (Exception exception) {
            return ExecutionResult.failed("SETTINGS_EXECUTION_FAILED", "تعذر تنفيذ أمر الإعدادات: " + (exception.getMessage() == null ? "خطأ من نظام الهاتف" : exception.getMessage()));
        }
    }

    private ExecutionResult status() throws Exception {
        ContentResolver resolver = context.getContentResolver();
        int brightness = Settings.System.getInt(resolver, Settings.System.SCREEN_BRIGHTNESS, -1);
        int timeout = Settings.System.getInt(resolver, Settings.System.SCREEN_OFF_TIMEOUT, -1);
        int rotation = Settings.System.getInt(resolver, Settings.System.ACCELEROMETER_ROTATION, -1);
        BatteryManager battery = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
        int level = battery == null ? -1 : battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        JSONObject details = new JSONObject().put("brightness", brightness).put("screen_timeout_ms", timeout).put("auto_rotate", rotation == 1).put("battery_percent", level).put("can_write_settings", Settings.System.canWrite(context));
        return ExecutionResult.completed("تمت قراءة حالة الإعدادات المسموح بها", details);
    }

    private ExecutionResult open(String instruction) throws Exception {
        String action = Settings.ACTION_SETTINGS;
        if (contains(instruction, "واي فاي", "wifi", "wi-fi", "شبكة")) action = Settings.ACTION_WIFI_SETTINGS;
        else if (contains(instruction, "بلوتوث", "bluetooth")) action = Settings.ACTION_BLUETOOTH_SETTINGS;
        else if (contains(instruction, "شاشة", "سطوع", "display", "brightness")) action = Settings.ACTION_DISPLAY_SETTINGS;
        else if (contains(instruction, "صوت", "sound", "ring")) action = Settings.ACTION_SOUND_SETTINGS;
        else if (contains(instruction, "موقع", "location", "gps")) action = Settings.ACTION_LOCATION_SOURCE_SETTINGS;
        else if (contains(instruction, "إشعار", "اشعار", "notification")) action = Settings.ACTION_APP_NOTIFICATION_SETTINGS;
        Intent intent = new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Settings.ACTION_APP_NOTIFICATION_SETTINGS.equals(action)) intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
        context.startActivity(intent);
        return ExecutionResult.completed("تم فتح صفحة الإعداد المطلوبة على الهاتف", new JSONObject().put("settings_action", action));
    }

    private ExecutionResult change(String instruction, JSONObject payload) throws Exception {
        if (!Settings.System.canWrite(context)) {
            Intent permission = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(permission);
            return ExecutionResult.failed("WRITE_SETTINGS_PERMISSION_REQUIRED", "فتح Android صفحة السماح بتعديل الإعدادات؛ فعّل السماح ثم أعد المهمة");
        }
        ContentResolver resolver = context.getContentResolver();
        if (contains(instruction, "سطوع", "brightness") || payload.has("brightness")) {
            int value = payload.optInt("brightness", firstNumber(instruction, -1));
            if (value < 0) return ExecutionResult.failed("SETTING_VALUE_REQUIRED", "حدّد السطوع من 0 إلى 100");
            value = Math.max(0, Math.min(100, value));
            int systemValue = Math.round(value * 255f / 100f);
            Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
            Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS, systemValue);
            return ExecutionResult.completed("تم تغيير سطوع الشاشة إلى " + value + "%", new JSONObject().put("brightness_percent", value));
        }
        if (contains(instruction, "دوران", "تدوير", "rotation", "rotate") || payload.has("auto_rotate")) {
            boolean enabled = payload.has("auto_rotate") ? payload.optBoolean("auto_rotate") : !contains(instruction, "أوقف", "اوقف", "عطّل", "عطل", "off", "disable");
            Settings.System.putInt(resolver, Settings.System.ACCELEROMETER_ROTATION, enabled ? 1 : 0);
            return ExecutionResult.completed(enabled ? "تم تشغيل تدوير الشاشة" : "تم إيقاف تدوير الشاشة", new JSONObject().put("auto_rotate", enabled));
        }
        if (contains(instruction, "مهلة الشاشة", "إطفاء الشاشة", "screen timeout") || payload.has("screen_timeout_seconds")) {
            int seconds = payload.optInt("screen_timeout_seconds", firstNumber(instruction, -1));
            if (seconds < 5) return ExecutionResult.failed("SETTING_VALUE_REQUIRED", "حدّد مهلة الشاشة بالثواني وبحد أدنى 5 ثوانٍ");
            seconds = Math.min(seconds, 1800);
            Settings.System.putInt(resolver, Settings.System.SCREEN_OFF_TIMEOUT, seconds * 1000);
            return ExecutionResult.completed("تم تغيير مهلة إطفاء الشاشة إلى " + seconds + " ثانية", new JSONObject().put("screen_timeout_seconds", seconds));
        }
        return ExecutionResult.failed("ANDROID_SETTING_NOT_CHANGEABLE", "Android يسمح بالتغيير التلقائي للسطوع والدوران ومهلة الشاشة فقط؛ باقي الإعدادات يمكن فتح صفحتها للمالك");
    }

    private static boolean contains(String value, String... needles) { for (String needle : needles) if (value.contains(needle)) return true; return false; }
    private static int firstNumber(String value, int fallback) { Matcher matcher = Pattern.compile("([0-9]{1,4})").matcher(value); return matcher.find() ? Integer.parseInt(matcher.group(1)) : fallback; }
}
