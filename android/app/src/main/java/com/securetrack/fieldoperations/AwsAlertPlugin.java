package com.securetrack.fieldoperations;

import android.content.Intent;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.util.UUID;

@CapacitorPlugin(name = "AwsAlerts")
public class AwsAlertPlugin extends Plugin {
    @PluginMethod public void register(PluginCall call) {
        String token = call.getString("token", ""), refresh = call.getString("refreshToken", ""), uid = call.getString("uid", "");
        if (token.isEmpty() || refresh.isEmpty() || uid.isEmpty()) { call.reject("Sign in again to enable alerts."); return; }
        if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Allow notifications before enabling alerts."); return;
        }
        new Thread(() -> {
            try {
                getContext().stopService(new Intent(getContext(), AwsAlertService.class));
                JSONObject old = AlertSession.load(getContext());
                JSONObject session = old != null && uid.equals(old.optString("uid")) ? old : new JSONObject();
                session.put("uid", uid).put("token", token).put("refreshToken", refresh);
                android.content.SharedPreferences installation = getContext().getSharedPreferences("aws-alert-device", 0);
                String deviceId = installation.getString("id", "");
                if (deviceId.isEmpty()) { deviceId = UUID.randomUUID().toString(); installation.edit().putString("id", deviceId).commit(); }
                session.put("deviceId", deviceId);
                // Verify the authenticated AWS endpoint before reporting success.
                AwsAlertService.sync(session);
                AlertSession.save(getContext(), session);
                getActivity().runOnUiThread(() -> {
                    try { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), AwsAlertService.class)); call.resolve(); }
                    catch (Exception e) { AlertSession.clear(getContext()); call.reject("Open X OPS and try enabling alerts again."); }
                });
            } catch (Exception e) { call.reject("AWS alerts could not connect. Check your connection or contact your administrator."); }
        }).start();
    }
    @PluginMethod public void unregister(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AwsAlertService.class));
        AlertSession.clear(getContext()); call.resolve();
    }
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject(); result.put("running", AwsAlertService.running);
        try { result.put("requested", AlertSession.load(getContext()) != null); } catch (Exception e) { result.put("requested", false); }
        call.resolve(result);
    }
}
