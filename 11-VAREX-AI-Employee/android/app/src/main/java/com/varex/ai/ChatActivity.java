package com.varex.ai;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.varex.ai.bridge.BridgeService;
import com.varex.ai.network.ApiClient;
import com.varex.ai.storage.SessionStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChatActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 2001;
    private static final long REFRESH_INTERVAL_MS = 4000L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Agent> agents = new ArrayList<>();
    private final Runnable refreshMessages = new Runnable() {
        @Override public void run() {
            if (!chatVisible) return;
            loadMessages(false);
            if (chatVisible) handler.postDelayed(this, REFRESH_INTERVAL_MS);
        }
    };

    private SessionStore store;
    private ApiClient api;
    private Spinner agentSpinner;
    private Spinner providerSpinner;
    private Spinner voiceSpinner;
    private LinearLayout messagesContainer;
    private ScrollView scrollView;
    private EditText input;
    private Button sendButton;
    private Button micButton;
    private Button voiceButton;
    private TextView workingText;
    private TextView connectionState;
    private MediaPlayer voicePlayer;
    private SpeechRecognizer speechRecognizer;
    private BroadcastReceiver bridgeReceiver;
    private boolean chatVisible;
    private boolean loadingMessages;
    private boolean selectingAgents;
    private boolean listening;
    private String lastSpokenKey = "";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
    }

    protected final void showChatHome() {
        getWindow().setStatusBarColor(getColor(R.color.navy_dark));
        setContentView(R.layout.activity_chat);
        store = new SessionStore(this);
        if (!store.hasSession() || store.organizationId().isEmpty()) {
            openSettingsHome();
            return;
        }
        api = new ApiClient(store);
        chatVisible = true;
        bindViews();
        bindActions();
        updateVoiceButton();
        updateConnectionState();
        if (store.isConnected()) startBridge();
        showLocalWelcome("أهلاً! اسألني أي سؤال أو اطلب مني مهمة. فيك تكتب أو تضغط زر المايك، وأنا برجعلك بجواب أو بنتيجة تنفيذ حقيقية.");
        loadAgents();
        startChatPolling();
    }

    protected void openSettingsHome() { finish(); }

    protected final void leaveChatHome() {
        chatVisible = false;
        handler.removeCallbacks(refreshMessages);
        if (speechRecognizer != null && listening) speechRecognizer.stopListening();
        if (bridgeReceiver != null) { unregisterReceiver(bridgeReceiver); bridgeReceiver = null; }
    }

    private void bindViews() {
        agentSpinner = findViewById(R.id.agentSpinner);
        providerSpinner = findViewById(R.id.chatProviderSpinner);
        voiceSpinner = findViewById(R.id.chatVoiceSpinner);
        messagesContainer = findViewById(R.id.chatMessagesContainer);
        scrollView = findViewById(R.id.chatScrollView);
        input = findViewById(R.id.chatInput);
        sendButton = findViewById(R.id.chatSendButton);
        micButton = findViewById(R.id.chatMicButton);
        voiceButton = findViewById(R.id.voiceToggleButton);
        workingText = findViewById(R.id.chatWorkingText);
        connectionState = findViewById(R.id.chatConnectionState);
    }

    private void bindActions() {
        findViewById(R.id.chatSettingsButton).setOnClickListener(view -> { leaveChatHome(); openSettingsHome(); });
        sendButton.setOnClickListener(view -> sendCurrentText("text"));
        micButton.setOnClickListener(view -> toggleListening());
        voiceButton.setOnClickListener(view -> {
            boolean enabled = !store.voiceRepliesEnabled();
            store.setVoiceRepliesEnabled(enabled);
            if (!enabled) stopVoicePlayer();
            updateVoiceButton();
            toast(enabled ? "تم تشغيل صوت الموظف" : "تم كتم صوت الموظف");
        });
        ArrayAdapter<String> providers = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"تلقائي", "ChatGPT", "Gemini"});
        providerSpinner.setAdapter(providers);
        providerSpinner.setSelection("openai".equals(store.aiProvider()) ? 1 : "gemini".equals(store.aiProvider()) ? 2 : 0);
        providerSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) { store.setAiProvider(position == 1 ? "openai" : position == 2 ? "gemini" : "auto"); }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        ArrayAdapter<String> voices = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"صوت دافئ", "صوت ودود", "صوت هادئ", "صوت واضح"});
        voiceSpinner.setAdapter(voices);
        String currentVoice = store.geminiVoice();
        voiceSpinner.setSelection("Achird".equals(currentVoice) ? 1 : "Achernar".equals(currentVoice) ? 2 : "Kore".equals(currentVoice) ? 3 : 0);
        voiceSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) { store.setGeminiVoice(position == 1 ? "Achird" : position == 2 ? "Achernar" : position == 3 ? "Kore" : "Sulafat"); }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        input.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendCurrentText("text");
                return true;
            }
            return false;
        });
        agentSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (selectingAgents || position < 0 || position >= agents.size()) return;
                Agent selected = agents.get(position);
                if (!selected.id.equals(store.selectedAgentId())) {
                    store.setSelectedAgent(selected.id, selected.name);
                    lastSpokenKey = "";
                }
                loadMessages(true);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
    }

    private void loadAgents() {
        setWorking(true, "عم حمّل موظفيك…");
        executor.execute(() -> {
            try {
                JSONArray rows = api.getArray("/data/ai_agents?organization_id=eq." + encode(store.organizationId()) + "&order=created_at.asc&limit=100");
                agents.clear();
                for (int index = 0; index < rows.length(); index++) {
                    JSONObject row = rows.getJSONObject(index);
                    agents.add(new Agent(row.optString("id"), row.optString("name", "موظف ذكي"), row.optString("role", "موظف"), row.optString("status", "paused")));
                }
                runOnUiThread(this::renderAgents);
            } catch (Exception exception) {
                runOnUiThread(() -> {
                    setWorking(false, "");
                    showLocalWelcome(message(exception));
                });
            }
        });
    }

    private void renderAgents() {
        setWorking(false, "");
        if (agents.isEmpty()) {
            input.setEnabled(false);
            sendButton.setEnabled(false);
            micButton.setEnabled(false);
            showLocalWelcome("ما في موظف ذكي بحسابك حالياً. افتحي الإعدادات وأنشئي موظف وفعّليه أولاً.");
            return;
        }
        selectingAgents = true;
        List<String> labels = new ArrayList<>();
        int selected = -1;
        for (int index = 0; index < agents.size(); index++) {
            Agent agent = agents.get(index);
            labels.add(agent.name + " — " + agent.role + (agent.active() ? "" : " (متوقف)"));
            if (agent.id.equals(store.selectedAgentId())) selected = index;
        }
        if (selected < 0) {
            for (int index = 0; index < agents.size(); index++) {
                Agent candidate = agents.get(index);
                if (candidate.active() && !candidate.name.contains("تجريبي")) { selected = index; break; }
            }
        }
        if (selected < 0) for (int index = 0; index < agents.size(); index++) if (agents.get(index).active()) { selected = index; break; }
        if (selected < 0) selected = 0;
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
        agentSpinner.setAdapter(adapter);
        agentSpinner.setSelection(selected);
        Agent agent = agents.get(selected);
        store.setSelectedAgent(agent.id, agent.name);
        selectingAgents = false;
        input.setEnabled(true);
        sendButton.setEnabled(true);
        micButton.setEnabled(true);
        loadMessages(true);
    }

    private void loadMessages(boolean showLoading) {
        if (loadingMessages || store.selectedAgentId().isEmpty()) return;
        loadingMessages = true;
        if (showLoading) setWorking(true, "الموظف عم يفتح المحادثة…");
        executor.execute(() -> {
            try {
                JSONObject result = api.getObject("/chat/messages?organization_id=" + encode(store.organizationId()) + "&agent_id=" + encode(store.selectedAgentId()) + "&limit=120");
                JSONArray messages = result.optJSONArray("messages");
                if (messages == null) messages = new JSONArray();
                JSONArray finalMessages = messages;
                runOnUiThread(() -> renderMessages(finalMessages));
            } catch (Exception exception) {
                if (showLoading) runOnUiThread(() -> toast(message(exception)));
            } finally {
                loadingMessages = false;
                if (showLoading) runOnUiThread(() -> setWorking(false, ""));
            }
        });
    }

    private void renderMessages(JSONArray messages) {
        messagesContainer.removeAllViews();
        if (messages.length() == 0) {
            showLocalWelcome("أنا " + (store.selectedAgentName().isEmpty() ? "موظفك الذكي" : store.selectedAgentName()) + ". احكي معي بطريقتك، وأنا بنفّذ ضمن الصلاحيات وبرجعلك بالنتيجة هون.");
            return;
        }
        JSONObject lastAssistant = null;
        for (int index = 0; index < messages.length(); index++) {
            JSONObject message = messages.optJSONObject(index);
            if (message == null) continue;
            renderMessage(message);
            if ("assistant".equals(message.optString("role"))) lastAssistant = message;
        }
        scrollToBottom();
        if (lastAssistant != null) speakAssistant(lastAssistant);
    }

    private void renderMessage(JSONObject message) {
        boolean mine = "user".equals(message.optString("role"));
        String kind = message.optString("kind", "text");
        String body = message.optString("display_body", message.optString("body", ""));
        JSONObject execution = message.optJSONObject("execution");

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setGravity(mine ? Gravity.RIGHT : Gravity.LEFT);
        row.setPadding(0, 0, 0, dp(12));
        messagesContainer.addView(row, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView bubble = new TextView(this);
        bubble.setText(body);
        bubble.setTextSize(16);
        bubble.setLineSpacing(dp(3), 1f);
        bubble.setTextIsSelectable(true);
        bubble.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG_RTL);
        bubble.setMaxWidth((int) (getResources().getDisplayMetrics().widthPixels * .84f));
        if (mine) {
            bubble.setTextColor(getColor(android.R.color.white));
            bubble.setBackgroundResource(R.drawable.bg_chat_user);
        } else if ("error".equals(kind) || (execution != null && "failed".equals(execution.optString("status")))) {
            bubble.setTextColor(getColor(R.color.red));
            bubble.setBackgroundResource(R.drawable.bg_chat_error);
        } else if ("action".equals(kind) || "approval".equals(kind)) {
            bubble.setTextColor(getColor(R.color.ink));
            bubble.setBackgroundResource(R.drawable.bg_chat_action);
        } else {
            bubble.setTextColor(getColor(R.color.ink));
            bubble.setBackgroundResource(R.drawable.bg_chat_assistant);
        }
        row.addView(bubble, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout meta = new LinearLayout(this);
        meta.setOrientation(LinearLayout.HORIZONTAL);
        meta.setGravity(Gravity.CENTER_VERTICAL);
        TextView state = new TextView(this);
        state.setText(statusText(message, execution));
        state.setTextColor(getColor(R.color.muted));
        state.setTextSize(11);
        meta.addView(state, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(34)));
        if (!mine) {
            Button hear = miniButton("🔊 اسمع");
            hear.setOnClickListener(view -> speak(body, true));
            meta.addView(hear);
        }
        row.addView(meta);

        if (!mine && execution != null && "awaiting_approval".equals(execution.optString("status"))) {
            LinearLayout decisions = new LinearLayout(this);
            decisions.setOrientation(LinearLayout.HORIZONTAL);
            decisions.setGravity(Gravity.LEFT);
            decisions.setPadding(0, dp(2), 0, 0);
            Button approve = actionButton("موافقة وتنفيذ", false);
            Button reject = actionButton("رفض", true);
            String executionId = execution.optString("id");
            approve.setOnClickListener(view -> decide(executionId, "approved", approve, reject));
            reject.setOnClickListener(view -> decide(executionId, "rejected", approve, reject));
            decisions.addView(approve);
            decisions.addView(reject);
            row.addView(decisions);
        }
    }

    private String statusText(JSONObject message, JSONObject execution) {
        if (execution != null) {
            switch (execution.optString("status")) {
                case "awaiting_approval": return "بانتظار موافقتك";
                case "queued": return "انرسلت للهاتف";
                case "running": return "جاري التنفيذ";
                case "completed": return "تم التنفيذ";
                case "failed": return "فشل التنفيذ";
                case "rejected": return "تم الرفض";
                case "cancelled": return "ملغاة";
                case "blocked": return "ممنوعة";
                default: break;
            }
        }
        JSONObject metadata = message.optJSONObject("metadata");
        String provider = metadata == null ? "" : metadata.optString("provider");
        String providerLabel = "openai".equals(provider) ? "ChatGPT" : "gemini".equals(provider) ? "Gemini" : "";
        String time = "voice".equals(message.optString("kind")) ? "أمر صوتي" : shortTime(message.optString("created_at"));
        return providerLabel.isEmpty() ? time : providerLabel + (time.isEmpty() ? "" : " • " + time);
    }

    private void showLocalWelcome(String value) {
        messagesContainer.removeAllViews();
        JSONObject message = new JSONObject();
        try { message.put("role", "assistant").put("body", value).put("kind", "text"); }
        catch (Exception ignored) { }
        renderMessage(message);
        scrollToBottom();
    }

    private void sendCurrentText(String mode) {
        String value = input.getText().toString().trim();
        if (value.isEmpty()) return;
        sendMessage(value, mode);
    }

    private void sendMessage(String value, String mode) {
        if (store.selectedAgentId().isEmpty()) { toast("اختر الموظف أولاً"); return; }
        input.setText("");
        hideKeyboard();
        setComposerEnabled(false);
        setWorking(true, "الموظف عم يفهم الطلب…");
        appendTemporaryUser(value);
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("organization_id", store.organizationId())
                        .put("agent_id", store.selectedAgentId())
                        .put("body", value)
                        .put("input_mode", mode)
                        .put("model_provider", store.aiProvider())
                        .put("client_message_id", UUID.randomUUID().toString());
                api.post("/chat/messages", body);
                runOnUiThread(() -> loadMessages(true));
            } catch (Exception exception) {
                runOnUiThread(() -> {
                    if (input.getText().toString().trim().isEmpty()) input.setText(value);
                    toast(message(exception));
                    loadMessages(false);
                });
            } finally {
                runOnUiThread(() -> {
                    setComposerEnabled(true);
                    setWorking(false, "");
                });
            }
        });
    }

    private void appendTemporaryUser(String value) {
        JSONObject message = new JSONObject();
        try { message.put("role", "user").put("body", value).put("kind", "text"); }
        catch (Exception ignored) { }
        renderMessage(message);
        scrollToBottom();
    }

    private void decide(String executionId, String decision, Button approve, Button reject) {
        if (executionId.isEmpty()) return;
        approve.setEnabled(false);
        reject.setEnabled(false);
        setWorking(true, decision.equals("approved") ? "عم نفّذ بعد موافقتك…" : "عم ألغي العملية…");
        executor.execute(() -> {
            try {
                api.post("/chat/actions/" + encode(executionId) + "/decision", new JSONObject()
                        .put("organization_id", store.organizationId())
                        .put("agent_id", store.selectedAgentId())
                        .put("decision", decision));
            } catch (Exception exception) {
                runOnUiThread(() -> toast(message(exception)));
            } finally {
                runOnUiThread(() -> {
                    setWorking(false, "");
                    loadMessages(true);
                });
            }
        });
    }

    private void toggleListening() {
        if (listening) {
            if (speechRecognizer != null) speechRecognizer.stopListening();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
            return;
        }
        startListening();
    }

    private void startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            toast("خدمة تحويل الصوت إلى كتابة غير متوفرة على هذا الهاتف");
            return;
        }
        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { setListening(true, "احكي هلق…"); }
                @Override public void onBeginningOfSpeech() { setListening(true, "عم اسمعك…"); }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { setListening(false, "عم حوّل كلامك لرسالة…"); }
                @Override public void onError(int error) {
                    setListening(false, "");
                    if (error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) toast(speechError(error));
                }
                @Override public void onResults(Bundle results) {
                    setListening(false, "");
                    ArrayList<String> values = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (values != null && !values.isEmpty() && !values.get(0).trim().isEmpty()) sendMessage(values.get(0).trim(), "voice");
                }
                @Override public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> values = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (values != null && !values.isEmpty()) input.setText(values.get(0));
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-AE")
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-AE")
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        speechRecognizer.startListening(intent);
        setListening(true, "جهّزي كلامك…");
    }

    private void setListening(boolean active, String text) {
        listening = active;
        micButton.setText(active ? "■" : "🎙");
        micButton.setContentDescription(active ? "إيقاف التسجيل" : "تسجيل أمر صوتي");
        setWorking(!text.isEmpty(), text);
    }

    private String speechError(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "تعذر الاتصال بخدمة تحويل الصوت إلى كتابة";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "اسمحي للتطبيق باستخدام المايك أولاً";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "خدمة الصوت مشغولة؛ جرّبي بعد لحظة";
            default: return "ما قدرت أفهم التسجيل؛ جرّبي مرة ثانية";
        }
    }

    private void speakAssistant(JSONObject message) {
        if (!store.voiceRepliesEnabled()) return;
        JSONObject execution = message.optJSONObject("execution");
        String status = execution == null ? "" : execution.optString("status");
        String key = message.optString("id", "local") + ":" + status;
        if (key.equals(lastSpokenKey)) return;
        lastSpokenKey = key;
        speak(message.optString("display_body", message.optString("body", "")), false);
    }

    private void speak(String text, boolean manual) {
        String speech = text.replace("•", "").replaceAll("https?://\\S+", "رابط").trim();
        if (speech.isEmpty()) return;
        executor.execute(() -> {
            try {
                byte[] wave = api.postBytes("/chat/speech", new JSONObject()
                        .put("organization_id", store.organizationId())
                        .put("agent_id", store.selectedAgentId())
                        .put("text", speech)
                        .put("voice", store.geminiVoice()));
                File audio = new File(getCacheDir(), "varex-gemini-voice.wav");
                try (FileOutputStream output = new FileOutputStream(audio, false)) { output.write(wave); }
                runOnUiThread(() -> playVoiceFile(audio, manual));
            } catch (Exception exception) {
                if (manual) runOnUiThread(() -> toast(message(exception)));
            }
        });
    }

    private void playVoiceFile(File audio, boolean manual) {
        try {
            stopVoicePlayer();
            voicePlayer = new MediaPlayer();
            voicePlayer.setDataSource(audio.getAbsolutePath());
            voicePlayer.setOnCompletionListener(player -> stopVoicePlayer());
            voicePlayer.setOnErrorListener((player, what, extra) -> { stopVoicePlayer(); if (manual) toast("تعذر تشغيل صوت Gemini"); return true; });
            voicePlayer.prepare();
            voicePlayer.start();
        } catch (Exception exception) {
            stopVoicePlayer();
            if (manual) toast("تعذر تشغيل صوت Gemini");
        }
    }

    private void stopVoicePlayer() {
        if (voicePlayer == null) return;
        try { if (voicePlayer.isPlaying()) voicePlayer.stop(); } catch (Exception ignored) { }
        voicePlayer.release();
        voicePlayer = null;
    }

    private Button miniButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(11);
        button.setTextColor(getColor(R.color.blue));
        button.setAllCaps(false);
        button.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setPadding(dp(8), 0, dp(8), 0);
        return button;
    }

    private Button actionButton(String label, boolean danger) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(12);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(getColor(danger ? R.color.red : R.color.blue));
        button.setBackgroundResource(danger ? R.drawable.bg_danger_button : R.drawable.bg_secondary_button);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(44));
        params.setMargins(0, 0, dp(8), 0);
        button.setLayoutParams(params);
        return button;
    }

    private void setComposerEnabled(boolean enabled) {
        input.setEnabled(enabled);
        sendButton.setEnabled(enabled);
        micButton.setEnabled(enabled);
    }

    private void setWorking(boolean visible, String value) {
        workingText.setText(value.isEmpty() ? "الموظف عم يجهّز الرد…" : value);
        workingText.setVisibility(visible ? View.VISIBLE : View.GONE);
    }

    private void updateVoiceButton() {
        voiceButton.setText(store.voiceRepliesEnabled() ? "🔊" : "🔇");
    }

    private void updateConnectionState() {
        boolean connected = store.isConnected();
        connectionState.setText(connected ? "● متصل وجاهز للتنفيذ" : "● المحادثة متاحة — تنفيذ الهاتف متوقف");
        connectionState.setTextColor(getColor(connected ? R.color.green_soft : R.color.red_soft));
    }

    private void startBridge() {
        Intent service = new Intent(this, BridgeService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
    }

    private void startChatPolling() {
        handler.removeCallbacks(refreshMessages);
        if (chatVisible) handler.postDelayed(refreshMessages, REFRESH_INTERVAL_MS);
    }

    private void scrollToBottom() { scrollView.post(() -> scrollView.fullScroll(View.FOCUS_DOWN)); }
    private void hideKeyboard() { View focus = getCurrentFocus(); if (focus != null) ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(), 0); }
    private void toast(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private static String shortTime(String value) { return value != null && value.length() >= 16 ? value.substring(11, 16) : ""; }
    private static String message(Exception exception) { return exception.getMessage() == null ? "تعذر إكمال العملية" : exception.getMessage(); }
    private static String encode(String value) { try { return URLEncoder.encode(value, "UTF-8"); } catch (Exception ignored) { return value; } }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == AUDIO_PERMISSION_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startListening();
            else toast("بدون صلاحية المايك بتقدري تكتبي الأوامر فقط");
        }
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    @Override protected void onStart() {
        super.onStart();
        if (!chatVisible) return;
        startChatPolling();
        bridgeReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) { loadMessages(false); }
        };
        IntentFilter filter = new IntentFilter(BridgeService.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(bridgeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(bridgeReceiver, filter);
    }

    @Override protected void onResume() {
        super.onResume();
        if (chatVisible && store != null) updateConnectionState();
    }

    @Override protected void onStop() {
        handler.removeCallbacks(refreshMessages);
        if (bridgeReceiver != null) { unregisterReceiver(bridgeReceiver); bridgeReceiver = null; }
        super.onStop();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        executor.shutdownNow();
        if (speechRecognizer != null) { speechRecognizer.cancel(); speechRecognizer.destroy(); }
        stopVoicePlayer();
        super.onDestroy();
    }

    private static final class Agent {
        final String id;
        final String name;
        final String role;
        final String status;
        Agent(String id, String name, String role, String status) { this.id = id; this.name = name; this.role = role; this.status = status; }
        boolean active() { return "active".equals(status); }
    }
}
