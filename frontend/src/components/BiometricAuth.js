/**
 * Biometric Authentication Component
 * Uses WebAuthn API for fingerprint and face recognition
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Fingerprint, Scan, Shield, Smartphone, Trash2, 
  Loader2, CheckCircle, AlertCircle, Lock, Eye
} from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

// Check if WebAuthn is supported
const isWebAuthnSupported = () => {
  return window.PublicKeyCredential !== undefined;
};

// Check if biometric authentication is available
const isBiometricAvailable = async () => {
  if (!isWebAuthnSupported()) return false;
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

// ==================== BIOMETRIC REGISTRATION ====================

export const BiometricSetup = ({ user, token, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [checkingSupport, setCheckingSupport] = useState(true);

  useEffect(() => {
    checkSupport();
    fetchCredentials();
  }, []);

  const checkSupport = async () => {
    setCheckingSupport(true);
    const available = await isBiometricAvailable();
    setSupported(available);
    setCheckingSupport(false);
  };

  const fetchCredentials = async () => {
    try {
      const response = await axios.get(`${API}/api/security/biometric-credentials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredentials(response.data.credentials || []);
    } catch (err) {
      console.error('Credentials fetch error:', err);
    }
  };

  const registerBiometric = async () => {
    if (!supported) {
      toast.error('Biometrische Authentifizierung wird nicht unterstützt');
      return;
    }

    setLoading(true);
    
    try {
      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      
      // Create credential options
      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: "BidBlitz",
          id: window.location.hostname
        },
        user: {
          id: Uint8Array.from(user.id, c => c.charCodeAt(0)),
          name: user.email,
          displayName: user.name || user.email
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      };

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (!credential) {
        throw new Error('Credential creation failed');
      }

      // Determine auth type
      const authType = detectAuthType();
      
      // Get device name
      const deviceName = getDeviceName();

      // Send to backend
      const response = await axios.post(
        `${API}/api/security/register-biometric`,
        {
          credential_id: arrayBufferToBase64(credential.rawId),
          public_key: arrayBufferToBase64(credential.response.getPublicKey()),
          device_name: deviceName,
          auth_type: authType
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || 'Biometrische Authentifizierung aktiviert!');
      fetchCredentials();
      onSuccess?.();
      
    } catch (err) {
      console.error('Biometric registration error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Authentifizierung wurde abgebrochen');
      } else if (err.name === 'SecurityError') {
        toast.error('Sicherheitsfehler - bitte HTTPS verwenden');
      } else {
        toast.error('Fehler bei der Registrierung');
      }
    } finally {
      setLoading(false);
    }
  };

  const removeCredential = async (credentialId) => {
    try {
      await axios.delete(
        `${API}/api/security/biometric-credentials/${credentialId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Biometrische Authentifizierung entfernt');
      fetchCredentials();
    } catch (err) {
      toast.error('Fehler beim Entfernen');
    }
  };

  if (checkingSupport) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="biometric-setup">
      {/* Status Card */}
      <div className={`p-4 rounded-xl border ${
        supported 
          ? 'bg-green-50 border-green-200' 
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          {supported ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-500" />
          )}
          <div>
            <p className="font-medium text-gray-800">
              {supported 
                ? 'Biometrische Authentifizierung verfügbar' 
                : 'Nicht unterstützt auf diesem Gerät'}
            </p>
            <p className="text-sm text-gray-600">
              {supported 
                ? 'Fingerabdruck oder Gesichtserkennung möglich' 
                : 'Verwenden Sie ein Gerät mit Touch ID, Face ID oder Windows Hello'}
            </p>
          </div>
        </div>
      </div>

      {/* Register Button */}
      {supported && (
        <Button
          onClick={registerBiometric}
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          data-testid="register-biometric-btn"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Fingerprint className="w-5 h-5 mr-2" />
          )}
          Biometrische Authentifizierung einrichten
        </Button>
      )}

      {/* Registered Credentials */}
      {credentials.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-medium text-gray-800">Registrierte Geräte</h3>
          </div>
          <div className="divide-y">
            {credentials.map((cred) => (
              <div key={cred.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {cred.auth_type === 'fingerprint' ? (
                    <Fingerprint className="w-5 h-5 text-amber-500" />
                  ) : cred.auth_type === 'face' ? (
                    <Scan className="w-5 h-5 text-blue-500" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{cred.device_name}</p>
                    <p className="text-xs text-gray-500">
                      {cred.auth_type === 'fingerprint' ? 'Fingerabdruck' :
                       cred.auth_type === 'face' ? 'Gesichtserkennung' : 'Passkey'}
                      {cred.last_used && ` • Zuletzt: ${new Date(cred.last_used).toLocaleDateString('de-DE')}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCredential(cred.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== BIOMETRIC VERIFICATION ====================

export const BiometricVerification = ({ user, token, onSuccess, onCancel, amount }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const verify = async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Get credentials
      const publicKeyCredentialRequestOptions = {
        challenge: challenge,
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000
      };

      // Request authentication
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      if (!assertion) {
        throw new Error('Authentication failed');
      }

      // Verify with backend
      const response = await axios.post(
        `${API}/api/security/verify-biometric`,
        {
          credential_id: arrayBufferToBase64(assertion.rawId),
          signature: arrayBufferToBase64(assertion.response.signature),
          challenge: arrayBufferToBase64(challenge)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.verified) {
        toast.success('Authentifizierung erfolgreich!');
        onSuccess?.();
      } else {
        throw new Error('Verification failed');
      }

    } catch (err) {
      console.error('Biometric verification error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Authentifizierung wurde abgebrochen');
      } else {
        setError('Authentifizierung fehlgeschlagen');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Fingerprint className="w-10 h-10 text-amber-500" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Biometrische Bestätigung
        </h2>
        
        {amount && (
          <p className="text-gray-600 mb-4">
            Bestätige die Transaktion über <span className="font-bold text-amber-600">€{amount.toFixed(2)}</span>
          </p>
        )}
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          <Button
            onClick={verify}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Fingerprint className="w-5 h-5 mr-2" />
                Jetzt authentifizieren
              </>
            )}
          </Button>
          
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full"
            >
              Abbrechen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== SECURITY SETTINGS ====================

export const SecuritySettings = ({ user, token }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/security/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (err) {
      console.error('Settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      await axios.put(
        `${API}/api/security/settings`,
        { [key]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSettings({ ...settings, [key]: value });
      toast.success('Einstellung gespeichert');
    } catch (err) {
      toast.error('Fehler beim Speichern');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="security-settings">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <Shield className="w-6 h-6 text-amber-500" />
        Sicherheitseinstellungen
      </h2>

      {/* Biometric Setup */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-amber-500" />
          Biometrische Authentifizierung
        </h3>
        <BiometricSetup user={user} token={token} onSuccess={fetchSettings} />
      </div>

      {/* Security Options */}
      <div className="bg-white rounded-xl border divide-y">
        {/* Transaction Notifications */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Transaktions-Benachrichtigungen</p>
            <p className="text-sm text-gray-500">E-Mail bei jeder Transaktion</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.transaction_notifications || false}
              onChange={(e) => updateSetting('transaction_notifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Login Notifications */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Login-Benachrichtigungen</p>
            <p className="text-sm text-gray-500">E-Mail bei neuem Login</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.login_notifications || false}
              onChange={(e) => updateSetting('login_notifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Require Biometric for Transactions */}
        {settings?.biometric_credentials_count > 0 && (
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Biometrie für Transaktionen</p>
              <p className="text-sm text-gray-500">Fingerabdruck/Face ID für jede Zahlung</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.require_biometric_for_transactions || false}
                onChange={(e) => updateSetting('require_biometric_for_transactions', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        )}
      </div>

      {/* Encryption Info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">Verschlüsselte Datenübertragung</p>
            <p className="text-sm text-green-700">
              Alle Daten werden mit TLS 1.3 verschlüsselt übertragen. 
              Sensible Informationen werden zusätzlich verschlüsselt gespeichert.
            </p>
          </div>
        </div>
      </div>

      {/* Fraud Detection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Echtzeit-Betrugserkennung</p>
            <p className="text-sm text-blue-700">
              Alle Transaktionen werden automatisch auf verdächtige Aktivitäten geprüft.
              Bei Auffälligkeiten werden Sie sofort benachrichtigt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== HELPER FUNCTIONS ====================

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function detectAuthType() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('mac')) {
    return ua.includes('iphone') ? 'face' : 'fingerprint'; // Face ID on newer iPhones
  }
  if (ua.includes('android')) {
    return 'fingerprint';
  }
  if (ua.includes('windows')) {
    return 'passkey'; // Windows Hello
  }
  return 'passkey';
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) {
    const match = ua.match(/\(([^)]+)\)/);
    if (match) return match[1].split(';')[0].trim();
    return 'Android Gerät';
  }
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'Unbekanntes Gerät';
}

export default {
  BiometricSetup,
  BiometricVerification,
  SecuritySettings,
  isWebAuthnSupported,
  isBiometricAvailable
};
