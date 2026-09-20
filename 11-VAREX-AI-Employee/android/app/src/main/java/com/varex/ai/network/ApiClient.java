package com.varex.ai.network;

import com.varex.ai.BuildConfig;
import com.varex.ai.storage.SessionStore;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class ApiClient {
    private static final Object REFRESH_LOCK = new Object();
    private final SessionStore store;

    public ApiClient(SessionStore store) { this.store = store; }

    public JSONObject login(String email, String password) throws Exception {
        JSONObject body = new JSONObject().put("email", email.trim()).put("password", password);
        Object result = request("POST", "/auth/login", body, false, false);
        if (!(result instanceof JSONObject)) throw new ApiException(500, "INVALID_RESPONSE", "استجابة تسجيل الدخول غير صالحة");
        return (JSONObject) result;
    }

    public JSONObject getObject(String path) throws Exception {
        Object result = request("GET", path, null, true, true);
        if (!(result instanceof JSONObject)) throw new ApiException(500, "INVALID_RESPONSE", "استجابة الخادم غير صالحة");
        return (JSONObject) result;
    }

    public JSONArray getArray(String path) throws Exception {
        Object result = request("GET", path, null, true, true);
        if (!(result instanceof JSONArray)) throw new ApiException(500, "INVALID_RESPONSE", "استجابة الخادم غير صالحة");
        return (JSONArray) result;
    }

    public JSONObject post(String path, JSONObject body) throws Exception {
        Object result = request("POST", path, body, true, true);
        if (!(result instanceof JSONObject)) throw new ApiException(500, "INVALID_RESPONSE", "استجابة الخادم غير صالحة");
        return (JSONObject) result;
    }

    public byte[] postBytes(String path, JSONObject body) throws Exception {
        return requestBytes(path, body, true);
    }

    public void logout() {
        try { request("POST", "/auth/logout", new JSONObject(), true, false); } catch (Exception ignored) { }
    }

    private Object request(String method, String path, JSONObject body, boolean authenticated, boolean retry) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.API_BASE_URL + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Accept-Language", "ar");
        connection.setRequestProperty("User-Agent", "VAREX-AI-Android/" + BuildConfig.VERSION_NAME);
        if (authenticated) {
            String token = store.accessToken();
            if (token.isEmpty()) throw new ApiException(401, "SESSION_REQUIRED", "انتهت الجلسة؛ سجّل الدخول مجدداً");
            connection.setRequestProperty("Authorization", "Bearer " + token);
        }
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = connection.getResponseCode();
        String responseText = read(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
        connection.disconnect();
        if (status == 401 && authenticated && retry && refreshSession()) return request(method, path, body, true, false);
        Object payload;
        try { payload = responseText.isEmpty() ? new JSONObject() : new JSONTokener(responseText).nextValue(); }
        catch (JSONException ignored) { payload = new JSONObject(); }
        if (status < 200 || status >= 300) {
            JSONObject problem = payload instanceof JSONObject ? (JSONObject) payload : new JSONObject();
            throw new ApiException(status, problem.optString("code", "REQUEST_FAILED"), problem.optString("message", "تعذر الاتصال بخادم VAREX AI"));
        }
        return payload;
    }

    private boolean refreshSession() {
        synchronized (REFRESH_LOCK) {
            String refreshToken = store.refreshToken();
            if (refreshToken.isEmpty()) return false;
            try {
                JSONObject body = new JSONObject().put("refresh_token", refreshToken);
                Object refreshed = request("POST", "/auth/refresh", body, false, false);
                if (!(refreshed instanceof JSONObject)) return false;
                store.saveSession((JSONObject) refreshed);
                return true;
            } catch (Exception ignored) {
                store.clearSession();
                return false;
            }
        }
    }

    private byte[] requestBytes(String path, JSONObject body, boolean retry) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.API_BASE_URL + path).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "audio/wav, application/json");
        connection.setRequestProperty("Accept-Language", "ar");
        connection.setRequestProperty("Authorization", "Bearer " + store.accessToken());
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("User-Agent", "VAREX-AI-Android/" + BuildConfig.VERSION_NAME);
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        byte[] payload = readBytes(stream);
        connection.disconnect();
        if (status == 401 && retry && refreshSession()) return requestBytes(path, body, false);
        if (status < 200 || status >= 300) {
            JSONObject problem;
            try { problem = new JSONObject(new String(payload, StandardCharsets.UTF_8)); }
            catch (Exception ignored) { problem = new JSONObject(); }
            throw new ApiException(status, problem.optString("code", "REQUEST_FAILED"), problem.optString("message", "تعذر تشغيل صوت الموظف"));
        }
        return payload;
    }

    private static byte[] readBytes(InputStream stream) throws Exception {
        if (stream == null) return new byte[0];
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }
}
