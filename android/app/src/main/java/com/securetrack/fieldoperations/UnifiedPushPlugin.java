package com.securetrack.fieldoperations;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.unifiedpush.android.connector.UnifiedPush;

@CapacitorPlugin(name = "UnifiedPush")
public class UnifiedPushPlugin extends Plugin {
    private static final String INSTANCE = "securetrack";
    private static final String PREFS = "securetrack-unified-push";

    @PluginMethod
    public void register(PluginCall call) {
        String publicKey = call.getString("publicKey", "");
        String apiBase = call.getString("apiBase", "");
        String token = call.getString("token", "");
        if (publicKey.length() != 87 || !apiBase.startsWith("https://") || token.isEmpty()) {
            call.reject("SecureTrack push setup is incomplete.");
            return;
        }
        preferences().edit().putString("apiBase", apiBase).putString("token", token)
            .putString("publicKey", publicKey).apply();
        try {
            if (UnifiedPush.getSavedDistributor(getContext()) != null) {
                UnifiedPush.register(getContext(), INSTANCE, "SecureTrack", publicKey);
                call.resolve();
                return;
            }
            UnifiedPush.tryUseCurrentOrDefaultDistributor(getActivity(), success -> {
                if (success) {
                    UnifiedPush.register(getContext(), INSTANCE, "SecureTrack", publicKey);
                    call.resolve();
                } else {
                    call.reject("Choose an installed UnifiedPush distributor to enable Android push.");
                }
                return null;
            });
        } catch (Exception error) {
            call.reject("Could not register with the self-hosted push distributor.", error);
        }
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        SharedPreferences prefs = preferences();
        String endpoint = prefs.getString("endpoint", "");
        String apiBase = prefs.getString("apiBase", "");
        String token = prefs.getString("token", "");
        if (!endpoint.isEmpty() && !apiBase.isEmpty() && !token.isEmpty()) {
            new Thread(() -> SecureTrackPushService.removeSubscription(apiBase, token, endpoint)).start();
        }
        try { UnifiedPush.unregister(getContext(), INSTANCE); } catch (Exception ignored) { }
        prefs.edit().remove("endpoint").remove("token").apply();
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
