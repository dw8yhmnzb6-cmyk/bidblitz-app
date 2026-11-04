# Android health removal

Scope: prepare the existing BidBlitz Android app without Health Connect and without
the Move & Earn entry. This is a DEV change, not a published Play Console release.

## Changes
- Android plugin allowlists exclude @capgo/capacitor-health in both static and
  live-reload Capacitor configs. Other Android plugins remain enabled.
- All eleven health permissions shown in Play Console are explicitly removed by
  the application manifest, including permissions inherited from dependencies.
- The Android menu omits Move & Earn; direct /move and /move-earn navigation
  returns to the homepage.
- The native health bridge returns no plugin on Android, before importing it.
- The default Android release is versionCode 4 / versionName 1.0.1. The release
  operator must ensure that the selected code exceeds all previously used codes.

No account records, rewards, backend data, or Play Console entries were deleted.
Existing iOS and browser functionality is outside this Android change.

## Verification
Passed: 5/5 native health bridge regression tests covering Android, a missing
native flag, iOS, browser preview, and an absent Capacitor bridge.

The optimized frontend build completed with exit code 0. Capacitor sync android
completed successfully with eight non-health plugins. The generated Gradle plugin
files and native plugin registry contain no health plugin. Both Capacitor configs
and the source permission-removal directives were also checked.

Native verification on 2026-11-04: Gradle 8.11.1 :app:processDebugMainManifest
completed successfully (33 tasks). Its actual merged manifest has package
com.bidblitz.app, 21 remaining permissions and zero android.permission.health.*
permissions. Build outputs were isolated from the shared plugin sources.

Before uploading, build and sign the release Android App Bundle using the existing
upload key, then inspect the final bundle for all android.permission.health.*
entries. A successful debug manifest merge is not a signed release or a device
test. Confirm the Move & Earn menu and direct routes on an Android device.

## Release prerequisites
A JDK 17 and Android SDK 35 were found in the authorized DEV tools and used for
the manifest merge. Full Java compilation requires JDK 21. The worktree has no
original release signing configuration or signing environment variables. A signed
AAB and an Android device test are pending.
The project source has not been matched byte-for-byte to the uploaded version 3.

Use the static Capacitor configuration for release. Upload the corrected bundle
and replace any active test releases retaining the unwanted health permissions.
Complete Google's health declaration based on the actual final app; the form
itself also applies to apps with no health features.
