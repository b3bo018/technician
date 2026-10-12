package com.securetrack.fieldoperations;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public class AwsAlertService extends Service {
    static volatile boolean running = false;
    private static final String API = "https://connect.securetrackgo.com";
    private static final String CONNECTION = "securetrack-connection", ALERTS = "securetrack-operations";
    private static final int CONNECTION_ID = 701;
    private ScheduledExecutorService executor;
    private int failures = 0;
    static class ApiError extends IOException { final int status; ApiError(int value) { status = value; } }

    static JSONObject request(String path, String token, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(API + path).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
        try {
            connection.setRequestMethod("POST"); connection.setRequestProperty("Content-Type", "application/json");
            if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setDoOutput(true);
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = connection.getResponseCode(); if (code < 200 || code >= 300) throw new ApiError(code);
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 262144) throw new IOException("Response too large"); }
                return new JSONObject(bytes.toString("UTF-8"));
            }
        } finally { connection.disconnect(); }
    }
    static JSONObject sync(JSONObject session) throws Exception {
        JSONObject body = new JSONObject().put("deviceId", session.getString("deviceId"))
            .put("ack", session.optJSONArray("ack") == null ? new JSONArray() : session.getJSONArray("ack"));
        try { return request("/v1/notifications/device-sync", session.getString("token"), body); }
        catch (ApiError error) {
            if (error.status != 401) throw error;
            JSONObject refreshed = request("/v1/auth/refresh", "", new JSONObject().put("refreshToken", session.getString("refreshToken")));
            session.put("token", refreshed.getString("accessToken"));
            if (refreshed.has("refreshToken")) session.put("refreshToken", refreshed.getString("refreshToken"));
            return request("/v1/notifications/device-sync", session.getString("token"), body);
        }
    }
    @Override public void onCreate() {
        super.onCreate(); executor = Executors.newSingleThreadScheduledExecutor();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CONNECTION, "AWS alert connection", NotificationManager.IMPORTANCE_LOW));
            manager.createNotificationChannel(new NotificationChannel(ALERTS, "Work alerts", NotificationManager.IMPORTANCE_HIGH));
        }
    }
    private PendingIntent openApp(int id) {
        return PendingIntent.getActivity(this, id, new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification connection(String message) {
        Intent stop = new Intent(this, AwsAlertService.class).setAction("STOP");
        return new NotificationCompat.Builder(this, CONNECTION).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("X OPS alerts").setContentText(message).setContentIntent(openApp(0)).setOngoing(true)
            .addAction(0, "Stop alerts", PendingIntent.getService(this, 0, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build();
    }
    private void updateConnection(String message) { getSystemService(NotificationManager.class).notify(CONNECTION_ID, connection(message)); }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) { AlertSession.clear(this); stopSelf(); return START_NOT_STICKY; }
        if (running) return START_NOT_STICKY;
        if (Build.VERSION.SDK_INT >= 29) startForeground(CONNECTION_ID, connection("Connecting to AWS…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(CONNECTION_ID, connection("Connecting to AWS…"));
        running = true; executor.execute(this::poll); return START_NOT_STICKY;
    }
    private void poll() {
        if (!running) return;
        int delay = 15;
        try {
            JSONObject session = AlertSession.load(this);
            if (session == null) { stopSelf(); return; }
            JSONObject result = sync(session); JSONArray items = result.getJSONArray("notifications");
            JSONArray received = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i); String id = item.getString("id");
                // Tag replaces an existing notification if a receipt is retried after a crash.
                Notification notification = new NotificationCompat.Builder(this, ALERTS).setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(item.getString("title")).setContentText(item.getString("body"))
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(item.getString("body")))
                    .setContentIntent(openApp(id.hashCode())).setAutoCancel(true).setOnlyAlertOnce(true).build();
                synchronized (AlertSession.class) {
                    JSONObject current = AlertSession.load(this);
                    if (!running || current == null || !current.optString("uid").equals(session.getString("uid"))) return;
                    getSystemService(NotificationManager.class).notify("aws:" + session.getString("uid") + ":" + id, 1, notification);
                }
                received.put(id);
            }
            session.put("ack", received);
            // Do not restore credentials if sign-out/disable happened while the request was in flight.
            synchronized (AlertSession.class) {
                JSONObject current = AlertSession.load(this);
                if (!running || current == null || !current.optString("uid").equals(session.getString("uid"))) return;
                AlertSession.save(this, session);
            }
            failures = 0; delay = items.length() == 100 ? 1 : 15;
            updateConnection("Connected to AWS · checking work alerts");
        } catch (ApiError error) {
            if (error.status == 401 || error.status == 403) { updateConnection("Sign in again to resume alerts"); stopSelf(); return; }
            delay = backoff();
        } catch (Exception error) { delay = backoff(); }
        if (running && !executor.isShutdown()) executor.schedule(this::poll, delay, TimeUnit.SECONDS);
    }
    private int backoff() { updateConnection("Reconnecting to AWS · open X OPS if this continues"); return Math.min(120, 5 * (1 << Math.min(++failures, 5))); }
    @Override public void onTimeout(int startId, int foregroundServiceType) { stopSelf(); }
    @Override public void onDestroy() { running = false; if (executor != null) executor.shutdownNow(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
