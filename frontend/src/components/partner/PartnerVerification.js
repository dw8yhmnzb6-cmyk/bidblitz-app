/**
 * Partner Verification Component
 * Handles document upload and verification status
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Shield, CheckCircle, Clock, AlertCircle, Upload, FileText, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerVerification = ({ token, t }) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentTypes] = useState([
    { id: 'business_registration', name: t('businessRegistration') || 'Gewerbeanmeldung' },
    { id: 'tax_certificate', name: t('taxCertificate') || 'Steuerbescheinigung' },
    { id: 'id_document', name: t('idDocument') || 'Personalausweis/Reisepass' },
    { id: 'bank_statement', name: t('bankStatement') || 'Kontoauszug' },
    { id: 'other', name: t('other') || 'Sonstiges' }
  ]);
  const [selectedDocType, setSelectedDocType] = useState('business_registration');

  useEffect(() => {
    fetchVerificationStatus();
  }, [token]);

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-portal/verification-status?token=${token}`);
      setVerificationStatus(response.data);
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Verification status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('error') || 'Datei zu groß (max. 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', selectedDocType);

    try {
      setUploading(true);
      const response = await axios.post(
        `${API}/api/partner-portal/upload-document?token=${token}`,
        formData
      );
      toast.success(response.data.message || t('success'));
      fetchVerificationStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = () => {
    if (verificationStatus?.is_verified) {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    } else if (verificationStatus?.overall_status === 'in_review') {
      return <Clock className="w-8 h-8 text-blue-500" />;
    } else if (verificationStatus?.overall_status === 'more_info') {
      return <AlertCircle className="w-8 h-8 text-amber-500" />;
    }
    return <AlertCircle className="w-8 h-8 text-gray-400" />;
  };

  const getStatusText = () => {
    if (verificationStatus?.is_verified) {
      return t('verified') || 'Verifiziert';
    } else if (verificationStatus?.overall_status === 'in_review') {
      return t('inReview') || 'In Prüfung';
    } else if (verificationStatus?.overall_status === 'more_info') {
      return t('moreInfoRequired') || 'Weitere Informationen erforderlich';
    }
    return t('notVerified') || 'Nicht verifiziert';
  };

  const getStatusColor = () => {
    if (verificationStatus?.is_verified) {
      return 'bg-green-50 border-green-200';
    } else if (verificationStatus?.overall_status === 'in_review') {
      return 'bg-blue-50 border-blue-200';
    } else if (verificationStatus?.overall_status === 'more_info') {
      return 'bg-amber-50 border-amber-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-verification">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Shield className="w-6 h-6 text-blue-500" />
        {t('verification') || 'Verifizierung'}
      </h2>
      
      {/* Verification Status */}
      <div className={`p-4 rounded-xl border ${getStatusColor()}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-bold text-gray-800">{getStatusText()}</p>
            <p className="text-sm text-gray-600">
              {verificationStatus?.is_verified 
                ? (t('verifiedDescription') || 'Ihr Konto ist vollständig verifiziert.')
                : verificationStatus?.overall_status === 'in_review'
                  ? (t('inReviewDescription') || 'Ihre Dokumente werden geprüft.')
                  : (t('notVerifiedDescription') || 'Bitte laden Sie die erforderlichen Dokumente hoch.')
              }
            </p>
          </div>
        </div>
      </div>
      
      {/* Document Upload */}
      {!verificationStatus?.is_verified && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            {t('uploadDocument') || 'Dokument hochladen'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('documentType') || 'Dokumententyp'}
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                data-testid="document-type-select"
              >
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <input
                type="file"
                id="document-upload"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleDocumentUpload}
                data-testid="document-upload-input"
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  disabled={uploading}
                  asChild
                >
                  <span className="flex items-center justify-center gap-2">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t('selectFile') || 'Datei auswählen'}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-400 mt-1 text-center">
                PDF, JPG, PNG - Max. 5MB
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Uploaded Documents */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          {t('uploadedDocuments') || 'Hochgeladene Dokumente'}
        </h3>
        
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div 
                key={doc.id || index} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {documentTypes.find(t => t.id === doc.type)?.name || doc.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {doc.uploaded_at 
                        ? new Date(doc.uploaded_at).toLocaleDateString('de-DE')
                        : '-'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    doc.status === 'approved' ? 'bg-green-100 text-green-600' :
                    doc.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {doc.status === 'approved' ? (t('approved') || 'Genehmigt') :
                     doc.status === 'rejected' ? (t('rejected') || 'Abgelehnt') :
                     (t('pending') || 'In Prüfung')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('noDocuments') || 'Noch keine Dokumente hochgeladen'}</p>
          </div>
        )}
      </div>
      
      {/* Verification Info */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">
          {t('verificationInfo') || 'Wichtige Hinweise'}
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• {t('verificationHint1') || 'Alle Dokumente müssen gut lesbar sein'}</li>
          <li>• {t('verificationHint2') || 'Die Prüfung dauert in der Regel 1-3 Werktage'}</li>
          <li>• {t('verificationHint3') || 'Bei Fragen kontaktieren Sie unseren Support'}</li>
        </ul>
      </div>
    </div>
  );
};

export default PartnerVerification;
