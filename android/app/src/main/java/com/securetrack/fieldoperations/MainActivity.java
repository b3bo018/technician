package com.securetrack.fieldoperations;

import android.os.Bundle;
import android.content.pm.PackageManager;
import com.getcapacitor.BridgeActivity;
import com.securetrack.fieldoperations.UnifiedPushPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UnifiedPushPlugin.class);
        super.onCreate(savedInstanceState);
        int detectedVersion = 0;
        try {
            detectedVersion = (int) getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
        } catch (PackageManager.NameNotFoundException ignored) {}
        final int versionCode = detectedVersion;
        final String preferenceKey = "web_cache_refresh_version";
        if (getPreferences(MODE_PRIVATE).getInt(preferenceKey, 0) != versionCode) {
            getPreferences(MODE_PRIVATE).edit().putInt(preferenceKey, versionCode).apply();
            getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(
                "(async()=>{try{const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)));}catch(e){}location.reload();})()",
                null
            ), 1200);
        }
    }
}
