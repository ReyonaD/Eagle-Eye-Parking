package expo.modules.parkzencore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.app.Activity
import android.content.Context
import android.Manifest
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class ParkzenCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript will use
    Name("ParkzenCore")

    // Defines standard boilerplate events
    Events("onChange")

    // The function we will call from React Native later
    Function("configure") { apiKey: String, clientId: String ->
        // We will add the ParkZen SDK initialization here later!
        "ParkZen Configured!"
    }

    Function("requestPermissions") {
      val activity = appContext.activityProvider?.currentActivity
      if (activity != null) {
        val requiredPermissions = arrayOf(
          Manifest.permission.ACCESS_FINE_LOCATION,
          Manifest.permission.ACCESS_COARSE_LOCATION
        )
        ActivityCompat.requestPermissions(activity, requiredPermissions, 1001)
        "Permissions requested"
      } else {
        "Activity not available"
      }
    }

    AsyncFunction("getParkedLocation") {
      // Placeholder for ParkZen SDK integration
      // Returns null since we're not actually querying the ParkZen SDK on Android yet
      null
    }

    Function("initializeParkZen") { clientId: String, username: String, password: String ->
      // Placeholder for ParkZen SDK authentication
      "ParkZen initialized with clientId: $clientId"
    }

    // Links to the View file
    View(ParkzenCoreView::class) {
      Prop("name") { view: ParkzenCoreView, prop: String ->
        // Standard view prop
      }
    }
  }
}