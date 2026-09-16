package com.varex.ai.bridge;

import android.content.Context;

import com.varex.ai.actions.AlarmExecutor;
import com.varex.ai.actions.CalendarExecutor;
import com.varex.ai.actions.ContactsExecutor;
import com.varex.ai.actions.PhoneExecutor;
import com.varex.ai.actions.SettingsExecutor;
import com.varex.ai.storage.SessionStore;

import org.json.JSONObject;

public final class CommandExecutor {
    private final Context context;
    private final SessionStore store;

    public CommandExecutor(Context context, SessionStore store) {
        this.context = context.getApplicationContext();
        this.store = store;
    }

    public ExecutionResult execute(JSONObject command) {
        String app = command.optString("app_key", ""), action = command.optString("action_key", ""), target = command.optString("target", "");
        JSONObject payload = command.optJSONObject("request_payload");
        if (payload == null) payload = new JSONObject();
        switch (app) {
            case "contacts": return new ContactsExecutor(context).execute(action, target, payload);
            case "calendar": return new CalendarExecutor(context).execute(action, target, payload);
            case "alarms": return new AlarmExecutor(context).execute(action, target, payload);
            case "phone": return new PhoneExecutor(context, store).execute(action, target, payload);
            case "settings": return new SettingsExecutor(context).execute(action, target, payload);
            default: return ExecutionResult.failed("UNSUPPORTED_NATIVE_APP", "تطبيق الهاتف لا يدعم منفّذ " + app);
        }
    }
}
