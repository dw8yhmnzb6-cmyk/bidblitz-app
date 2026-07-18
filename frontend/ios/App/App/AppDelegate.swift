import UIKit
import Capacitor

private enum CoreDataLaunchPrep {
    static func ensure() {
        let fileManager = FileManager.default

        guard let applicationSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            NSLog("[CoreDataFix][ERROR] Application Support konnte beim App-Start nicht aufgelöst werden")
            return
        }

        ensureDirectory(at: applicationSupportURL, label: "Application Support")

        let defaultStoreURL = applicationSupportURL.appendingPathComponent("default.store", isDirectory: false)
        ensureDirectory(at: defaultStoreURL.deletingLastPathComponent(), label: "default.store parent")
        logState(applicationSupportURL: applicationSupportURL, defaultStoreURL: defaultStoreURL)
    }

    private static func ensureDirectory(at url: URL, label: String) {
        do {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            NSLog("[CoreDataFix][ENSURE] \(label) bereit unter \(url.path)")
        } catch {
            NSLog("[CoreDataFix][ERROR] \(label) konnte nicht erstellt werden: \(error.localizedDescription)")
        }
    }

    private static func logState(applicationSupportURL: URL, defaultStoreURL: URL) {
        let fileManager = FileManager.default
        var supportIsDirectory = ObjCBool(false)
        let supportExists = fileManager.fileExists(atPath: applicationSupportURL.path, isDirectory: &supportIsDirectory)
        let storeExists = fileManager.fileExists(atPath: defaultStoreURL.path)
        NSLog("[CoreDataFix][PATH] Application Support = \(applicationSupportURL.path)")
        NSLog("[CoreDataFix][PATH] default.store = \(defaultStoreURL.path)")
        NSLog("[CoreDataFix][STATE] support_exists=\(supportExists) support_is_directory=\(supportIsDirectory.boolValue) default_store_exists=\(storeExists)")
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        CoreDataLaunchPrep.ensure()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
