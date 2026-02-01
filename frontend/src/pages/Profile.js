import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import TelegramConnect from '../components/TelegramConnect';
import { 
  User, Mail, Lock, Save, ArrowLeft, Camera, Shield, 
  Zap, Trophy, Calendar, Loader2, CheckCircle, Trash2, Upload
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Profile page translations
const profileTexts = {
  de: {
    title: "Profil bearbeiten",
    personalInfo: "Persönliche Daten",
    name: "Name",
    email: "E-Mail",
    changePhoto: "Foto ändern",
    removePhoto: "Entfernen",
    security: "Sicherheit",
    changePassword: "Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    confirmPassword: "Passwort bestätigen",
    updatePassword: "Passwort aktualisieren",
    twoFactor: "Zwei-Faktor-Authentifizierung",
    enable2FA: "2FA aktivieren",
    disable2FA: "2FA deaktivieren",
    stats: "Ihre Statistiken",
    memberSince: "Mitglied seit",
    bidsPlaced: "Gebote platziert",
    auctionsWon: "Auktionen gewonnen",
    saveChanges: "Änderungen speichern",
    saving: "Wird gespeichert...",
    saved: "Gespeichert!",
    back: "Zurück",
    fileTooLarge: "Die Datei ist zu groß. Maximal 2MB erlaubt.",
    invalidFileType: "Nur JPEG, PNG, WebP oder GIF Bilder erlaubt.",
    photoUploaded: "Profilbild erfolgreich hochgeladen!",
    photoRemoved: "Profilbild entfernt",
    passwordMismatch: "Passwörter stimmen nicht überein",
    passwordChanged: "Passwort erfolgreich geändert!",
    profileUpdated: "Profil aktualisiert!"
  },
  en: {
    title: "Edit Profile",
    personalInfo: "Personal Information",
    name: "Name",
    email: "Email",
    changePhoto: "Change Photo",
    removePhoto: "Remove",
    security: "Security",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    updatePassword: "Update Password",
    twoFactor: "Two-Factor Authentication",
    enable2FA: "Enable 2FA",
    disable2FA: "Disable 2FA",
    stats: "Your Statistics",
    memberSince: "Member since",
    bidsPlaced: "Bids placed",
    auctionsWon: "Auctions won",
    saveChanges: "Save Changes",
    saving: "Saving...",
    saved: "Saved!",
    back: "Back",
    fileTooLarge: "File is too large. Maximum 2MB allowed.",
    invalidFileType: "Only JPEG, PNG, WebP or GIF images allowed.",
    photoUploaded: "Profile photo uploaded successfully!",
    photoRemoved: "Profile photo removed",
    passwordMismatch: "Passwords do not match",
    passwordChanged: "Password changed successfully!",
    profileUpdated: "Profile updated!"
  },
  sq: {
    title: "Ndrysho Profilin",
    personalInfo: "Informacione Personale",
    name: "Emri",
    email: "Email",
    changePhoto: "Ndrysho Foton",
    removePhoto: "Hiq",
    security: "Siguria",
    changePassword: "Ndrysho Fjalëkalimin",
    currentPassword: "Fjalëkalimi Aktual",
    newPassword: "Fjalëkalimi i Ri",
    confirmPassword: "Konfirmo Fjalëkalimin",
    updatePassword: "Përditëso Fjalëkalimin",
    twoFactor: "Autentifikimi me Dy Faktorë",
    enable2FA: "Aktivizo 2FA",
    disable2FA: "Çaktivizo 2FA",
    stats: "Statistikat Tuaja",
    memberSince: "Anëtar që nga",
    bidsPlaced: "Oferta të vendosura",
    auctionsWon: "Ankande të fituara",
    saveChanges: "Ruaj Ndryshimet",
    saving: "Duke ruajtur...",
    saved: "U ruajt!",
    back: "Prapa",
    fileTooLarge: "Skedari është shumë i madh. Maksimumi 2MB.",
    invalidFileType: "Vetëm imazhe JPEG, PNG, WebP ose GIF.",
    photoUploaded: "Fotoja e profilit u ngarkua me sukses!",
    photoRemoved: "Fotoja e profilit u hoq",
    passwordMismatch: "Fjalëkalimet nuk përputhen",
    passwordChanged: "Fjalëkalimi u ndryshua me sukses!",
    profileUpdated: "Profili u përditësua!"
  },
  tr: {
    title: "Profili Düzenle",
    personalInfo: "Kişisel Bilgiler",
    name: "İsim",
    email: "E-posta",
    changePhoto: "Fotoğrafı Değiştir",
    removePhoto: "Kaldır",
    security: "Güvenlik",
    changePassword: "Şifre Değiştir",
    currentPassword: "Mevcut Şifre",
    newPassword: "Yeni Şifre",
    confirmPassword: "Şifreyi Onayla",
    updatePassword: "Şifreyi Güncelle",
    twoFactor: "İki Faktörlü Doğrulama",
    enable2FA: "2FA Etkinleştir",
    disable2FA: "2FA Devre Dışı Bırak",
    stats: "İstatistikleriniz",
    memberSince: "Üyelik tarihi",
    bidsPlaced: "Verilen teklifler",
    auctionsWon: "Kazanılan açık artırmalar",
    saveChanges: "Değişiklikleri Kaydet",
    saving: "Kaydediliyor...",
    saved: "Kaydedildi!",
    back: "Geri",
    fileTooLarge: "Dosya çok büyük. Maksimum 2MB.",
    invalidFileType: "Sadece JPEG, PNG, WebP veya GIF resimler.",
    photoUploaded: "Profil fotoğrafı başarıyla yüklendi!",
    photoRemoved: "Profil fotoğrafı kaldırıldı",
    passwordMismatch: "Şifreler uyuşmuyor",
    passwordChanged: "Şifre başarıyla değiştirildi!",
    profileUpdated: "Profil güncellendi!"
  },
  fr: {
    title: "Modifier le Profil",
    personalInfo: "Informations Personnelles",
    name: "Nom",
    email: "Email",
    changePhoto: "Changer la Photo",
    removePhoto: "Supprimer",
    security: "Sécurité",
    changePassword: "Changer le Mot de Passe",
    currentPassword: "Mot de Passe Actuel",
    newPassword: "Nouveau Mot de Passe",
    confirmPassword: "Confirmer le Mot de Passe",
    updatePassword: "Mettre à Jour le Mot de Passe",
    twoFactor: "Authentification à Deux Facteurs",
    enable2FA: "Activer 2FA",
    disable2FA: "Désactiver 2FA",
    stats: "Vos Statistiques",
    memberSince: "Membre depuis",
    bidsPlaced: "Enchères placées",
    auctionsWon: "Enchères gagnées",
    saveChanges: "Enregistrer les Modifications",
    saving: "Enregistrement...",
    saved: "Enregistré!",
    back: "Retour",
    fileTooLarge: "Fichier trop volumineux. Maximum 2Mo.",
    invalidFileType: "Seules les images JPEG, PNG, WebP ou GIF sont autorisées.",
    photoUploaded: "Photo de profil téléchargée avec succès!",
    photoRemoved: "Photo de profil supprimée",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    passwordChanged: "Mot de passe changé avec succès!",
    profileUpdated: "Profil mis à jour!"
  }
};

export default function Profile() {
  const { user, token, updateUser, refreshUser } = useAuth();
  const { language } = useLanguage();
  const texts = profileTexts[language] || profileTexts.de;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(texts.fileTooLarge);
      return;
    }

    // Check file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error(texts.invalidFileType);
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/user/avatar`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setAvatarUrl(response.data.avatar_url);
      toast.success(texts.photoUploaded);
      
      // Refresh user data to update avatar everywhere
      if (refreshUser) await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;
    
    setUploadingAvatar(true);
    try {
      await axios.delete(`${API}/user/avatar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvatarUrl(null);
      toast.success(texts.photoRemoved);
      if (refreshUser) await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await axios.put(`${API}/user/profile`, {
        name,
        email
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUser(response.data.user);
      toast.success(texts.profileUpdated);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error(texts.passwordMismatch);
      return;
    }

    if (newPassword.length < 6) {
      const minLengthMsg = language === 'en' ? 'Password must be at least 6 characters' : 
                          language === 'sq' ? 'Fjalëkalimi duhet të ketë së paku 6 karaktere' :
                          language === 'tr' ? 'Şifre en az 6 karakter olmalıdır' :
                          language === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' :
                          'Neues Passwort muss mindestens 6 Zeichen lang sein';
      toast.error(minLengthMsg);
      return;
    }

    setChangingPassword(true);
    try {
      await axios.put(`${API}/user/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(texts.passwordChanged);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="profile-page">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {texts.back}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Profile Card */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 text-center space-y-4">
              {/* Avatar with Upload */}
              <div className="relative w-28 h-28 mx-auto">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
                
                {/* Avatar Display */}
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={user.name}
                    className="w-28 h-28 rounded-full object-cover border-4 border-[#FFD700]/30"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center text-4xl font-bold text-black">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                
                {/* Upload Button Overlay */}
                <button 
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#181824] border-2 border-[#FFD700] flex items-center justify-center hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50"
                  title={texts.changePhoto}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-[#FFD700] animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-[#FFD700]" />
                  )}
                </button>
              </div>

              {/* Avatar Actions */}
              {avatarUrl && (
                <button
                  onClick={handleDeleteAvatar}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {texts.removePhoto}
                </button>
              )}

              <div>
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <p className="text-[#94A3B8] text-sm">{user.email}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#FFD700]">
                    <Zap className="w-5 h-5" />
                    <span className="text-2xl font-bold">{user.bids_balance || 0}</span>
                  </div>
                  <p className="text-[#94A3B8] text-xs">{language === 'en' ? 'Bids' : language === 'sq' ? 'Oferta' : language === 'tr' ? 'Teklifler' : language === 'fr' ? 'Enchères' : 'Gebote'}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#10B981]">
                    <Trophy className="w-5 h-5" />
                    <span className="text-2xl font-bold">{user.won_auctions?.length || 0}</span>
                  </div>
                  <p className="text-[#94A3B8] text-xs">{texts.auctionsWon}</p>
                </div>
              </div>

              {/* Member since */}
              <div className="flex items-center justify-center gap-2 text-[#94A3B8] text-sm pt-4 border-t border-white/10">
                <Calendar className="w-4 h-4" />
                <span>{texts.memberSince} {new Date(user.created_at || Date.now()).toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="glass-card rounded-2xl p-4 mt-4 space-y-2">
              <Link to="/bid-history" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-[#94A3B8] hover:text-white">
                <Zap className="w-5 h-5" />
                <span>{language === 'en' ? 'Bid History' : language === 'sq' ? 'Historiku i Ofertave' : language === 'tr' ? 'Teklif Geçmişi' : language === 'fr' ? 'Historique des Enchères' : 'Gebots-Historie'}</span>
              </Link>
              <Link to="/purchases" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-[#94A3B8] hover:text-white">
                <Trophy className="w-5 h-5" />
                <span>{language === 'en' ? 'My Purchases' : language === 'sq' ? 'Blerjet e Mia' : language === 'tr' ? 'Satın Alımlarım' : language === 'fr' ? 'Mes Achats' : 'Meine Käufe'}</span>
              </Link>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Info */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#FFD700]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{texts.personalInfo}</h3>
                  <p className="text-[#94A3B8] text-sm">{language === 'en' ? 'Update your account information' : language === 'sq' ? 'Përditësoni informacionin e llogarisë' : language === 'tr' ? 'Hesap bilgilerinizi güncelleyin' : language === 'fr' ? 'Mettez à jour vos informations' : 'Aktualisieren Sie Ihre Kontoinformationen'}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">{texts.name}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                        data-testid="name-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{texts.email}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                        data-testid="email-input"
                      />
                    </div>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="btn-primary"
                  disabled={saving}
                  data-testid="save-profile-btn"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  {texts.saveChanges}
                </Button>
              </form>
            </div>

            {/* Change Password */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{texts.changePassword}</h3>
                  <p className="text-[#94A3B8] text-sm">{language === 'en' ? 'Secure your account with a strong password' : language === 'sq' ? 'Siguroni llogarinë me një fjalëkalim të fortë' : language === 'tr' ? 'Hesabınızı güçlü bir şifre ile güvence altına alın' : language === 'fr' ? 'Sécurisez votre compte avec un mot de passe fort' : 'Sichern Sie Ihr Konto mit einem starken Passwort'}</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">{texts.currentPassword}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                      data-testid="current-password-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">{texts.newPassword}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={language === 'en' ? 'At least 6 characters' : language === 'sq' ? 'Së paku 6 karaktere' : language === 'tr' ? 'En az 6 karakter' : language === 'fr' ? 'Au moins 6 caractères' : 'Mindestens 6 Zeichen'}
                        className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                        data-testid="new-password-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{texts.confirmPassword}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={language === 'en' ? 'Repeat' : language === 'sq' ? 'Përsërit' : language === 'tr' ? 'Tekrarla' : language === 'fr' ? 'Répéter' : 'Wiederholen'}
                        className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                        data-testid="confirm-password-input"
                      />
                    </div>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="bg-[#7C3AED] hover:bg-[#6D28D9]"
                  disabled={changingPassword}
                  data-testid="change-password-btn"
                >
                  {changingPassword ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-5 h-5 mr-2" />
                  )}
                  {texts.updatePassword}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
