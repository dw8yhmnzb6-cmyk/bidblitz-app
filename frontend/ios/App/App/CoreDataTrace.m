#import <Foundation/Foundation.h>
#import <CoreData/CoreData.h>
#import <objc/runtime.h>

#if DEBUG

@implementation NSPersistentStoreCoordinator (BidBlitzCoreDataTrace)

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class class = [self class];
        SEL originalSelector = @selector(addPersistentStoreWithType:configuration:URL:options:error:);
        SEL swizzledSelector = @selector(bb_trace_addPersistentStoreWithType:configuration:URL:options:error:);

        Method originalMethod = class_getInstanceMethod(class, originalSelector);
        Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);

        if (originalMethod && swizzledMethod) {
            method_exchangeImplementations(originalMethod, swizzledMethod);
            NSLog(@"[CoreDataTrace] NSPersistentStoreCoordinator swizzle active");
        } else {
            NSLog(@"[CoreDataTrace] Failed to install NSPersistentStoreCoordinator swizzle");
        }
    });
}

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
        NSLog(@"[CoreDataTrace] addPersistentStore called | type=%@ | configuration=%@ | url=%@ | options=%@", storeType, configuration, storeURL, options ?: @{});
        for (NSString *symbol in [NSThread callStackSymbols]) {
            NSLog(@"[CoreDataTrace] %@", symbol);
        }
    }

    return [self bb_trace_addPersistentStoreWithType:storeType configuration:configuration URL:storeURL options:options error:error];
}

@end

#endif