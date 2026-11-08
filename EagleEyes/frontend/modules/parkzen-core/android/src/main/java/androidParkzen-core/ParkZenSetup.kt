package expo.modules.parkzencore

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.parkzenlib.parkzencore.ParkZenCore
import com.parkzenlib.parkzencore.ParkZenCoreMain
import com.parkzenlib.parkzencore.configuration.ConfigurationFailure
import com.parkzenlib.parkzencore.configuration.ConfigurationHandler

/**
 * Configures ParkZenCore once per process, and only when it can actually run:
 * the SDK guide says to call configure() after the required permissions are
 * granted, as early as possible (Application/MainActivity onCreate).
 */
object ParkZenSetup {
  private const val TAG = "ParkzenCore"

  @Volatile
  private var configured = false

  /** Returns whether ParkZenCore is configured after this call. */
  @Synchronized
  fun configureIfReady(context: Context): Boolean {
    if (configured) return true
    if (!hasRequiredPermissions(context)) return false

    //built in from frontend/.env by app.config.js
    val apiKey = readString(context, "parkzen_api_key")
    val clientId = readString(context, "parkzen_client_id")
    val username = readString(context, "parkzen_username")
    val password = readString(context, "parkzen_password")
    if (apiKey.isNullOrBlank() || clientId.isNullOrBlank() || username.isNullOrBlank() || password.isNullOrBlank()) {
      Log.w(TAG, "ParkZen credentials missing: set PARKZEN_ANDROID_API_KEY, PARKZEN_CLIENT_ID, PARKZEN_USERNAME and PARKZEN_PASSWORD in frontend/.env and rebuild")
      return false
    }

    val appContext = context.applicationContext
    ParkZenCore.configure(apiKey, clientId, appContext)
    //missing from the guide (per ParkZen): without these the SDK can't fetch
    //lots or upload parking events, so no lot notifications ever appear
    ParkZenCoreMain.setBaseUrl(
      "https://us-central1-parkzen-33bc1.cloudfunctions.net",
      "https://api.parkzenapp.com",
      appContext
    )
    ParkZenCoreMain.setServiceAccountCredentials(appContext, username, password)
    configured = true
    Log.i(TAG, "ParkZenCore configured")
    logConfigurationCheck(context.applicationContext)
    return true
  }

  //not in the SDK guide: asks ParkZen whether the API key/client ID are valid
  //and every permission it needs is granted. Logged under the ParkzenCore tag.
  private fun logConfigurationCheck(context: Context) {
    ParkZenCore.checkConfiguration(context, object : ConfigurationHandler {
      override fun onSuccess() {
        Log.i(TAG, "ParkZen configuration check passed")
      }

      override fun onFail(failure: ConfigurationFailure) {
        Log.e(TAG, "ParkZen configuration check failed: ${failure.configurationFailReason}" +
          " (missing permissions: ${failure.failedPermissions})")
      }
    })
  }

  //parking detection needs "Allow all the time" location, not just while-in-use
  private fun hasRequiredPermissions(context: Context): Boolean {
    fun granted(permission: String) =
      ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) return false
    return true
  }

  private fun readString(context: Context, name: String): String? {
    val id = context.resources.getIdentifier(name, "string", context.packageName)
    return if (id == 0) null else context.getString(id)
  }
}
