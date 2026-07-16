#import <Foundation/Foundation.h>
#import <CoreData/CoreData.h>
#import <objc/runtime.h>
#import <sys/sysctl.h>
#include <unistd.h>

static BOOL BBTraceDebuggerAttached(void) {
    int mib[4];
    struct kinfo_proc info;
    size_t size = sizeof(info);
    memset(&info, 0, sizeof(info));

    mib[0] = CTL_KERN;
    mib[1] = KERN_PROC;
    mib[2] = KERN_PROC_PID;
    mib[3] = getpid();

    if (sysctl(mib, 4, &info, &size, NULL, 0) != 0) {
        return NO;
    }

    return ((info.kp_proc.p_flag & P_TRACED) != 0);
}

static BOOL BBTraceShouldActivate(void) {
    NSDictionary<NSString *, NSString *> *env = NSProcessInfo.processInfo.environment;
    if (env[@"OS_ACTIVITY_DT_MODE"] != nil) return YES;
    if (env[@"IDE_DISABLED_OS_ACTIVITY_DT_MODE"] != nil) return YES;
    if (env[@"__XCODE_BUILT_PRODUCTS_DIR_PATHS"] != nil) return YES;
    return BBTraceDebuggerAttached();
}

__attribute__((constructor))
static void BBTraceConstructor(void) {
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
        BBTraceLogStoreEvent(storeType, configuration, storeURL, options);
    }

    return [self bb_trace_addPersistentStoreWithType:storeType configuration:configuration URL:storeURL options:options error:error];
}

@end