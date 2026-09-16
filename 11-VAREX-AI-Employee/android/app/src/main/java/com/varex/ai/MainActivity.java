package com.varex.ai;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.varex.ai.bridge.BridgeService;
import com.varex.ai.network.ApiClient;
import com.varex.ai.storage.SessionStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int CONTACTS_REQUEST = 1001;
    private static final int CALENDAR_REQUEST = 1002;
    private static final int PHONE_REQUEST = 1003;
    private static final int NOTIFICATION_REQUEST = 1004;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<Organization> organizations = new ArrayList<>();
    private SessionStore store;
    private ApiClient api;
    private LinearLayout loginPanel;
    private LinearLayout appPanel;
    private EditText emailInput;
    private EditText passwordInput;
    private TextView loginError;
    private ProgressBar loginProgress;
    private Button loginButton;
    private Spinner orgSpinner;
    private TextView connectionState;
    private TextView deviceText;
    private TextView lastActionText;
    private BroadcastReceiver bridgeReceiver;
    private boolean selectingOrganizations;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(getColor(R.color.navy_dark));
        setContentView(R.layout.activity_main);
        store = new SessionStore(this);
        api = new ApiClient(store);
        bindViews();
        bindActions();
        if (store.hasSession()) showApplication(); else showLogin();
    }

    private void bindViews() {
        loginPanel = findViewById(R.id.loginPanel);
        appPanel = findViewById(R.id.appPanel);
        emailInput = findViewById(R.id.emailInput);
        passwordInput = findViewById(R.id.passwordInput);
        loginError = findViewById(R.id.loginError);
        loginProgress = findViewById(R.id.loginProgress);
        loginButton = findViewById(R.id.loginButton);
        orgSpinner = findViewById(R.id.orgSpinner);
        connectionState = findViewById(R.id.connectionState);
        deviceText = findViewById(R.id.deviceText);
        lastActionText = findViewById(R.id.lastActionText);
    }

    private void bindActions() {
        loginButton.setOnClickListener(view -> login());
        findViewById(R.id.contactsPermissionButton).setOnClickListener(view -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS}, CONTACTS_REQUEST));
        findViewById(R.id.calendarPermissionButton).setOnClickListener(view -> requestPermissions(new String[]{Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR}, CALENDAR_REQUEST));
        findViewById(R.id.phonePermissionButton).setOnClickListener(view -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE}, PHONE_REQUEST));
        findViewById(R.id.alarmsPermissionButton).setOnClickListener(view -> openAlarms());
        findViewById(R.id.settingsPermissionButton).setOnClickListener(view -> startActivity(new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + getPackageName()))));
        findViewById(R.id.notificationsPermissionButton).setOnClickListener(view -> requestNotificationPermission());
        findViewById(R.id.connectButton).setOnClickListener(view -> connectDevice(true));
        findViewById(R.id.disconnectButton).setOnClickListener(view -> disconnectDevice(false));
        findViewById(R.id.openDashboardButton).setOnClickListener(view -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.DASHBOARD_URL))));
        findViewById(R.id.logoutButton).setOnClickListener(view -> disconnectDevice(true));
        orgSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (selectingOrganizations || position < 0 || position >= organizations.size()) return;
                Organization selected = organizations.get(position);
                if (store.isConnected() && !selected.id.equals(store.organizationId())) {
                    stopBridge();
                    store.setConnected(false);
                }
                store.setOrganization(selected.id, selected.name);
                updateConnectionState();
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
    }

    private void login() {
        String email = emailInput.getText().toString().trim(), password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) { showLoginError("اكتب البريد الإلكتروني وكلمة المرور"); return; }
        hideKeyboard();
        setLoginBusy(true);
        executor.execute(() -> {
            try {
                JSONObject session = api.login(email, password);
                store.saveSession(session);
                runOnUiThread(this::showApplication);
            } catch (Exception exception) {
                runOnUiThread(() -> { setLoginBusy(false); showLoginError(message(exception)); });
            }
        });
    }

    private void showLogin() {
        loginPanel.setVisibility(View.VISIBLE);
        appPanel.setVisibility(View.GONE);
        setLoginBusy(false);
    }

    private void showApplication() {
        loginPanel.setVisibility(View.GONE);
        appPanel.setVisibility(View.VISIBLE);
        ((TextView) findViewById(R.id.accountText)).setText("الحساب: " + store.email());
        deviceText.setText(deviceName() + " • " + Build.VERSION.RELEASE + " Android\nمعرّف الجهاز: " + store.deviceId().substring(0, Math.min(20, store.deviceId().length())) + "…");
        lastActionText.setText(store.lastAction());
        refreshPermissionStates();
        loadOrganizations();
        if (store.isConnected()) startBridge();
    }

    private void loadOrganizations() {
        executor.execute(() -> {
            try {
                JSONArray rows = api.getArray("/data/ai_organizations?order=created_at.asc&limit=100");
                organizations.clear();
                for (int index = 0; index < rows.length(); index++) {
                    JSONObject row = rows.getJSONObject(index);
                    organizations.add(new Organization(row.optString("id"), row.optString("name", "مساحة VAREX AI")));
                }
                runOnUiThread(this::renderOrganizations);
            } catch (Exception exception) {
                runOnUiThread(() -> toast(message(exception)));
            }
        });
    }

    private void renderOrganizations() {
        if (organizations.isEmpty()) { toast("لا توجد مساحة عمل مرتبطة بهذا الحساب"); return; }
        selectingOrganizations = true;
        List<String> names = new ArrayList<>();
        int selectedIndex = 0;
        for (int index = 0; index < organizations.size(); index++) {
            Organization organization = organizations.get(index);
            names.add(organization.name);
            if (organization.id.equals(store.organizationId())) selectedIndex = index;
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names);
        orgSpinner.setAdapter(adapter);
        orgSpinner.setSelection(selectedIndex);
        Organization selected = organizations.get(selectedIndex);
        store.setOrganization(selected.id, selected.name);
        selectingOrganizations = false;
        updateConnectionState();
    }

    private void connectDevice(boolean promptForNotifications) {
        if (store.organizationId().isEmpty()) { toast("اختر مساحة العمل أولاً"); return; }
        if (promptForNotifications && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestNotificationPermission();
        Button connect = findViewById(R.id.connectButton);
        connect.setEnabled(false);
        connect.setText("جاري ربط الهاتف…");
        executor.execute(() -> {
            try {
                JSONArray capabilities = capabilities();
                JSONObject body = new JSONObject()
                        .put("organization_id", store.organizationId())
                        .put("device_id", store.deviceId())
                        .put("device_name", deviceName())
                        .put("app_version", BuildConfig.VERSION_NAME)
                        .put("capabilities", capabilities);
                api.post("/devices/android/register", body);
                store.setConnected(true);
                store.setLastAction("تم ربط الهاتف؛ بانتظار أول مهمة من الموظف الذكي.");
                runOnUiThread(() -> { startBridge(); updateConnectionState(); lastActionText.setText(store.lastAction()); toast("تم ربط هاتف Android بنجاح"); });
            } catch (Exception exception) {
                runOnUiThread(() -> toast(message(exception)));
            } finally {
                runOnUiThread(() -> { connect.setEnabled(true); connect.setText("ربط الهاتف وبدء التنفيذ"); });
            }
        });
    }

    private void disconnectDevice(boolean logout) {
        Button button = findViewById(logout ? R.id.logoutButton : R.id.disconnectButton);
        button.setEnabled(false);
        executor.execute(() -> {
            try {
                if (store.isConnected() && !store.organizationId().isEmpty()) api.post("/devices/android/disconnect", new JSONObject().put("organization_id", store.organizationId()).put("device_id", store.deviceId()));
                if (logout) api.logout();
            } catch (Exception ignored) {
            } finally {
                store.setConnected(false);
                stopBridge();
                if (logout) store.clearSession();
                runOnUiThread(() -> {
                    button.setEnabled(true);
                    if (logout) { passwordInput.setText(""); showLogin(); }
                    else { updateConnectionState(); toast("تم فصل الهاتف وإيقاف التنفيذ"); }
                });
            }
        });
    }

    private JSONArray capabilities() {
        JSONArray result = new JSONArray();
        if (has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.WRITE_CONTACTS)) result.put("contacts");
        if (has(Manifest.permission.READ_CALENDAR) && has(Manifest.permission.WRITE_CALENDAR)) result.put("calendar");
        result.put("alarms");
        if (has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.CALL_PHONE)) result.put("phone");
        result.put("settings");
        return result;
    }

    private void refreshPermissionStates() {
        state(R.id.contactsState, has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.WRITE_CONTACTS), "قراءة وإضافة وتعديل وحذف");
        state(R.id.calendarState, has(Manifest.permission.READ_CALENDAR) && has(Manifest.permission.WRITE_CALENDAR), "قراءة وإنشاء وتعديل المواعيد");
        state(R.id.phoneState, has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.CALL_PHONE), "البحث عن الأرقام وبدء الاتصال");
        state(R.id.settingsState, Settings.System.canWrite(this), "فتح الإعدادات وتغيير المسموح");
        boolean notifications = Build.VERSION.SDK_INT < 33 || has(Manifest.permission.POST_NOTIFICATIONS);
        state(R.id.notificationsState, notifications, "حالة الاتصال ونتائج المهام");
        ((TextView) findViewById(R.id.alarmsState)).setText("✓ متاح عبر تطبيق الساعة");
        ((TextView) findViewById(R.id.alarmsState)).setTextColor(getColor(R.color.green));
    }

    private void state(int viewId, boolean granted, String description) {
        TextView view = findViewById(viewId);
        view.setText((granted ? "✓ مسموح — " : "● غير مسموح — ") + description);
        view.setTextColor(getColor(granted ? R.color.green : R.color.red));
    }

    private void updateConnectionState() {
        boolean connected = store.isConnected();
        connectionState.setText(connected ? "● الهاتف متصل" : "● الهاتف غير متصل");
        connectionState.setTextColor(getColor(connected ? R.color.green : R.color.red));
        findViewById(R.id.disconnectButton).setVisibility(connected ? View.VISIBLE : View.GONE);
    }

    private void startBridge() {
        Intent service = new Intent(this, BridgeService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
    }

    private void stopBridge() { stopService(new Intent(this, BridgeService.class)); }

    private void openAlarms() {
        try { startActivity(new Intent(AlarmClock.ACTION_SHOW_ALARMS)); }
        catch (Exception ignored) { toast("لم يتم العثور على تطبيق الساعة"); }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
        else toast("الإشعارات مسموحة على هذا الإصدار");
    }

    private boolean has(String permission) { return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private String deviceName() { return (Build.MANUFACTURER + " " + Build.MODEL).replaceAll("\\s+", " ").trim(); }
    private void setLoginBusy(boolean busy) { loginButton.setEnabled(!busy); loginProgress.setVisibility(busy ? View.VISIBLE : View.GONE); loginButton.setText(busy ? "جاري التحقق…" : "دخول وربط الهاتف"); }
    private void showLoginError(String value) { loginError.setText(value); loginError.setVisibility(View.VISIBLE); }
    private void hideKeyboard() { View focus = getCurrentFocus(); if (focus != null) ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(), 0); }
    private void toast(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }
    private static String message(Exception exception) { return exception.getMessage() == null ? "تعذر إكمال العملية" : exception.getMessage(); }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        refreshPermissionStates();
        if (store.isConnected()) connectDevice(false);
    }

    @Override protected void onResume() {
        super.onResume();
        if (appPanel != null && appPanel.getVisibility() == View.VISIBLE) { refreshPermissionStates(); updateConnectionState(); lastActionText.setText(store.lastAction()); }
    }

    @Override protected void onStart() {
        super.onStart();
        bridgeReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) { lastActionText.setText(store.lastAction()); }
        };
        IntentFilter filter = new IntentFilter(BridgeService.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(bridgeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(bridgeReceiver, filter);
    }

    @Override protected void onStop() {
        if (bridgeReceiver != null) { unregisterReceiver(bridgeReceiver); bridgeReceiver = null; }
        super.onStop();
    }

    @Override protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private static final class Organization {
        final String id;
        final String name;
        Organization(String id, String name) { this.id = id; this.name = name; }
    }
}
