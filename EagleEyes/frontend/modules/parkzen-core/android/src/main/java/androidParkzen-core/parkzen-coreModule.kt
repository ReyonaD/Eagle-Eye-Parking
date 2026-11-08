package expo.modules.parkzencore

import androidx.activity.ComponentActivity
import com.parkzenlib.parkzencore.ParkZenCore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ParkzenCoreModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript will use
    Name("ParkzenCore")

    //the user may have just granted permissions (in the system dialogs or in
    //Settings), so retry setup every time the app comes back to the foreground
    OnActivityEntersForeground {
      appContext.reactContext?.let { ParkZenSetup.configureIfReady(it.applicationContext) }
    }

    //ParkZen's own helper: location, background location, activity
    //recognition, Bluetooth and (Android 13+) notification permission
    AsyncFunction("requestPermissions") {
      val activity = appContext.activityProvider?.currentActivity as? ComponentActivity
        ?: throw Exceptions.MissingActivity()
      ParkZenCore.requestPermissions(activity)
    }.runOnQueue(Queues.MAIN)

    //returns whether ParkZenCore is running, so JS can tell setup is incomplete
    AsyncFunction("configureIfReady") {
      ParkZenSetup.configureIfReady(context)
    }.runOnQueue(Queues.MAIN)

    //FAQ in the SDK guide: in testing mode, connecting to any Bluetooth device
    //simulates a vacate and disconnecting simulates a park
    Function("setTestingMode") { enabled: Boolean ->
      ParkZenCore.setTestingMode(enabled, context)
    }

    //not in the Android guide, but 1.0.4 has ParkZenCore#getLastParked(),
    //the Android counterpart of iOS's getParkedLoc()
    AsyncFunction("getParkedLocation") {
      if (!ParkZenSetup.configureIfReady(context)) return@AsyncFunction null
      val spot = ParkZenCore(context).lastParked ?: return@AsyncFunction null
      mapOf("latitude" to spot.latLng.latitude, "longitude" to spot.latLng.longitude)
    }

    // Links to the View file
    View(ParkzenCoreView::class) {
      Prop("name") { view: ParkzenCoreView, prop: String ->
        // Standard view prop
      }
    }
  }
}
