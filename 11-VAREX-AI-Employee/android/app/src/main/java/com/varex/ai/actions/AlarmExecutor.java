package com.varex.ai.actions;

import android.content.Context;
import android.content.Intent;
import android.provider.AlarmClock;

import com.varex.ai.bridge.ExecutionResult;
import com.varex.ai.bridge.InstructionParser;

import org.json.JSONObject;

import java.time.LocalTime;

public final class AlarmExecutor {
    private final Context context;

    public AlarmExecutor(Context context) { this.context = context; }

    public ExecutionResult execute(String action, String target, JSONObject payload) {
        try {
            String instruction = payload.optString("instruction", target);
            if (action.equals("create") || action.equals("enable") || action.equals("edit")) {
                int hour = payload.optInt("hour", -1), minute = payload.optInt("minute", -1);
                if (hour < 0 || minute < 0) {
                    LocalTime time = InstructionParser.clock(instruction);
                    if (time != null) { hour = time.getHour(); minute = time.getMinute(); }
                }
                if (hour < 0 || minute < 0) return ExecutionResult.failed("ALARM_TIME_REQUIRED", "حدّد وقت المنبّه، مثلاً: اضبط منبّه الساعة 07:30 | الدوام");
                java.util.List<String> segments = InstructionParser.segments(instruction);
                String parsedLabel = segments.size() > 1 ? segments.get(segments.size() - 1) : InstructionParser.title(instruction, "VAREX AI");
                String label = payload.optString("label", parsedLabel).trim();
                Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
                        .putExtra(AlarmClock.EXTRA_HOUR, hour)
                        .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                        .putExtra(AlarmClock.EXTRA_MESSAGE, label)
                        .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return ExecutionResult.completed("تم ضبط منبّه " + String.format("%02d:%02d", hour, minute) + " بعنوان «" + label + "»", new JSONObject().put("hour", hour).put("minute", minute).put("label", label));
            }
            if (action.equals("disable") || action.equals("delete")) {
                java.util.List<String> segments = InstructionParser.segments(instruction);
                String parsedLabel = segments.size() > 1 ? segments.get(segments.size() - 1) : InstructionParser.title(instruction, "VAREX AI");
                String label = payload.optString("label", parsedLabel).trim();
                Intent intent = new Intent(AlarmClock.ACTION_DISMISS_ALARM)
                        .putExtra(AlarmClock.EXTRA_ALARM_SEARCH_MODE, AlarmClock.ALARM_SEARCH_MODE_LABEL)
                        .putExtra(AlarmClock.EXTRA_MESSAGE, label)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return ExecutionResult.completed("تم إرسال طلب إيقاف المنبّه «" + label + "» إلى تطبيق الساعة", new JSONObject().put("label", label));
            }
            Intent show = new Intent(AlarmClock.ACTION_SHOW_ALARMS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(show);
            return ExecutionResult.completed("تم فتح قائمة المنبّهات", new JSONObject());
        } catch (android.content.ActivityNotFoundException exception) {
            return ExecutionResult.failed("CLOCK_APP_NOT_FOUND", "لم يتم العثور على تطبيق ساعة يدعم أوامر المنبّه");
        } catch (Exception exception) {
            return ExecutionResult.failed("ALARM_EXECUTION_FAILED", "تعذر تنفيذ أمر المنبّه: " + (exception.getMessage() == null ? "خطأ من نظام الهاتف" : exception.getMessage()));
        }
    }
}
