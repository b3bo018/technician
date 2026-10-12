package com.securetrack.fieldoperations;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;

@CapacitorPlugin(name="SecureTrackLocation", permissions={
    @Permission(alias="location",strings={Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION}),
    @Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class SecureTrackLocationPlugin extends Plugin {
    private boolean hasLocation() { return ContextCompat.checkSelfPermission(getContext(),Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
        || ContextCompat.checkSelfPermission(getContext(),Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED; }
    @PluginMethod public void start(PluginCall call) {
        if(!hasLocation()){requestPermissionForAlias("location",call,"locationPermission");return;}
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissionForAlias("notifications",call,"notificationPermission");return;}
        startGranted(call);
    }
    @PermissionCallback private void locationPermission(PluginCall call){if(!hasLocation()){call.reject("Allow Android location permission to share workday location.");return;}start(call);}
    @PermissionCallback private void notificationPermission(PluginCall call){if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){call.reject("Allow notifications so workday location sharing stays visible.");return;}startGranted(call);}
    private void startGranted(PluginCall call){
        String uid=call.getString("uid",""),token=call.getString("token",""),refresh=call.getString("refreshToken",""),sessionId=call.getString("sessionId",""),trackingId=call.getString("trackingSessionId","");
        if(uid.isEmpty()||uid.length()>128||token.isEmpty()||refresh.isEmpty()||!sessionId.startsWith(uid+"_")||sessionId.length()>160||trackingId.isEmpty()||trackingId.length()>200){call.reject("Sign in again before starting workday location sharing.");return;}
        try {
            JSONObject session=new JSONObject().put("uid",uid).put("token",token).put("refreshToken",refresh)
                .put("sessionId",sessionId).put("trackingSessionId",trackingId).put("interval",Math.max(5,Math.min(60,call.getInt("updateIntervalSeconds",15))));
            LocationSession.save(getContext(),session);
            getContext().getSharedPreferences("location-status",0).edit().putBoolean("paused",false).apply();
            ContextCompat.startForegroundService(getContext(),new Intent(getContext(),WorkdayLocationService.class));call.resolve();
        }catch(Exception error){LocationSession.clear(getContext());call.reject("Open X OPS and try starting location sharing again.");}
    }
    @PluginMethod public void stop(PluginCall call){
        try{JSONObject session=LocationSession.load(getContext());getContext().stopService(new Intent(getContext(),WorkdayLocationService.class));LocationSession.clear(getContext());
            if(session!=null)new Thread(()->WorkdayLocationService.stopOnServer(session)).start();call.resolve();
        }catch(Exception error){call.reject("Could not stop location sharing.");}
    }
    @PluginMethod public void status(PluginCall call){JSObject result=new JSObject();result.put("running",WorkdayLocationService.running);result.put("paused",getContext().getSharedPreferences("location-status",0).getBoolean("paused",false));try{JSONObject session=LocationSession.load(getContext());if(session!=null){result.put("uid",session.optString("uid"));result.put("sessionId",session.optString("sessionId"));}}catch(Exception ignored){}call.resolve(result);}
    @PluginMethod public void updateToken(PluginCall call){try{JSONObject session=LocationSession.load(getContext());if(session!=null&&!call.getString("token","").isEmpty()){session.put("token",call.getString("token"));if(!call.getString("refreshToken","").isEmpty())session.put("refreshToken",call.getString("refreshToken"));LocationSession.save(getContext(),session);}call.resolve();}catch(Exception error){call.reject("Could not refresh location session.");}}
}
