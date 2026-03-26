import ExpoModulesCore
import ParkZenCoreV2

public class ParkzenCoreModule: Module {
  public func definition() -> ModuleDefinition {
    // The name the JavaScript code will use to find this module
    Name("ParkzenCore")

    // 1. A function for frontend team to trigger the iOS permission popups
    Function("requestPermissions") {
      ParkZenV2.requestPermissions()
    }

    // 2. The function that asks ParkZen where the car is!
    AsyncFunction("getParkedLocation") { () -> [String: Double]? in
      if let loc = ParkZenV2.getParkedLoc() {
          return [
            "latitude": loc.latitude,
            "longitude": loc.longitude
          ]
      }
      return nil // Returns null if they haven't parked yet
    }
  }
}