import EXNotifications
import ExpoModulesCore
import ParkZenCoreV2
import UserNotifications

/**
 * The AppDelegate half of the SDK guide. Expo owns the real AppDelegate, so
 * this hooks into it as a subscriber (registered in expo-module.config.json).
 */
public class ParkZenAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private let notificationForwarder = ParkZenNotificationForwarder()

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    //added here, at launch, so it's ahead of expo-notifications' own emitter
    //(added once JS starts): ParkZen's buttons run in the background, and the
    //answer has to reach ParkZen before the emitter calls completionHandler
    NotificationCenterManager.shared.addDelegate(notificationForwarder)
    if ParkZenSetup.isEnabled {
      ParkZenSetup.configure()
    }
    return true
  }

  public func applicationWillTerminate(_ application: UIApplication) {
    if ParkZenSetup.isConfigured {
      ParkZenV2.didTerminate()
    }
  }
}

/**
 * The guide's UNUserNotificationCenterDelegate, minus being the delegate:
 * expo-notifications already is (our alert pushes need it), so this joins its
 * NotificationCenterManager and forwards the answers to ParkZen's own
 * notifications. Without it occupancy answers are never recorded and the
 * commuter vacate prompt can only time out. Showing them while the app is open
 * is left to the JS handler in utils/pushNotifications.ts.
 */
final class ParkZenNotificationForwarder: NotificationDelegate {
  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    let content = response.notification.request.content
    var info = content.userInfo
    switch content.categoryIdentifier {
    case "LotOccupancyCategory":
      info["actionIdentifier"] = response.actionIdentifier
      NotificationCenter.default.post(name: Notification.Name("LotOccupancyFeedbackNotification"), object: nil, userInfo: info)
    case "CommuterUnparkCategory":
      if response.actionIdentifier == "YES_ACTION" {
        NotificationCenter.default.post(name: Notification.Name("ConfirmCommuterUnparkYesNotification"), object: nil)
      } else if response.actionIdentifier == "NO_ACTION" {
        NotificationCenter.default.post(name: Notification.Name("ConfirmCommuterUnparkNoNotification"), object: nil)
      }
    default:
      //not ParkZen's: expo-notifications hands it to JS
      return false
    }
    //NotificationCenterManager calls completionHandler itself
    return true
  }
}
