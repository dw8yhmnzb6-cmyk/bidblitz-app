import Foundation

enum PersistenceBootstrap {
    private static var didPrepare = false

    static func prepareApplicationSupportDirectory() {
        guard !didPrepare else { return }
        didPrepare = true

        do {
            let appSupportURL = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )

            try FileManager.default.createDirectory(
                at: appSupportURL,
                withIntermediateDirectories: true,
                attributes: nil
            )
        } catch {
            NSLog("Persistence bootstrap failed: \(error.localizedDescription)")
        }
    }
}