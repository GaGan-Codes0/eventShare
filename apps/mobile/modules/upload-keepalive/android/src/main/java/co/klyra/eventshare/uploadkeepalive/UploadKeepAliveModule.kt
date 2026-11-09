package co.klyra.eventshare.uploadkeepalive

import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UploadKeepAliveModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UploadKeepAlive")

    Function("start") { start() }
    Function("stop") { stop() }
  }

  private fun start() {
    val context = appContext.reactContext ?: return
    val intent = Intent(context, UploadKeepAliveService::class.java)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    } catch (e: Exception) {
      // Android refuses this from the background. Uploads still run, just not guaranteed asleep.
      Log.w("UploadKeepAlive", "Couldn't start: ${e.message}")
    }
  }

  private fun stop() {
    val context = appContext.reactContext ?: return
    context.stopService(Intent(context, UploadKeepAliveService::class.java))
  }
}
