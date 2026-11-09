import ExpoModulesCore
import UIKit

/// iPhone gives an app about 30 seconds after it leaves the screen. That's enough for the app to
/// hand every waiting file to the system, which carries on uploading them while the app sleeps.
public class UploadKeepAliveModule: Module {
  private var wanted = false
  private var task: UIBackgroundTaskIdentifier = .invalid

  private func end() {
    guard task != .invalid else { return }
    UIApplication.shared.endBackgroundTask(task)
    task = .invalid
  }

  public func definition() -> ModuleDefinition {
    Name("UploadKeepAlive")

    Function("start") { self.wanted = true }
    Function("stop") {
      self.wanted = false
      DispatchQueue.main.async { self.end() }
    }

    OnAppEntersBackground {
      DispatchQueue.main.async {
        guard self.wanted, self.task == .invalid else { return }
        self.task = UIApplication.shared.beginBackgroundTask(withName: "eventShare uploads") { self.end() }
      }
    }
    OnAppEntersForeground {
      DispatchQueue.main.async { self.end() }
    }
  }
}
