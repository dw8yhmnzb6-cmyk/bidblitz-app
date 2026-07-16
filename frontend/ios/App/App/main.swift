import Foundation
import UIKit

PersistenceBootstrap.prepareApplicationSupportDirectory()

_ = UIApplicationMain(
    CommandLine.argc,
    CommandLine.unsafeArgv,
    nil,
    NSStringFromClass(AppDelegate.self)
)