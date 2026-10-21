package expo.modules.parkzencore

import android.app.Application
import android.content.Context
import android.util.Log
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

//picked up by Expo autolinking (file name ends in Package.kt), which runs this
//from MainApplication.onCreate - including when Android starts the app in the
//background for a parking event, before any JS has loaded
class ParkzenCorePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        try {
          ParkZenSetup.configureIfReady(application)
        } catch (e: Exception) {
          //never take the whole app down at launch over parking detection
          Log.e("ParkzenCore", "ParkZenCore configure failed", e)
        }
      }
    })
}
