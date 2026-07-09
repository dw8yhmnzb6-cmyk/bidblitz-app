import React, { useEffect, useState } from 'react';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, X } from 'lucide-react';

/**
 * InAppUpdateManager — Native App-Updates (Android)
 * Prüft automatisch auf Updates beim App-Start
 */
export default function InAppUpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updatesEnabled = process.env.REACT_APP_ENABLE_IN_APP_UPDATES === 'true';

  useEffect(() => {
    // Nur auf Native Plattformen
    if (!Capacitor.isNativePlatform() || !updatesEnabled) return;

    checkForUpdate();
  }, [updatesEnabled]);

  const checkForUpdate = async () => {
    try {
      const result = await AppUpdate.getAppUpdateInfo();
      console.log('Update Info:', result);
      
      // Android: immediateUpdateAllowed oder flexibleUpdateAllowed
      if (result.immediateUpdateAllowed || result.flexibleUpdateAllowed) {
        setUpdateAvailable(true);
        setUpdateInfo(result);
      }
    } catch (error) {
      console.warn('Update-Check fehlgeschlagen:', error);
    }
  };

  const performUpdate = async () => {
    if (!updateInfo) return;
    setLoading(true);

    try {
      if (updateInfo.immediateUpdateAllowed) {
        // Sofortiges Update (zwingt Neustart)
        await AppUpdate.performImmediateUpdate();
      } else if (updateInfo.flexibleUpdateAllowed) {
        // Flexibles Update (im Hintergrund)
        await AppUpdate.startFlexibleUpdate();
        
        // Listener für Flex-Update Status
        AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
          console.log('Flex Update State:', state);
          if (state.installStatus === 'DOWNLOADED') {
            // Update heruntergeladen, jetzt anwenden
            completeFlexibleUpdate();
          }
        });
      }
    } catch (error) {
      console.error('Update fehlgeschlagen:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeFlexibleUpdate = async () => {
    try {
      await AppUpdate.completeFlexibleUpdate();
    } catch (error) {
      console.error('Flex Update Complete fehlgeschlagen:', error);
    }
  };

  if (!updatesEnabled || !updateAvailable || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-[100] max-w-md mx-auto"
        data-testid="in-app-update-banner"
      >
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-500/30 backdrop-blur-xl rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Download size={20} className="text-blue-300" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm mb-1">
                Update verfügbar
              </h3>
              <p className="text-gray-300 text-xs mb-3">
                Eine neue Version von BidBlitz ist verfügbar. Jetzt aktualisieren für neue Features!
              </p>

              <div className="flex gap-2">
                <button
                  onClick={performUpdate}
                  disabled={loading}
                  className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                  data-testid="update-btn"
                >
                  {loading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Lädt...
                    </>
                  ) : (
                    <>
                      <Download size={12} />
                      Aktualisieren
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-2 bg-white/10 rounded-xl text-white/60 text-xs font-medium"
                  data-testid="update-dismiss"
                >
                  Später
                </button>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
              data-testid="update-close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
