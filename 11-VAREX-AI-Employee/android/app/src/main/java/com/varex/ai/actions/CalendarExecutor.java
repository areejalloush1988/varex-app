package com.varex.ai.actions;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CalendarContract;

import com.varex.ai.bridge.ExecutionResult;
import com.varex.ai.bridge.InstructionParser;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.TimeZone;

public final class CalendarExecutor {
    private final Context context;

    public CalendarExecutor(Context context) { this.context = context; }

    public ExecutionResult execute(String action, String target, JSONObject payload) {
        boolean write = action.equals("create") || action.equals("edit") || action.equals("cancel") || action.equals("delete");
        if (!has(Manifest.permission.READ_CALENDAR) || (write && !has(Manifest.permission.WRITE_CALENDAR))) return ExecutionResult.failed("ANDROID_PERMISSION_REQUIRED", "امنح VAREX AI صلاحية التقويم من الهاتف أولاً");
        try {
            switch (action) {
                case "view": return view(target, payload);
                case "create": return create(target, payload);
                case "edit": return edit(target, payload);
                case "cancel": return cancelOrDelete(target, payload, false);
                case "delete": return cancelOrDelete(target, payload, true);
                default: return ExecutionResult.failed("UNSUPPORTED_CALENDAR_ACTION", "عملية التقويم غير مدعومة في نسخة Android الحالية");
            }
        } catch (Exception exception) {
            return ExecutionResult.failed("CALENDAR_EXECUTION_FAILED", "تعذر تنفيذ أمر التقويم: " + safeMessage(exception));
        }
    }

    private ExecutionResult view(String target, JSONObject payload) throws Exception {
        long from = payload.optLong("from", System.currentTimeMillis() - 86400000L);
        long to = payload.optLong("to", System.currentTimeMillis() + 30L * 86400000L);
        String query = payload.optString("query", "").trim();
        String selection = CalendarContract.Events.DTSTART + ">=? AND " + CalendarContract.Events.DTSTART + "<=?";
        java.util.ArrayList<String> args = new java.util.ArrayList<>();
        args.add(String.valueOf(from)); args.add(String.valueOf(to));
        if (!query.isEmpty()) { selection += " AND " + CalendarContract.Events.TITLE + " LIKE ?"; args.add("%" + query + "%"); }
        JSONArray events = new JSONArray();
        try (Cursor cursor = context.getContentResolver().query(CalendarContract.Events.CONTENT_URI,
                new String[]{CalendarContract.Events._ID, CalendarContract.Events.TITLE, CalendarContract.Events.DTSTART, CalendarContract.Events.DTEND, CalendarContract.Events.EVENT_LOCATION},
                selection, args.toArray(new String[0]), CalendarContract.Events.DTSTART + " ASC")) {
            if (cursor != null) while (cursor.moveToNext() && events.length() < 20) {
                events.put(new JSONObject().put("event_id", cursor.getLong(0)).put("title", cursor.getString(1)).put("starts_at", iso(cursor.getLong(2))).put("ends_at", iso(cursor.getLong(3))).put("location", cursor.getString(4)));
            }
        }
        return ExecutionResult.completed("تم عرض " + events.length() + " موعداً من التقويم", new JSONObject().put("count", events.length()).put("events", events));
    }

    private ExecutionResult create(String target, JSONObject payload) throws Exception {
        String instruction = payload.optString("instruction", target);
        String title = payload.optString("title", InstructionParser.title(instruction, "موعد VAREX AI")).trim();
        long start = payload.optLong("start_at", 0L);
        if (start == 0L) start = InstructionParser.epochMillis(payload.optString("starts_at", instruction));
        if (start == 0L) return ExecutionResult.failed("CALENDAR_TIME_REQUIRED", "لإنشاء موعد استخدم: أضف موعد: العنوان | 2026-09-17 14:00");
        int durationMinutes = Math.max(5, Math.min(1440, payload.optInt("duration_minutes", 60)));
        long end = payload.optLong("end_at", start + durationMinutes * 60000L);
        long calendarId = writableCalendarId();
        if (calendarId < 0) return ExecutionResult.failed("WRITABLE_CALENDAR_REQUIRED", "لا يوجد تقويم قابل للكتابة على هذا الهاتف");
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
        values.put(CalendarContract.Events.TITLE, title);
        values.put(CalendarContract.Events.DESCRIPTION, payload.optString("description", "أضيف بواسطة VAREX AI"));
        values.put(CalendarContract.Events.EVENT_LOCATION, payload.optString("location", ""));
        values.put(CalendarContract.Events.DTSTART, start);
        values.put(CalendarContract.Events.DTEND, end);
        values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        android.net.Uri inserted = context.getContentResolver().insert(CalendarContract.Events.CONTENT_URI, values);
        if (inserted == null) return ExecutionResult.failed("CALENDAR_CREATE_FAILED", "رفض تطبيق التقويم إنشاء الموعد");
        long eventId = ContentUris.parseId(inserted);
        return ExecutionResult.completed("تم إنشاء موعد «" + title + "»", new JSONObject().put("event_id", eventId).put("title", title).put("starts_at", iso(start)).put("ends_at", iso(end)));
    }

    private ExecutionResult edit(String target, JSONObject payload) throws Exception {
        long eventId = eventId(target, payload);
        if (eventId < 0) return ExecutionResult.failed("CALENDAR_EVENT_NOT_FOUND", "لم يتم العثور على الموعد المطلوب تعديله");
        ContentValues values = new ContentValues();
        String instruction = payload.optString("instruction", target);
        if (payload.has("title")) values.put(CalendarContract.Events.TITLE, payload.optString("title"));
        long start = payload.optLong("start_at", InstructionParser.epochMillis(payload.optString("starts_at", instruction)));
        if (start > 0) {
            values.put(CalendarContract.Events.DTSTART, start);
            values.put(CalendarContract.Events.DTEND, payload.optLong("end_at", start + Math.max(5, payload.optInt("duration_minutes", 60)) * 60000L));
        }
        if (payload.has("location")) values.put(CalendarContract.Events.EVENT_LOCATION, payload.optString("location"));
        if (values.size() == 0) return ExecutionResult.failed("CALENDAR_UPDATE_REQUIRED", "حدّد الوقت أو العنوان الجديد للموعد");
        int changed = context.getContentResolver().update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), values, null, null);
        if (changed < 1) return ExecutionResult.failed("CALENDAR_EDIT_FAILED", "تعذر تعديل الموعد على الهاتف");
        return ExecutionResult.completed("تم تعديل الموعد", new JSONObject().put("event_id", eventId));
    }

    private ExecutionResult cancelOrDelete(String target, JSONObject payload, boolean delete) throws Exception {
        long eventId = eventId(target, payload);
        if (eventId < 0) return ExecutionResult.failed("CALENDAR_EVENT_NOT_FOUND", "لم يتم العثور على الموعد المطلوب");
        int changed;
        if (delete) changed = context.getContentResolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), null, null);
        else {
            ContentValues values = new ContentValues();
            values.put(CalendarContract.Events.STATUS, CalendarContract.Events.STATUS_CANCELED);
            changed = context.getContentResolver().update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), values, null, null);
        }
        if (changed < 1) return ExecutionResult.failed("CALENDAR_CHANGE_FAILED", "تعذر " + (delete ? "حذف" : "إلغاء") + " الموعد");
        return ExecutionResult.completed("تم " + (delete ? "حذف" : "إلغاء") + " الموعد", new JSONObject().put("event_id", eventId));
    }

    private long eventId(String target, JSONObject payload) {
        long explicit = payload.optLong("event_id", -1L);
        if (explicit >= 0) return explicit;
        String query = payload.optString("query", InstructionParser.title(payload.optString("instruction", target), "")).trim();
        if (query.isEmpty()) return -1;
        try (Cursor cursor = context.getContentResolver().query(CalendarContract.Events.CONTENT_URI, new String[]{CalendarContract.Events._ID}, CalendarContract.Events.TITLE + " LIKE ? AND " + CalendarContract.Events.DTSTART + ">?", new String[]{"%" + query + "%", String.valueOf(System.currentTimeMillis() - 30L * 86400000L)}, CalendarContract.Events.DTSTART + " ASC")) {
            return cursor != null && cursor.moveToFirst() ? cursor.getLong(0) : -1;
        }
    }

    private long writableCalendarId() {
        String selection = CalendarContract.Calendars.VISIBLE + "=1 AND " + CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=?";
        try (Cursor cursor = context.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, new String[]{CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY}, selection, new String[]{String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)}, CalendarContract.Calendars.IS_PRIMARY + " DESC")) {
            return cursor != null && cursor.moveToFirst() ? cursor.getLong(0) : -1;
        }
    }

    private static String iso(long millis) { return millis <= 0 ? "" : LocalDateTime.ofInstant(Instant.ofEpochMilli(millis), ZoneId.systemDefault()).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME); }
    private boolean has(String permission) { return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private static String safeMessage(Exception exception) { return exception.getMessage() == null ? "خطأ من نظام الهاتف" : exception.getMessage(); }
}
