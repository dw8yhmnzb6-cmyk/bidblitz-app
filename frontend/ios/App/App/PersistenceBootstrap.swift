import Foundation

enum PersistenceBootstrap {
    private static var didPrepare = false
    private(set) static var storeURL: URL?

    static func prepareApplicationSupportDirectory() {
        guard !didPrepare else { return }
        didPrepare = true

        do {
            let applicationSupportURL = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )

            let storeURL = applicationSupportURL
                .appendingPathComponent("default.store")

            try FileManager.default.createDirectory(
                at: applicationSupportURL,
                withIntermediateDirectories: true,
                attributes: nil
            )

            if !FileManager.default.fileExists(atPath: storeURL.path) {
                FileManager.default.createFile(atPath: storeURL.path, contents: Data(), attributes: nil)
            }

            self.storeURL = storeURL
        } catch {
            NSLog("Persistence bootstrap failed: \(error.localizedDescription)")
        }
    }
}