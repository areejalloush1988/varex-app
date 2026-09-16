package com.varex.ai;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.ProgressBar;
import android.widget.Toast;

import com.varex.ai.storage.SessionStore;

import org.json.JSONObject;
import org.json.JSONTokener;

import java.nio.charset.StandardCharsets;

public final class DashboardActivity extends Activity {
    private static final String SESSION_KEY = "varex-ai-private-session-v2";
    private static final long SESSION_SYNC_INTERVAL_MS = 15000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ProgressBar progress;
    private SessionStore store;
    private String dashboardHost;
    private boolean dashboardLoaded;
    private OnBackInvokedCallback backCallback;

    private final Runnable sessionSync = new Runnable() {
        @Override public void run() {
            syncSessionFromDashboard(null);
            handler.postDelayed(this, SESSION_SYNC_INTERVAL_MS);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(getColor(R.color.navy_dark));
        setContentView(R.layout.activity_dashboard);

        store = new SessionStore(this);
        if (!store.hasSession()) {
            Toast.makeText(this, "انتهت الجلسة؛ سجّل الدخول من التطبيق", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        dashboardHost = Uri.parse(BuildConfig.DASHBOARD_URL).getHost();
        webView = findViewById(R.id.dashboardWebView);
        progress = findViewById(R.id.dashboardProgress);
        findViewById(R.id.dashboardBackButton).setOnClickListener(view -> closeDashboard());
        findViewById(R.id.dashboardRefreshButton).setOnClickListener(view -> webView.reload());
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " VAREX-AI-Android/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
            }

            @Override public void onPageFinished(WebView view, String url) {
                if (isTrustedDashboard(Uri.parse(url))) dashboardLoaded = true;
                progress.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (isTrustedDashboard(target)) return false;
                openExternal(target);
                return true;
            }
        });

        openDashboardWithNativeSession();
    }

    private void openDashboardWithNativeSession() {
        JSONObject session = store.session();
        if (session == null) {
            finish();
            return;
        }
        String encodedSession = Base64.encodeToString(session.toString().getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        String destination = JSONObject.quote(BuildConfig.DASHBOARD_URL);
        String html = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>"
                + "<script>(function(){try{"
                + "const bytes=Uint8Array.from(atob('" + encodedSession + "'),c=>c.charCodeAt(0));"
                + "sessionStorage.setItem('" + SESSION_KEY + "',new TextDecoder('utf-8').decode(bytes));"
                + "location.replace(" + destination + ");"
                + "}catch(error){document.body.textContent='تعذر فتح لوحة VAREX AI';}})();</script>"
                + "</body></html>";
        String baseUrl = BuildConfig.DASHBOARD_URL.endsWith("/") ? BuildConfig.DASHBOARD_URL : BuildConfig.DASHBOARD_URL + "/";
        webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", BuildConfig.DASHBOARD_URL);
    }

    private boolean isTrustedDashboard(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && dashboardHost != null
                && dashboardHost.equalsIgnoreCase(uri.getHost());
    }

    private void openExternal(Uri target) {
        if (target == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, target));
        } catch (Exception ignored) {
            Toast.makeText(this, "تعذر فتح الرابط المطلوب", Toast.LENGTH_LONG).show();
        }
    }

    private void syncSessionFromDashboard(Runnable afterSync) {
        if (!dashboardLoaded || webView == null) {
            if (afterSync != null) afterSync.run();
            return;
        }
        String script = "(function(){return sessionStorage.getItem('" + SESSION_KEY + "')||'';})();";
        webView.evaluateJavascript(script, value -> {
            try {
                Object decoded = new JSONTokener(value).nextValue();
                if (decoded instanceof String && !((String) decoded).isEmpty()) {
                    JSONObject candidate = new JSONObject((String) decoded);
                    JSONObject current = store.session();
                    long candidateExpiry = candidate.optLong("expires_at", 0L);
                    long currentExpiry = current == null ? 0L : current.optLong("expires_at", 0L);
                    if (!candidate.optString("access_token", "").isEmpty()
                            && !candidate.optString("refresh_token", "").isEmpty()
                            && (current == null || candidateExpiry >= currentExpiry)) {
                        store.saveSession(candidate);
                    }
                }
            } catch (Exception ignored) {
                // Keep the encrypted native session if the page is navigating or unavailable.
            }
            if (afterSync != null) afterSync.run();
        });
    }

    private void closeDashboard() {
        syncSessionFromDashboard(this::finish);
    }

    @Override protected void onResume() {
        super.onResume();
        handler.removeCallbacks(sessionSync);
        handler.postDelayed(sessionSync, SESSION_SYNC_INTERVAL_MS);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(sessionSync);
        syncSessionFromDashboard(null);
        super.onPause();
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else closeDashboard();
    }

    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        handleBack();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacks(sessionSync);
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
