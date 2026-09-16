package com.varex.ai.bridge;

import org.json.JSONObject;

public final class ExecutionResult {
    public final String status;
    public final String summary;
    public final String errorCode;
    public final JSONObject details;

    private ExecutionResult(String status, String summary, String errorCode, JSONObject details) {
        this.status = status;
        this.summary = summary;
        this.errorCode = errorCode;
        this.details = details == null ? new JSONObject() : details;
    }

    public static ExecutionResult completed(String summary, JSONObject details) {
        return new ExecutionResult("completed", summary, "", details);
    }

    public static ExecutionResult failed(String code, String summary) {
        return new ExecutionResult("failed", summary, code, new JSONObject());
    }

    public static ExecutionResult failed(String code, String summary, JSONObject details) {
        return new ExecutionResult("failed", summary, code, details);
    }
}
