package com.securetrack.fieldoperations;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;
import org.unifiedpush.android.connector.FailedReason;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class SecureTrackPushService extends PushService {
    private static final String PREFS = "securetrack-unified-push";
    private static final String CHANNEL = "securetrack-operations";

    @Override public void onNewEndpoint(PushEndpoint endpoint, String instance) {
        if (endpoint == null || endpoint.getPubKeySet() == null) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String apiBase = prefs.getString("apiBase", ""), token = prefs.getString("token", "");
        if (apiBase.isEmpty() || token.isEmpty()) return;
        prefs.edit().putString("endpoint", endpoint.getUrl()).apply();
        JSONObject payload = new JSONObject();
        JSONObject subscription = new JSONObject();
        JSONObject keys = new JSONObject();
        try {
            keys.put("p256dh", endpoint.getPubKeySet().getPubKey());
            keys.put("auth", endpoint.getPubKeySet().getAuth());
            subscription.put("endpoint", endpoint.getUrl());
            subscription.put("keys", keys);
            payload.put("transport", "unifiedpush");
            payload.put("subscription", subscription);
            postJson(apiBase + "/v1/push/subscriptions", token, payload.toString());
        } catch (Exception ignored) { }
    }

    @Override public void onMessage(PushMessage message, String instance) {
        if (message == null || !message.getDecrypted()) return;
        try {
            JSONObject payload = new JSONObject(new String(message.getContent(), StandardCharsets.UTF_8));
            showNotification(payload.optString("title", "SecureTrack update"),
                payload.optString("body", "Open SecureTrack to view the update."));
        } catch (Exception ignored) { }
    }

    @Override public void onUnregistered(String instance) {
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String endpoint = prefs.getString("endpoint", ""), apiBase = prefs.getString("apiBase", ""), token = prefs.getString("token", "");
        if (!endpoint.isEmpty() && !apiBase.isEmpty() && !token.isEmpty()) removeSubscription(apiBase, token, endpoint);
        prefs.edit().remove("endpoint").apply();
    }

    @Override public void onRegistrationFailed(FailedReason reason, String instance) { }

    private void showNotification(String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL) == null) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "SecureTrack operations", NotificationManager.IMPORTANCE_HIGH));
        }
        Intent launch = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(getApplicationInfo().icon).setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(pending)
            .setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build();
        manager.notify((title + body).hashCode() & 0x7fffffff, notification);
    }

    static void removeSubscription(String apiBase, String token, String endpoint) {
        JSONObject payload = new JSONObject();
        try { payload.put("endpoint", endpoint); postJson(apiBase + "/v1/push/subscriptions", token, payload.toString(), "DELETE"); }
        catch (Exception ignored) { }
    }

    private static void postJson(String url, String token, String body) throws Exception { postJson(url, token, body, "POST"); }
    private static void postJson(String url, String token, String body, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setRequestMethod(method); connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
            connection.getResponseCode();
        } finally { connection.disconnect(); }
    }
}
