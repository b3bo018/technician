package com.securetrack.fieldoperations;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class WorkdayLocationService extends Service implements LocationListener {
    static volatile boolean running=false;
    private static final String API="https://connect.securetrackgo.com",CHANNEL="securetrack-workday-location";
    private static final int ID=703;
    private LocationManager locations; private ScheduledExecutorService worker; private volatile Location newest;
    private final AtomicBoolean pending=new AtomicBoolean(false);private volatile boolean active=false;private long uploadedAt=0;private int failures=0;
    static class ApiError extends IOException{final int code;ApiError(int value){code=value;}}
    static JSONObject request(String path,String token,JSONObject data)throws Exception{
        HttpURLConnection connection=(HttpURLConnection)new URL(API+path).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(15000);
        try{connection.setRequestMethod(data==null?"GET":"POST");connection.setRequestProperty("Content-Type","application/json");if(!token.isEmpty())connection.setRequestProperty("Authorization","Bearer "+token);
            if(data!=null){connection.setDoOutput(true);try(OutputStream out=connection.getOutputStream()){out.write(data.toString().getBytes(StandardCharsets.UTF_8));}}
            int code=connection.getResponseCode();if(code<200||code>=300)throw new ApiError(code);if(code==204)return new JSONObject();
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1){out.write(buffer,0,count);if(out.size()>131072)throw new IOException("Response too large");}String text=out.toString("UTF-8");return text.isEmpty()?new JSONObject():new JSONObject(text);}
        }finally{connection.disconnect();}
    }
    static JSONObject authorized(JSONObject session,String path,JSONObject body)throws Exception{
        try{return request(path,session.getString("token"),body);}catch(ApiError error){if(error.code!=401)throw error;
            JSONObject refreshed=request("/v1/auth/refresh","",new JSONObject().put("refreshToken",session.getString("refreshToken")));
            session.put("token",refreshed.getString("accessToken"));if(refreshed.has("refreshToken"))session.put("refreshToken",refreshed.getString("refreshToken"));
            return request(path,session.getString("token"),body);
        }
    }
    static void stopOnServer(JSONObject session){try{authorized(session,"/v1/locations/stop",new JSONObject().put("sessionId",session.getString("sessionId")).put("trackingSessionId",session.getString("trackingSessionId")));}catch(Exception ignored){}}
    private static String sampleTime(long timestamp){SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);format.setTimeZone(TimeZone.getTimeZone("UTC"));return format.format(new Date(timestamp));}
    private boolean hasLocation(){return ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    @Override public void onCreate(){super.onCreate();locations=(LocationManager)getSystemService(LOCATION_SERVICE);worker=Executors.newSingleThreadScheduledExecutor();if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"Workday location sharing",NotificationManager.IMPORTANCE_LOW));}
    private Notification notification(String text){PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop=PendingIntent.getService(this,0,new Intent(this,WorkdayLocationService.class).setAction("STOP"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("X OPS workday location sharing").setContentText(text).setContentIntent(open).setOngoing(true).addAction(0,"Stop sharing",stop).build();}
    private void notice(String text){if(active)getSystemService(NotificationManager.class).notify(ID,notification(text));}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&"STOP".equals(intent.getAction())){getSharedPreferences("location-status",0).edit().putBoolean("paused",true).apply();try{JSONObject session=LocationSession.load(this);LocationSession.clear(this);if(session!=null)new Thread(()->{stopOnServer(session);try{authorized(session,"/v1/locations/consent",new JSONObject().put("granted",false).put("policyVersion","1"));}catch(Exception ignored){}}).start();}catch(Exception ignored){}stopSelf();return START_NOT_STICKY;}
        if(active)return START_NOT_STICKY;
        if(!hasLocation()){stopSelf();return START_NOT_STICKY;}
        try{
            if(Build.VERSION.SDK_INT>=29)startForeground(ID,notification("Getting a fresh location…"),ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(ID,notification("Getting a fresh location…"));
            active=true;running=true;
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&locations.getAllProviders().contains(LocationManager.GPS_PROVIDER))locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,15000,0,this,Looper.getMainLooper());
            if(locations.getAllProviders().contains(LocationManager.NETWORK_PROVIDER))locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,15000,0,this,Looper.getMainLooper());
            worker.scheduleWithFixedDelay(()->{if(!active)return;if(!hasLocation()){stopSelf();return;}Location fix=newest;if(fix!=null)submit(fix);else notice("Waiting for GPS · check Android Location Services");},5,15,TimeUnit.SECONDS);
        }catch(Exception error){stopSelf();}return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location fix){long age=(SystemClock.elapsedRealtimeNanos()-fix.getElapsedRealtimeNanos())/1000000;
        if(!FreshLocation.valid(fix.getLatitude(),fix.getLongitude(),fix.getAccuracy(),age))return;
        Location previous=newest;long previousAge=previous==null?Long.MAX_VALUE:(SystemClock.elapsedRealtimeNanos()-previous.getElapsedRealtimeNanos())/1000000;
        if(previous==null||previousAge>15000||fix.getAccuracy()<=previous.getAccuracy())newest=new Location(fix);
        if(active)submit(newest);
    }
    private void submit(Location fix){if(!active||worker.isShutdown()||fix==null||!pending.compareAndSet(false,true))return;
        try{worker.execute(()->{try{
            if(!active||!hasLocation())return;JSONObject session=LocationSession.load(this);if(session==null){stopSelf();return;}
            long age=(SystemClock.elapsedRealtimeNanos()-fix.getElapsedRealtimeNanos())/1000000;
            if(!FreshLocation.valid(fix.getLatitude(),fix.getLongitude(),fix.getAccuracy(),age)){notice("Waiting for a fresh GPS update");return;}
            if(SystemClock.elapsedRealtime()-uploadedAt<session.optInt("interval",15)*1000L)return;
            JSONObject consent=authorized(session,"/v1/locations/consent",null);
            JSONObject duty=authorized(session,"/documents/work_sessions/"+android.net.Uri.encode(session.getString("sessionId")),null);
            JSONObject profile=authorized(session,"/documents/users/"+android.net.Uri.encode(session.getString("uid")),null);
            if(!consent.optBoolean("granted")||!duty.optBoolean("exists")||!"active".equals(duty.getJSONObject("data").optString("status"))
                ||!profile.optBoolean("exists")||!"technician".equals(profile.getJSONObject("data").optString("role"))
                ||"deactivated".equals(profile.getJSONObject("data").optString("status"))){stopSelf();return;}
            if(!active||!hasLocation())return;
            age=(SystemClock.elapsedRealtimeNanos()-fix.getElapsedRealtimeNanos())/1000000;
            if(!FreshLocation.valid(fix.getLatitude(),fix.getLongitude(),fix.getAccuracy(),age))return;
            JSONObject body=new JSONObject().put("sessionId",session.getString("sessionId")).put("trackingSessionId",session.getString("trackingSessionId"))
                .put("latitude",fix.getLatitude()).put("longitude",fix.getLongitude()).put("accuracyM",fix.getAccuracy()).put("sampledAt",sampleTime(fix.getTime()));
            authorized(session,"/v1/locations/update",body);
            synchronized(LocationSession.class){JSONObject current=LocationSession.load(this);if(!active||current==null||!current.optString("trackingSessionId").equals(session.getString("trackingSessionId")))return;LocationSession.save(this,session);}
            uploadedAt=SystemClock.elapsedRealtime();failures=0;notice("Sharing fresh location with your office");
        }catch(ApiError error){if(error.code==401||error.code==403||error.code==409){notice("Sharing paused · reopen X OPS to check consent and workday");stopSelf();}else failed();}
        catch(Exception error){failed();}finally{pending.set(false);}});}catch(RejectedExecutionException ignored){pending.set(false);}
    }
    private void failed(){if(active){failures++;notice("Location sync disconnected · retrying");uploadedAt=SystemClock.elapsedRealtime()-10000+Math.min(60000,failures*5000);}}
    @Override public void onProviderDisabled(String provider){notice("Check Android Location Services");}
    @Override public void onProviderEnabled(String provider){}
    @Override public void onStatusChanged(String provider,int status,Bundle extras){}
    @Override public void onDestroy(){active=false;running=false;if(locations!=null)try{locations.removeUpdates(this);}catch(SecurityException ignored){}if(worker!=null)worker.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}


