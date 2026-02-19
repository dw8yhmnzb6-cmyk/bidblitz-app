/**
 * Partner Scanner Component
 * QR Code scanner for voucher redemption
 */
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Scan, Camera, X, Check, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Html5Qrcode } from 'html5-qrcode';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerScanner = ({ token, fetchDashboard, t }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const scannerRef = useRef(null);

  // Start QR Scanner
  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setScanning(true);
      setScanResult(null);
      
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          validateVoucher(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      toast.error(t('cameraAccessError') || 'Camera could not be started');
      setScanning(false);
    }
  };

  // Stop Scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {}
    }
    setScanning(false);
  };

  // Validate voucher code
  const validateVoucher = async (code) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/voucher/validate`, {
        code: code,
        partner_token: token
      });
      
      setScanResult({
        valid: true,
        code: code,
        value: response.data.value,
        name: response.data.voucher_name,
        voucher_id: response.data.voucher_id
      });
    } catch (err) {
      setScanResult({
        valid: false,
        code: code,
        error: err.response?.data?.detail || t('invalidVoucher') || 'Invalid voucher'
      });
    } finally {
      setLoading(false);
    }
  };

  // Manual code validation
  const handleManualValidate = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateVoucher(manualCode.trim());
      setManualCode('');
    }
  };

  // Redeem voucher
  const handleRedeem = async () => {
    if (!scanResult?.valid) return;
    
    setRedeeming(true);
    try {
      await axios.post(`${API}/api/voucher/redeem`, {
        code: scanResult.code,
        partner_token: token
      });
      
      toast.success(t('voucherRedeemed') || `Voucher redeemed: €${scanResult.value}`);
      setScanResult(null);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('redeemError') || 'Error redeeming voucher');
    } finally {
      setRedeeming(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Scan className="w-5 h-5 text-amber-500" />
          {t('scanVoucher') || 'Gutschein scannen'}
        </h2>
        
        {/* QR Scanner */}
        <div id="qr-reader" className={`w-full max-w-sm mx-auto rounded-xl overflow-hidden ${scanning ? '' : 'hidden'}`} />
        
        {!scanning && !scanResult && (
          <div className="text-center py-8">
            <Button onClick={startScanner} className="bg-amber-500 hover:bg-amber-600">
              <Camera className="w-5 h-5 mr-2" />
              {t('startCamera') || 'Kamera starten'}
            </Button>
          </div>
        )}
        
        {scanning && (
          <div className="text-center mt-4">
            <Button onClick={stopScanner} variant="outline">
              <X className="w-4 h-4 mr-2" />
              {t('cancel') || 'Abbrechen'}
            </Button>
          </div>
        )}
        
        {/* Manual Input */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-500 mb-3">{t('manualEntry')}:</p>
          <form onSubmit={handleManualValidate} className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="BLZ-XXXXXXXX"
              className="flex-1 uppercase"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('validate') || 'Prüfen')}
            </Button>
          </form>
        </div>
        
        {/* Scan Result */}
        {scanResult && (
          <div className={`mt-6 p-4 rounded-xl ${scanResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {scanResult.valid ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <span className="font-bold text-green-700">{t('validVoucher') || 'Gültiger Gutschein'}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">Code:</span> {scanResult.code}</p>
                  <p><span className="text-gray-500">{t('value') || 'Wert'}:</span> <span className="font-bold text-2xl text-green-600">€{scanResult.value}</span></p>
                  {scanResult.name && <p><span className="text-gray-500">{t('name') || 'Name'}:</span> {scanResult.name}</p>}
                </div>
                <Button 
                  onClick={handleRedeem}
                  disabled={redeeming}
                  className="w-full mt-4 bg-green-500 hover:bg-green-600"
                >
                  {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t('redeemNow') || 'Jetzt einlösen'}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <span className="font-bold text-red-700">{scanResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerScanner;
