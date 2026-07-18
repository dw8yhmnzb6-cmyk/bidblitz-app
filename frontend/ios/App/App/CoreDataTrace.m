#import <Foundation/Foundation.h>
#import <CoreData/CoreData.h>
#import <objc/runtime.h>

@interface NSPersistentStoreCoordinator (BidBlitzCoreDataTraceDeclaration)
- (NSPersistentStore *)bb_trace_addPersistentStoreWithType:(NSString *)storeType
                                            configuration:(NSString *)configuration
                                                      URL:(NSURL *)storeURL
                                                  options:(NSDictionary *)options
                                                    error:(NSError * _Nullable __autoreleasing *)error;
@end

static BOOL BBTraceShouldActivate(void) {
    return YES;
}

static void BBEnsureApplicationSupportDirectory(void) {
    NSError *directoryError = nil;
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSURL *applicationSupportURL = [fileManager URLForDirectory:NSApplicationSupportDirectory
                                                       inDomain:NSUserDomainMask
                                              appropriateForURL:nil
                                                         create:YES
                                                          error:&directoryError];

    if (applicationSupportURL == nil) {
        NSLog(@"[CoreDataFix][ERROR] Failed to resolve Application Support directory: %@", directoryError.localizedDescription ?: @"unknown error");
        return;
    }

    directoryError = nil;
    BOOL created = [fileManager createDirectoryAtURL:applicationSupportURL
                         withIntermediateDirectories:YES
                                          attributes:nil
                                               error:&directoryError];

    if (!created && directoryError != nil) {
        NSLog(@"[CoreDataFix][ERROR] Failed to create Application Support directory at %@: %@", applicationSupportURL.path ?: @"(nil)", directoryError.localizedDescription ?: @"unknown error");
        return;
    }

    if (BBTraceShouldActivate()) {
        NSLog(@"[CoreDataFix][ENSURE] Application Support ready at %@", applicationSupportURL.path ?: @"(nil)");
    }
}

static void BBEnsurePersistentStoreParentDirectory(NSURL *storeURL) {
    if (storeURL == nil || !storeURL.isFileURL) {
        return;
    }

    NSURL *parentURL = [storeURL URLByDeletingLastPathComponent];
    if (parentURL == nil) {
        return;
    }

    NSError *directoryError = nil;
    BOOL created = [[NSFileManager defaultManager] createDirectoryAtURL:parentURL
                                             withIntermediateDirectories:YES
                                                              attributes:nil
                                                                   error:&directoryError];

    if (!created && directoryError != nil) {
        NSLog(@"[CoreDataFix][ERROR] Failed to create store parent at %@: %@", parentURL.path ?: @"(nil)", directoryError.localizedDescription ?: @"unknown error");
        return;
    }

    if (BBTraceShouldActivate()) {
        NSLog(@"[CoreDataFix][ENSURE] Store parent ready at %@", parentURL.path ?: @"(nil)");
    }
}

__attribute__((constructor))
static void BBTraceConstructor(void) {
    BBEnsureApplicationSupportDirectory();
    if (!BBTraceShouldActivate()) {
        return;
    }
    NSLog(@"[CoreDataTrace][START] CoreDataTrace DEBUG constructor loaded");
    NSLog(@"[CoreDataTrace][END] CoreDataTrace DEBUG constructor ready");
}

static BOOL BBTraceIsRelevantSymbol(NSString *symbol) {
    if (symbol.length == 0) return NO;
    NSArray<NSString *> *includeKeywords = @[
        [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleExecutable"] ?: @"",
        @"Capacitor",
        @"capgo",
        @"capawesome",
        @"Health",
        @"Pods",
        @"Frameworks",
        @"App"
    ];
    for (NSString *keyword in includeKeywords) {
        if (keyword.length > 0 && [symbol localizedCaseInsensitiveContainsString:keyword]) {
            return YES;
        }
    }
    return NO;
}

static NSArray<NSString *> *BBTraceRelevantFrameworks(void) {
    NSMutableArray<NSString *> *matches = [NSMutableArray array];
    NSArray<NSBundle *> *bundles = [[NSBundle allFrameworks] arrayByAddingObjectsFromArray:[NSBundle allBundles]];
    NSArray<NSString *> *keywords = @[@"capacitor", @"capgo", @"capawesome", @"health", @"firebase", @"cloudkit", @"coredata"];

    for (NSBundle *bundle in bundles) {
        NSString *descriptor = [NSString stringWithFormat:@"%@ | %@ | %@",
                                bundle.bundleIdentifier ?: @"(no bundle id)",
                                bundle.bundlePath ?: @"(no path)",
                                bundle.executablePath ?: @"(no executable)"];
        for (NSString *keyword in keywords) {
            if ([descriptor localizedCaseInsensitiveContainsString:keyword]) {
                [matches addObject:descriptor];
                break;
            }
        }
    }
    return matches;
}

static void BBTraceInstallSwizzle(void) {
    if (!BBTraceShouldActivate()) {
        return;
    }
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class class = [NSPersistentStoreCoordinator class];
        SEL originalSelector = @selector(addPersistentStoreWithType:configuration:URL:options:error:);
        SEL swizzledSelector = @selector(bb_trace_addPersistentStoreWithType:configuration:URL:options:error:);

        Method originalMethod = class_getInstanceMethod(class, originalSelector);
        Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);

        if (originalMethod && swizzledMethod) {
            method_exchangeImplementations(originalMethod, swizzledMethod);
            NSLog(@"[CoreDataTrace][START] NSPersistentStoreCoordinator swizzle active (DEBUG only)");
            NSLog(@"[CoreDataTrace][END] Swizzle ready");
        } else {
            NSLog(@"[CoreDataTrace][START] Failed to install NSPersistentStoreCoordinator swizzle");
            NSLog(@"[CoreDataTrace][END] Swizzle missing");
        }
    });
}

static void BBTraceLogStoreEvent(NSString *storeType, NSString *configuration, NSURL *storeURL, NSDictionary *options) {
    NSLog(@"[CoreDataTrace][START]");
    NSLog(@"[CoreDataTrace][STORE_TYPE] %@", storeType ?: @"(nil)");
    NSLog(@"[CoreDataTrace][CONFIGURATION] %@", configuration ?: @"(nil)");
    NSLog(@"[CoreDataTrace][STORE_URL] %@", storeURL.absoluteString ?: @"(nil)");
    NSLog(@"[CoreDataTrace][OPTIONS] %@", options ?: @{});

    NSArray<NSString *> *frameworks = BBTraceRelevantFrameworks();
    if (frameworks.count == 0) {
        NSLog(@"[CoreDataTrace][FRAMEWORK] No relevant non-system frameworks matched filter");
    } else {
        for (NSString *framework in frameworks) {
            NSLog(@"[CoreDataTrace][FRAMEWORK] %@", framework);
        }
    }

    NSArray<NSString *> *symbols = [NSThread callStackSymbols];
    NSMutableArray<NSString *> *relevant = [NSMutableArray array];
    for (NSString *symbol in symbols) {
        if (BBTraceIsRelevantSymbol(symbol)) {
            [relevant addObject:symbol];
        }
    }

    if (relevant.count == 0) {
        NSLog(@"[CoreDataTrace][CALLER] No filtered caller lines matched. Raw stack follows.");
        for (NSString *symbol in symbols) {
            NSLog(@"[CoreDataTrace][CALLER_RAW] %@", symbol);
        }
    } else {
        for (NSString *symbol in relevant) {
            NSLog(@"[CoreDataTrace][CALLER] %@", symbol);
        }
    }

    NSLog(@"[CoreDataTrace][END]");
}

@interface BBTraceProbe : NSObject
@end

@implementation BBTraceProbe

+ (void)load {
    if (!BBTraceShouldActivate()) {
        return;
    }
    NSLog(@"[CoreDataTrace][START] BBTraceProbe +load invoked");
    BBTraceInstallSwizzle();
    NSLog(@"[CoreDataTrace][END] BBTraceProbe +load finished");
}

@end

@implementation NSPersistentStoreCoordinator (BidBlitzCoreDataTrace)

- (NSPersistentStore *)bb_trace_addPersistentStoreWithType:(NSString *)storeType
                                            configuration:(NSString *)configuration
                                                      URL:(NSURL *)storeURL
                                                  options:(NSDictionary *)options
                                                    error:(NSError * _Nullable __autoreleasing *)error {
    NSString *lastPath = storeURL.lastPathComponent ?: @"";
    BOOL isDefaultStore = [lastPath isEqualToString:@"default.store"];
    BOOL hasHistoryKey = NO;
    BOOL hasRemoteChangeKey = NO;

    for (id key in options.allKeys) {
        NSString *keyString = [key description] ?: @"";
        if ([keyString containsString:@"NSPersistentHistoryTrackingKey"]) {
            hasHistoryKey = YES;
        }
        if ([keyString containsString:@"NSPersistentStoreRemoteChangeNotification"]) {
            hasRemoteChangeKey = YES;
        }
    }

    if (isDefaultStore || hasHistoryKey || hasRemoteChangeKey) {
        BBEnsurePersistentStoreParentDirectory(storeURL);
        BBTraceLogStoreEvent(storeType, configuration, storeURL, options);
    }

    return [self bb_trace_addPersistentStoreWithType:storeType configuration:configuration URL:storeURL options:options error:error];
}

@end