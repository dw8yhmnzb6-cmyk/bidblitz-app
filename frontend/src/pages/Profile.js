import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  User, Mail, Lock, Save, ArrowLeft, Camera, Shield, 
  Zap, Trophy, Calendar, Loader2, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      toast.success('Profil erfolgreich aktualisiert');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Neues Passwort muss mindestens 6 Zeichen lang sein');
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
      toast.success('Passwort erfolgreich geändert');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Ändern des Passworts');
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
          Zurück zum Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Profile Card */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 text-center space-y-4">
              {/* Avatar */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center text-3xl font-bold text-black">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#181824] border-2 border-[#FFD700] flex items-center justify-center hover:bg-[#FFD700]/20 transition-colors">
                  <Camera className="w-4 h-4 text-[#FFD700]" />
                </button>
              </div>

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
                  <p className="text-[#94A3B8] text-xs">Gebote</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#10B981]">
                    <Trophy className="w-5 h-5" />
                    <span className="text-2xl font-bold">{user.won_auctions?.length || 0}</span>
                  </div>
                  <p className="text-[#94A3B8] text-xs">Gewonnen</p>
                </div>
              </div>

              {/* Member since */}
              <div className="flex items-center justify-center gap-2 text-[#94A3B8] text-sm pt-4 border-t border-white/10">
                <Calendar className="w-4 h-4" />
                <span>Mitglied seit {new Date(user.created_at || Date.now()).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="glass-card rounded-2xl p-4 mt-4 space-y-2">
              <Link to="/bid-history" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-[#94A3B8] hover:text-white">
                <Zap className="w-5 h-5" />
                <span>Gebots-Historie</span>
              </Link>
              <Link to="/purchases" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-[#94A3B8] hover:text-white">
                <Trophy className="w-5 h-5" />
                <span>Meine Käufe</span>
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
                  <h3 className="text-lg font-bold text-white">Persönliche Daten</h3>
                  <p className="text-[#94A3B8] text-sm">Aktualisieren Sie Ihre Kontoinformationen</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Name</Label>
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
                    <Label className="text-white">E-Mail</Label>
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
                  Änderungen speichern
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
                  <h3 className="text-lg font-bold text-white">Passwort ändern</h3>
                  <p className="text-[#94A3B8] text-sm">Sichern Sie Ihr Konto mit einem starken Passwort</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">Aktuelles Passwort</Label>
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
                    <Label className="text-white">Neues Passwort</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mindestens 6 Zeichen"
                        className="bg-[#181824] border-white/10 text-white pl-10 h-12"
                        data-testid="new-password-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Passwort bestätigen</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Wiederholen"
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
                  Passwort ändern
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
