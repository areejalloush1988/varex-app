package com.varex.ai.actions;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import com.varex.ai.bridge.ExecutionResult;
import com.varex.ai.bridge.InstructionParser;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

public final class ContactsExecutor {
    private final Context context;

    public ContactsExecutor(Context context) { this.context = context; }

    public ExecutionResult execute(String action, String target, JSONObject payload) {
        boolean write = action.equals("create") || action.equals("edit") || action.equals("delete");
        if (!has(Manifest.permission.READ_CONTACTS) || (write && !has(Manifest.permission.WRITE_CONTACTS))) {
            return ExecutionResult.failed("ANDROID_PERMISSION_REQUIRED", "امنح VAREX AI صلاحية جهات الاتصال من الهاتف أولاً");
        }
        try {
            switch (action) {
                case "view": return list("");
                case "search": return list(query(payload, target));
                case "create": return create(target, payload);
                case "edit": return edit(target, payload);
                case "delete": return delete(target, payload);
                default: return ExecutionResult.failed("UNSUPPORTED_CONTACT_ACTION", "عملية جهات الاتصال غير مدعومة في نسخة Android الحالية");
            }
        } catch (Exception exception) {
            return ExecutionResult.failed("CONTACTS_EXECUTION_FAILED", "تعذر تنفيذ أمر جهات الاتصال: " + safeMessage(exception));
        }
    }

    private ExecutionResult list(String query) throws Exception {
        JSONArray results = new JSONArray();
        Set<Long> seen = new HashSet<>();
        String selection = query.isEmpty() ? null : ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " LIKE ? OR " + ContactsContract.CommonDataKinds.Phone.NUMBER + " LIKE ?";
        String[] arguments = query.isEmpty() ? null : new String[]{"%" + query + "%", "%" + query + "%"};
        try (Cursor cursor = context.getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY, ContactsContract.CommonDataKinds.Phone.NUMBER},
                selection, arguments, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " ASC")) {
            if (cursor != null) while (cursor.moveToNext() && results.length() < 20) {
                long id = cursor.getLong(0);
                if (!seen.add(id)) continue;
                results.put(new JSONObject().put("contact_id", id).put("name", cursor.getString(1)).put("phone", cursor.getString(2)));
            }
        }
        JSONObject details = new JSONObject().put("count", results.length()).put("contacts", results);
        String summary = query.isEmpty() ? "تم عرض " + results.length() + " جهة اتصال" : results.length() == 0 ? "لم يتم العثور على جهة اتصال مطابقة لـ " + query : "تم العثور على " + results.length() + " نتيجة لـ " + query;
        return ExecutionResult.completed(summary, details);
    }

    private ExecutionResult create(String target, JSONObject payload) throws Exception {
        String instruction = payload.optString("instruction", target);
        String name = InstructionParser.contactName(payload, target);
        String phone = payload.optString("phone", InstructionParser.firstPhone(instruction)).trim();
        String email = payload.optString("email", "").trim();
        if (name.isEmpty() || phone.isEmpty()) return ExecutionResult.failed("CONTACT_DETAILS_REQUIRED", "لإضافة جهة اتصال استخدم: أضف جهة اتصال: الاسم | الرقم مع رمز الدولة");
        ArrayList<ContentProviderOperation> operations = new ArrayList<>();
        operations.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI).withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null).withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null).build());
        operations.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI).withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0).withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE).withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name).build());
        operations.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI).withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0).withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE).withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone).withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE).build());
        if (!email.isEmpty()) operations.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI).withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0).withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE).withValue(ContactsContract.CommonDataKinds.Email.ADDRESS, email).withValue(ContactsContract.CommonDataKinds.Email.TYPE, ContactsContract.CommonDataKinds.Email.TYPE_WORK).build());
        context.getContentResolver().applyBatch(ContactsContract.AUTHORITY, operations);
        return ExecutionResult.completed("تمت إضافة " + name + " إلى جهات الاتصال", new JSONObject().put("name", name).put("phone", phone));
    }

    private ExecutionResult edit(String target, JSONObject payload) throws Exception {
        String instruction = payload.optString("instruction", target);
        String lookup = payload.optString("lookup", payload.optString("old_name", "")).trim();
        if (lookup.isEmpty()) {
            java.util.List<String> parts = InstructionParser.segments(instruction);
            lookup = parts.isEmpty() ? InstructionParser.contactName(payload, target) : InstructionParser.contactName(new JSONObject(), parts.get(0));
        }
        long contactId = findContactId(lookup);
        if (contactId < 0) return ExecutionResult.failed("CONTACT_NOT_FOUND", "لم يتم العثور على جهة الاتصال " + lookup);
        String newName = payload.optString("new_name", "").trim();
        String newPhone = payload.optString("phone", "").trim();
        java.util.List<String> parts = InstructionParser.segments(instruction);
        if (newPhone.isEmpty() && parts.size() > 1) newPhone = InstructionParser.firstPhone(parts.get(parts.size() - 1));
        if (newName.isEmpty() && parts.size() > 1 && newPhone.isEmpty()) newName = parts.get(parts.size() - 1).trim();
        if (newName.isEmpty() && newPhone.isEmpty()) return ExecutionResult.failed("CONTACT_UPDATE_REQUIRED", "حدّد الاسم أو الرقم الجديد بعد علامة |");
        ContentResolver resolver = context.getContentResolver();
        if (!newName.isEmpty()) {
            ContentValues values = new ContentValues();
            values.put(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, newName);
            resolver.update(ContactsContract.Data.CONTENT_URI, values, ContactsContract.Data.CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + "=?", new String[]{String.valueOf(contactId), ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE});
        }
        if (!newPhone.isEmpty()) {
            ContentValues values = new ContentValues();
            values.put(ContactsContract.CommonDataKinds.Phone.NUMBER, newPhone);
            int changed = resolver.update(ContactsContract.Data.CONTENT_URI, values, ContactsContract.Data.CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + "=?", new String[]{String.valueOf(contactId), ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE});
            if (changed == 0) insertPhone(contactId, newPhone);
        }
        return ExecutionResult.completed("تم تعديل جهة الاتصال " + lookup, new JSONObject().put("contact_id", contactId).put("name", newName).put("phone", newPhone));
    }

    private ExecutionResult delete(String target, JSONObject payload) throws Exception {
        String lookup = payload.optString("lookup", InstructionParser.contactName(payload, target)).trim();
        long contactId = findContactId(lookup);
        if (contactId < 0) return ExecutionResult.failed("CONTACT_NOT_FOUND", "لم يتم العثور على جهة الاتصال " + lookup);
        String lookupKey = "";
        try (Cursor cursor = context.getContentResolver().query(ContentUris.withAppendedId(ContactsContract.Contacts.CONTENT_URI, contactId), new String[]{ContactsContract.Contacts.LOOKUP_KEY}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) lookupKey = cursor.getString(0);
        }
        Uri uri = ContactsContract.Contacts.getLookupUri(contactId, lookupKey);
        int deleted = context.getContentResolver().delete(uri, null, null);
        if (deleted < 1) return ExecutionResult.failed("CONTACT_DELETE_FAILED", "تعذر حذف جهة الاتصال " + lookup);
        return ExecutionResult.completed("تم حذف جهة الاتصال " + lookup, new JSONObject().put("contact_id", contactId));
    }

    private void insertPhone(long contactId, String phone) throws Exception {
        long rawContactId = -1;
        try (Cursor cursor = context.getContentResolver().query(ContactsContract.RawContacts.CONTENT_URI, new String[]{ContactsContract.RawContacts._ID}, ContactsContract.RawContacts.CONTACT_ID + "=?", new String[]{String.valueOf(contactId)}, null)) {
            if (cursor != null && cursor.moveToFirst()) rawContactId = cursor.getLong(0);
        }
        if (rawContactId < 0) throw new IllegalStateException("لم يتم العثور على سجل جهة الاتصال");
        ContentValues values = new ContentValues();
        values.put(ContactsContract.Data.RAW_CONTACT_ID, rawContactId);
        values.put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE);
        values.put(ContactsContract.CommonDataKinds.Phone.NUMBER, phone);
        values.put(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE);
        context.getContentResolver().insert(ContactsContract.Data.CONTENT_URI, values);
    }

    public String findPhone(String lookup) {
        if (!has(Manifest.permission.READ_CONTACTS)) return "";
        String direct = InstructionParser.firstPhone(lookup);
        if (!direct.isEmpty()) return direct;
        try (Cursor cursor = context.getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER}, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " LIKE ?", new String[]{"%" + lookup.trim() + "%"}, ContactsContract.CommonDataKinds.Phone.IS_PRIMARY + " DESC")) {
            return cursor != null && cursor.moveToFirst() ? cursor.getString(0).replaceAll("[^+0-9]", "") : "";
        }
    }

    private long findContactId(String lookup) {
        String direct = InstructionParser.firstPhone(lookup);
        String selection = direct.isEmpty() ? ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " LIKE ?" : ContactsContract.CommonDataKinds.Phone.NUMBER + " LIKE ?";
        String argument = direct.isEmpty() ? "%" + lookup.trim() + "%" : "%" + direct.replace("+", "") + "%";
        try (Cursor cursor = context.getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, new String[]{ContactsContract.CommonDataKinds.Phone.CONTACT_ID}, selection, new String[]{argument}, ContactsContract.CommonDataKinds.Phone.IS_PRIMARY + " DESC")) {
            return cursor != null && cursor.moveToFirst() ? cursor.getLong(0) : -1;
        }
    }

    private String query(JSONObject payload, String target) {
        String query = payload.optString("query", "").trim();
        if (!query.isEmpty()) return query;
        query = InstructionParser.contactName(payload, target);
        return query.isEmpty() ? InstructionParser.firstPhone(payload.optString("instruction", target)) : query;
    }

    private boolean has(String permission) { return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private static String safeMessage(Exception exception) { return exception.getMessage() == null ? "خطأ من نظام الهاتف" : exception.getMessage(); }
}
