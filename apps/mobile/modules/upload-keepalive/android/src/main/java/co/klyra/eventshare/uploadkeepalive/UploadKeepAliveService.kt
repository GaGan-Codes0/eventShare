package co.klyra.eventshare.uploadkeepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** A low-key "Uploading" notification, which is what lets Android keep the app running asleep. */
class UploadKeepAliveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(CHANNEL, "Photo uploads", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        Notification.Builder(this, CHANNEL)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
      }
    val notification =
      builder
        .setSmallIcon(android.R.drawable.stat_sys_upload)
        .setContentTitle("eventShare")
        .setContentText("Uploading your photos")
        .setOngoing(true)
        .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    // Not restarted by the system: the app starts it again next time there's something to send.
    return START_NOT_STICKY
  }

  /** Android 15 caps this kind of service at a few hours a day. */
  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  private companion object {
    const val CHANNEL = "uploads"
    const val NOTIFICATION_ID = 7310
  }
}
