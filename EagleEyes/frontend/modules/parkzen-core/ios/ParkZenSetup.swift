import Foundation
import ParkZenCoreV2

/**
 * Configures ParkZenCore once per process. The SDK guide says to call
 * configure() in didFinishLaunchingWithOptions, which is what keeps parking
 * detection alive when iOS relaunches the app in the background. But configure
 * also shows ParkZen's notification prompt, so the very first time it waits
 * for the commuter's login (JS calls requestPermissions); after that the app
 * delegate subscriber configures it on every launch.
 */
enum ParkZenSetup {
  //set once a commuter has gone through ParkZen setup on this device
  private static let enabledKey = "parkzen_enabled"

  private static var configured = false

  static var isEnabled: Bool {
    UserDefaults.standard.bool(forKey: enabledKey)
  }

  /** Returns whether ParkZenCore is configured after this call. Main thread only. */
  @discardableResult
  static func configure() -> Bool {
    if configured { return true }

    //built in from frontend/.env by app.config.js
    let info = Bundle.main.infoDictionary ?? [:]
    let username = info["ParkZenUsername"] as? String ?? ""
    let password = info["ParkZenPassword"] as? String ?? ""
    let clientId = info["ParkZenClientId"] as? String
    if username.isEmpty || password.isEmpty {
      NSLog("[ParkzenCore] ParkZen username/password missing: set PARKZEN_USERNAME and PARKZEN_PASSWORD in frontend/.env and rebuild")
      return false
    }

    #if DEBUG
    //ParkZen asked us to report any 401/403 from the SDK; this logs them
    ParkZenV2.enableLogging(true)
    #endif
    ParkZenV2.configure(username: username, password: password, clientId: clientId?.isEmpty == false ? clientId : nil)
    ParkZenV2.registerLifecycleHandlers()
    //both are off by default on iOS (on by default on Android)
    ParkZenV2.enableLotOccupanyNotifications(true)
    ParkZenV2.enableCommuterVacateNotifications(true)

    configured = true
    UserDefaults.standard.set(true, forKey: enabledKey)
    NSLog("[ParkzenCore] ParkZenCore \(ParkZenV2.parkZenCoreVersion) configured")
    return true
  }

  static var isConfigured: Bool { configured }
}
