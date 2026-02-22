import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Camera, Upload, CheckCircle, XCircle, User, 
  CreditCard, ArrowLeft, Loader2, AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Übersetzungen
const translations = {
  de: {
    title: 'Identitätsverifizierung',
    subtitle: 'Bitte laden Sie Ihre Ausweisdokumente hoch',
    idFront: 'Ausweis Vorderseite',
    idBack: 'Ausweis Rückseite',
    selfie: 'Selfie mit Ausweis',
    uploadBtn: 'Foto hochladen',
    takePhoto: 'Foto aufnehmen',
    submit: 'Dokumente einreichen',
    pending: 'Dokumente werden geprüft',
    pendingDesc: 'Ihre Dokumente werden von unserem Team geprüft. Sie erhalten eine Benachrichtigung, sobald Ihr Konto freigeschaltet ist.',
    approved: 'Verifizierung abgeschlossen',
    rejected: 'Verifizierung abgelehnt',
    rejectedDesc: 'Grund:',
    reupload: 'Neue Dokumente hochladen',
    tips: 'Tipps für gute Fotos',
    tip1: 'Gute Beleuchtung verwenden',
    tip2: 'Alle Ecken des Ausweises sichtbar',
    tip3: 'Keine Reflexionen oder Schatten',
    tip4: 'Text muss lesbar sein',
    acceptedDocs: 'Akzeptierte Dokumente: Personalausweis, Reisepass, Führerschein',
    uploading: 'Wird hochgeladen...',
    success: 'Dokumente erfolgreich eingereicht',
    error: 'Fehler beim Hochladen',
    allRequired: 'Bitte laden Sie alle drei Dokumente hoch',
    backToLogin: 'Zurück zum Login'
  },
  en: {
    title: 'Identity Verification',
    subtitle: 'Please upload your ID documents',
    idFront: 'ID Front',
    idBack: 'ID Back',
    selfie: 'Selfie with ID',
    uploadBtn: 'Upload Photo',
    takePhoto: 'Take Photo',
    submit: 'Submit Documents',
    pending: 'Documents Under Review',
    pendingDesc: 'Your documents are being reviewed by our team. You will be notified once your account is verified.',
    approved: 'Verification Complete',
    rejected: 'Verification Rejected',
    rejectedDesc: 'Reason:',
    reupload: 'Upload New Documents',
    tips: 'Tips for Good Photos',
    tip1: 'Use good lighting',
    tip2: 'All corners of ID visible',
    tip3: 'No reflections or shadows',
    tip4: 'Text must be readable',
    acceptedDocs: 'Accepted documents: ID card, Passport, Driver\'s License',
    uploading: 'Uploading...',
    success: 'Documents submitted successfully',
    error: 'Upload error',
    allRequired: 'Please upload all three documents',
    backToLogin: 'Back to Login'
  }
};

export default function KYCVerification() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, token } = useAuth();
  const t = translations[language] || translations.de;
  
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [kycStatus, setKycStatus] = useState('loading'); // loading, upload, pending, approved, rejected
  const [rejectionReason, setRejectionReason] = useState('');
  
  const idFrontRef = useRef(null);
  const idBackRef = useRef(null);
  const selfieRef = useRef(null);

  // Check KYC status on mount
  useEffect(() => {
    const checkKycStatus = async () => {
      // If no token, redirect to login
      if (!token) {
        toast.error(language === 'de' 
          ? 'Bitte melden Sie sich an, um die Verifizierung fortzusetzen' 
          : 'Please log in to continue verification');
        navigate('/login');
        return;
      }
      
      try {
        const response = await axios.get(`${API}/auth/kyc/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const status = response.data.status;
        if (status === 'approved') {
          // Already approved, redirect to dashboard
          navigate('/dashboard');
          return;
        } else if (status === 'rejected') {
          setKycStatus('rejected');
          setRejectionReason(response.data.rejection_reason || '');
        } else if (status === 'pending' && response.data.id_front_uploaded) {
          // Documents submitted, waiting for review
          setKycStatus('pending');
        } else {
          setKycStatus('upload');
        }
      } catch (error) {
        console.error('KYC status check error:', error);
        setKycStatus('upload');
      }
    };
    
    checkKycStatus();
  }, [token, navigate]);

  // Handle resubmission after rejection
  const handleResubmit = async () => {
    try {
      await axios.post(`${API}/auth/kyc/resubmit`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setKycStatus('upload');
      setIdFront(null);
      setIdBack(null);
      setSelfie(null);
      setRejectionReason('');
      toast.success(t.reupload || 'Sie können jetzt neue Dokumente hochladen');
    } catch (error) {
      toast.error('Fehler beim Zurücksetzen');
    }
  };

  // Upload image to server
  const uploadImage = async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', type);
    
    try {
      const response = await axios.post(`${API}/auth/kyc/upload?document_type=${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data.url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleFileChange = async (e, type, setFunc) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFunc({
        file,
        preview: reader.result,
        uploaded: false
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!idFront || !idBack || !selfie) {
      toast.error(t.allRequired);
      return;
    }
    
    setUploading(true);
    
    try {
      // Upload all images
      const idFrontUrl = await uploadImage(idFront.file, 'id_front');
      const idBackUrl = await uploadImage(idBack.file, 'id_back');
      const selfieUrl = await uploadImage(selfie.file, 'selfie');
      
      // Submit KYC documents
      await axios.post(`${API}/auth/kyc/submit`, {
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success(t.success);
      setKycStatus('pending');
    } catch (error) {
      toast.error(t.error);
      console.error('KYC submission error:', error);
    } finally {
      setUploading(false);
    }
  };

  // Document upload component
  const DocumentUpload = ({ title, icon: Icon, value, setValue, inputRef }) => (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Icon className="w-5 h-5 text-amber-400" />
        </div>
        <span className="font-medium text-white">{title}</span>
        {value && <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />}
      </div>
      
      {value ? (
        <div className="relative">
          <img 
            src={value.preview} 
            alt={title}
            className="w-full h-40 object-cover rounded-lg"
          />
          <button
            onClick={() => setValue(null)}
            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, title, setValue)}
            className="hidden"
          />
          <Button
            onClick={() => inputRef.current?.click()}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t.uploadBtn}
          </Button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFileChange(e, title, setValue)}
            className="hidden"
            id={`camera-${title}`}
          />
          <label
            htmlFor={`camera-${title}`}
            className="flex items-center justify-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4 mr-2" />
            {t.takePhoto}
          </label>
        </div>
      )}
    </div>
  );

  // Pending status view
  if (kycStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">{t.pending}</h2>
          <p className="text-slate-400 mb-6">{t.pendingDesc}</p>
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="border-slate-600 text-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToLogin}
          </Button>
        </div>
      </div>
    );
  }

  // Rejected status view
  if (kycStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 rounded-2xl p-8 max-w-md w-full text-center border border-red-500/50">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">{t.rejected}</h2>
          <p className="text-red-400 mb-2">{t.rejectedDesc}</p>
          <p className="text-slate-400 mb-6">{rejectionReason}</p>
          <Button
            onClick={handleResubmit}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {t.reupload}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (kycStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-2">{t.subtitle}</p>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-blue-400">{t.tips}</span>
          </div>
          <ul className="text-sm text-slate-400 space-y-1 ml-7">
            <li>• {t.tip1}</li>
            <li>• {t.tip2}</li>
            <li>• {t.tip3}</li>
            <li>• {t.tip4}</li>
          </ul>
          <p className="text-xs text-slate-500 mt-3">{t.acceptedDocs}</p>
        </div>

        {/* Document Uploads */}
        <div className="space-y-4 mb-6">
          <DocumentUpload
            title={t.idFront}
            icon={CreditCard}
            value={idFront}
            setValue={setIdFront}
            inputRef={idFrontRef}
          />
          <DocumentUpload
            title={t.idBack}
            icon={CreditCard}
            value={idBack}
            setValue={setIdBack}
            inputRef={idBackRef}
          />
          <DocumentUpload
            title={t.selfie}
            icon={User}
            value={selfie}
            setValue={setSelfie}
            inputRef={selfieRef}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={uploading || !idFront || !idBack || !selfie}
          className="w-full py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t.uploading}
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              {t.submit}
            </>
          )}
        </Button>

        {/* Back to Login */}
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-4 py-3 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          {t.backToLogin}
        </button>
      </div>
    </div>
  );
}
