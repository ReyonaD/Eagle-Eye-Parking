import ExpoModulesCore
import ParkZenCoreV2

public class ParkzenCoreModule: Module {
  public func definition() -> ModuleDefinition {
    // The name the JavaScript code will use to find this module
    Name("ParkzenCore")

    //ParkZen's own helper (location & motion). The guide says to call it after
    //configure, which also asks for notification permission, so this is where
    //a commuter's first setup happens; later launches configure natively.
    AsyncFunction("requestPermissions") {
      if ParkZenSetup.configure() {
        ParkZenV2.requestPermissions()
      }
    }.runOnQueue(.main)

    //returns whether ParkZenCore is running, so JS can tell setup is incomplete
    AsyncFunction("configureIfReady") { () -> Bool in
      ParkZenSetup.isEnabled ? ParkZenSetup.configure() : false
    }.runOnQueue(.main)

    // The function that asks ParkZen where the car is!
    AsyncFunction("getParkedLocation") { () -> [String: Double]? in
      guard ParkZenSetup.isConfigured, let loc = ParkZenV2.getParkedLoc() else {
        return nil // Returns null if they haven't parked yet
      }
      return [
        "latitude": loc.latitude,
        "longitude": loc.longitude
      ]
    }.runOnQueue(.main)
  }
}
