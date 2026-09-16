package com.varex.ai.actions;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.varex.ai.bridge.ExecutionResult;
import com.varex.ai.bridge.InstructionParser;
import com.varex.ai.storage.SessionStore;

import org.json.JSONObject;

public final class PhoneExecutor {
    private final Context context;
    private final SessionStore store;
    private final ContactsExecutor contacts;

    public PhoneExecutor(Context context, SessionStore store) {
        this.context = context;
        this.store = store;
        this.contacts = new ContactsExecutor(context);
    }

    public ExecutionResult execute(String action, String target, JSONObject payload) {
        if (context.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return ExecutionResult.failed("ANDROID_PERMISSION_REQUIRED", "امنح VAREX AI صلاحية جهات الاتصال للبحث عن الرقم");
        try {
            String lookup = payload.optString("phone", target).trim();
            if (action.equals("redial") && lookup.isEmpty()) lookup = store.lastPhone();
            String phone = InstructionParser.firstPhone(lookup);
            if (phone.isEmpty()) phone = contacts.findPhone(lookup);
            if (phone.isEmpty()) return ExecutionResult.failed("CONTACT_NUMBER_REQUIRED", "لم يتم العثور على رقم " + (lookup.isEmpty() ? "المستلم" : lookup));
            if (action.equals("lookup")) return ExecutionResult.completed("تم العثور على الرقم المطلوب", new JSONObject().put("target", lookup).put("phone", phone));
            if (action.equals("transfer")) return ExecutionResult.failed("CALL_TRANSFER_NOT_SUPPORTED", "تحويل المكالمات العادية غير مسموح لتطبيقات Android؛ يحتاج مزود اتصال صوتي");
            if (!action.equals("start_call") && !action.equals("redial")) return ExecutionResult.failed("UNSUPPORTED_PHONE_ACTION", "عملية الهاتف غير مدعومة");
            if (context.checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) return ExecutionResult.failed("ANDROID_PERMISSION_REQUIRED", "امنح VAREX AI صلاحية إجراء المكالمات أولاً");
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.fromParts("tel", phone, null)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            store.setLastPhone(phone);
            return ExecutionResult.completed("بدأ الاتصال بـ " + (target.isEmpty() ? phone : target), new JSONObject().put("phone", phone).put("target", target));
        } catch (android.content.ActivityNotFoundException exception) {
            return ExecutionResult.failed("PHONE_APP_NOT_FOUND", "لم يتم العثور على تطبيق هاتف يدعم الاتصال");
        } catch (SecurityException exception) {
            return ExecutionResult.failed("ANDROID_CALL_BLOCKED", "منع Android بدء الاتصال؛ افتح التطبيق واسمح بالمكالمات");
        } catch (Exception exception) {
            return ExecutionResult.failed("PHONE_EXECUTION_FAILED", "تعذر بدء الاتصال: " + (exception.getMessage() == null ? "خطأ من نظام الهاتف" : exception.getMessage()));
        }
    }
}
