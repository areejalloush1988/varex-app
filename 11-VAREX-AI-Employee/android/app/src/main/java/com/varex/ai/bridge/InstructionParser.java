package com.varex.ai.bridge;

import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class InstructionParser {
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(\\+?[0-9][0-9 ()-]{6,}[0-9])(?!\\d)");
    private static final Pattern CLOCK = Pattern.compile("(?:الساعة\\s*)?([0-9]{1,2})(?::([0-9]{2}))?\\s*(صباح(?:اً|ا)?|مساء(?:ً|ا)?|ص|م|am|pm)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern ISO_DATE_TIME = Pattern.compile("([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})(?:[ T،,]+)([0-9]{1,2})(?::([0-9]{2}))?");

    private InstructionParser() { }

    public static String normalizeDigits(String value) {
        if (value == null) return "";
        StringBuilder result = new StringBuilder(value.length());
        String arabic = "٠١٢٣٤٥٦٧٨٩", persian = "۰۱۲۳۴۵۶۷۸۹";
        for (char character : value.toCharArray()) {
            int index = arabic.indexOf(character);
            if (index < 0) index = persian.indexOf(character);
            result.append(index >= 0 ? (char) ('0' + index) : character);
        }
        return result.toString().trim();
    }

    public static List<String> segments(String instruction) {
        String normalized = normalizeDigits(instruction);
        String[] parts = normalized.split("\\s*[|｜]\\s*");
        List<String> values = new ArrayList<>();
        for (String part : parts) if (!part.trim().isEmpty()) values.add(part.trim());
        return values;
    }

    public static String firstPhone(String value) {
        Matcher matcher = PHONE.matcher(normalizeDigits(value));
        if (!matcher.find()) return "";
        String raw = matcher.group(1).replaceAll("[^+0-9]", "");
        return raw.startsWith("00") ? "+" + raw.substring(2) : raw;
    }

    public static String contactName(JSONObject payload, String target) {
        String explicit = payload.optString("name", "").trim();
        if (!explicit.isEmpty()) return explicit;
        List<String> parts = segments(payload.optString("instruction", target));
        String source = parts.isEmpty() ? target : parts.get(0);
        int colon = Math.max(source.indexOf(':'), source.indexOf('：'));
        if (colon >= 0) source = source.substring(colon + 1);
        source = source.replaceAll("(?i)(أضف|اضف|أنشئ|انشئ|احذف|حذف|عدّل|عدل|ابحث|بحث|عن|في|جهة اتصال|جهات الاتصال|contact|create|add|edit|delete|search)", " ");
        source = source.replace(firstPhone(source), "").replaceAll("\\s+", " ").trim();
        return source;
    }

    public static LocalTime clock(String value) {
        Matcher matcher = CLOCK.matcher(normalizeDigits(value));
        LocalTime last = null;
        while (matcher.find()) {
            int hour = Integer.parseInt(matcher.group(1));
            int minute = matcher.group(2) == null ? 0 : Integer.parseInt(matcher.group(2));
            String period = matcher.group(3) == null ? "" : matcher.group(3).toLowerCase(Locale.ROOT);
            if ((period.startsWith("م") || period.equals("pm")) && hour < 12) hour += 12;
            if ((period.startsWith("ص") || period.equals("am")) && hour == 12) hour = 0;
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) last = LocalTime.of(hour, minute);
        }
        return last;
    }

    public static LocalDateTime dateTime(String value) {
        String normalized = normalizeDigits(value);
        Matcher matcher = ISO_DATE_TIME.matcher(normalized);
        if (matcher.find()) {
            try {
                return LocalDateTime.of(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)), Integer.parseInt(matcher.group(3)), Integer.parseInt(matcher.group(4)), matcher.group(5) == null ? 0 : Integer.parseInt(matcher.group(5)));
            } catch (RuntimeException ignored) { }
        }
        try { return LocalDateTime.parse(normalized, DateTimeFormatter.ISO_DATE_TIME); }
        catch (DateTimeParseException ignored) { }
        LocalTime time = clock(normalized);
        if (time == null) return null;
        LocalDate date = normalized.contains("غداً") || normalized.contains("غدا") ? LocalDate.now().plusDays(1) : LocalDate.now();
        LocalDateTime result = LocalDateTime.of(date, time);
        if (result.isBefore(LocalDateTime.now()) && !normalized.contains("اليوم")) result = result.plusDays(1);
        return result;
    }

    public static long epochMillis(String value) {
        LocalDateTime dateTime = dateTime(value);
        return dateTime == null ? 0L : dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    public static String title(String instruction, String fallback) {
        List<String> values = segments(instruction);
        String source = values.isEmpty() ? instruction : values.get(0);
        int colon = Math.max(source.indexOf(':'), source.indexOf('：'));
        if (colon >= 0) source = source.substring(colon + 1);
        source = source.replaceAll("(?i)(أضف|اضف|أنشئ|انشئ|احجز|اضبط|عدّل|عدل|ألغ|الغ|احذف|حذف|موعد|التقويم|منبّه|منبه|تذكير|calendar|alarm|create|edit|delete|cancel)", " ");
        source = ISO_DATE_TIME.matcher(source).replaceAll(" ");
        source = source.replaceAll("\\s+", " ").trim();
        return source.isEmpty() ? fallback : source;
    }
}
