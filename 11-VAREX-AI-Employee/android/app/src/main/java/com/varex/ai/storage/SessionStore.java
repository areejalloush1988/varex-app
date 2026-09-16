package com.varex.ai.storage;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SessionStore {
    private static final String PREFS = "varex_ai_secure";
    private static final String KEY_ALIAS = "varex_ai_session_key_v1";
    private static final String SESSION_DATA = "session_data";
    private static final String SESSION_IV = "session_iv";
    private static final String PENDING_RESULT_DATA = "pending_result_data";
    private static final String PENDING_RESULT_IV = "pending_result_iv";
    private final Context context;
    private final SharedPreferences preferences;

    public SessionStore(Context context) {
        this.context = context.getApplicationContext();
        this.preferences = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void saveSession(JSONObject session) throws Exception {
        saveEncrypted(SESSION_DATA, SESSION_IV, session);
    }

    private void saveEncrypted(String dataKey, String ivKey, JSONObject value) throws Exception {
        byte[] iv;
        byte[] encrypted;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey());
        iv = cipher.getIV();
        encrypted = cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
        preferences.edit()
                .putString(dataKey, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(ivKey, Base64.encodeToString(iv, Base64.NO_WRAP))
                .apply();
    }

    public synchronized JSONObject session() {
        JSONObject value = readEncrypted(SESSION_DATA, SESSION_IV);
        if (value == null && (!preferences.getString(SESSION_DATA, "").isEmpty() || !preferences.getString(SESSION_IV, "").isEmpty())) clearSession();
        return value;
    }

    private JSONObject readEncrypted(String dataKey, String ivKey) {
        String data = preferences.getString(dataKey, "");
        String iv = preferences.getString(ivKey, "");
        if (data.isEmpty() || iv.isEmpty()) return null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            byte[] decoded = cipher.doFinal(Base64.decode(data, Base64.NO_WRAP));
            return new JSONObject(new String(decoded, StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            return null;
        }
    }

    private SecretKey secretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    public String accessToken() {
        JSONObject session = session();
        return session == null ? "" : session.optString("access_token", "");
    }

    public String refreshToken() {
        JSONObject session = session();
        return session == null ? "" : session.optString("refresh_token", "");
    }

    public String email() {
        JSONObject session = session();
        return session == null ? "" : session.optJSONObject("user") == null ? "" : session.optJSONObject("user").optString("email", "");
    }

    public boolean hasSession() {
        return !accessToken().isEmpty() && !refreshToken().isEmpty();
    }

    public void clearSession() {
        preferences.edit().remove(SESSION_DATA).remove(SESSION_IV).remove(PENDING_RESULT_DATA).remove(PENDING_RESULT_IV).remove("organization_id").remove("organization_name").remove("selected_agent_id").remove("selected_agent_name").putBoolean("connected", false).apply();
    }

    public synchronized void setPendingResult(JSONObject value) throws Exception { saveEncrypted(PENDING_RESULT_DATA, PENDING_RESULT_IV, value); }
    public synchronized JSONObject pendingResult() { return readEncrypted(PENDING_RESULT_DATA, PENDING_RESULT_IV); }
    public void clearPendingResult() { preferences.edit().remove(PENDING_RESULT_DATA).remove(PENDING_RESULT_IV).apply(); }

    public void setOrganization(String id, String name) {
        preferences.edit().putString("organization_id", id).putString("organization_name", name).apply();
    }

    public String organizationId() { return preferences.getString("organization_id", ""); }
    public String organizationName() { return preferences.getString("organization_name", ""); }
    public void setSelectedAgent(String id, String name) { preferences.edit().putString("selected_agent_id", id).putString("selected_agent_name", name).apply(); }
    public String selectedAgentId() { return preferences.getString("selected_agent_id", ""); }
    public String selectedAgentName() { return preferences.getString("selected_agent_name", ""); }
    public void setVoiceRepliesEnabled(boolean enabled) { preferences.edit().putBoolean("voice_replies_enabled", enabled).apply(); }
    public boolean voiceRepliesEnabled() { return preferences.getBoolean("voice_replies_enabled", true); }
    public void setConnected(boolean connected) { preferences.edit().putBoolean("connected", connected).apply(); }
    public boolean isConnected() { return preferences.getBoolean("connected", false); }
    public void setLastAction(String value) { preferences.edit().putString("last_action", value).apply(); }
    public String lastAction() { return preferences.getString("last_action", "لا توجد عمليات منفذة بعد."); }
    public void setLastPhone(String value) { preferences.edit().putString("last_phone", value).apply(); }
    public String lastPhone() { return preferences.getString("last_phone", ""); }

    public String deviceId() {
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.trim().isEmpty()) androidId = "unknown-device";
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(androidId.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder("android-");
            for (int index = 0; index < 12; index++) builder.append(String.format("%02x", digest[index]));
            return builder.toString();
        } catch (Exception ignored) {
            return "android-" + androidId.replaceAll("[^A-Za-z0-9._:-]", "-");
        }
    }
}
