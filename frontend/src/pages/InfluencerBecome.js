import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Star, TrendingUp, Users, DollarSign, Gift, Check, 
  Instagram, Youtube, Zap, Award, Target, ArrowRight,
  Sparkles, Crown, Heart, Camera, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InfluencerBecome() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    instagram: '',
    youtube: '',
    tiktok: '',
    followers: '',
    message: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/influencer/apply`, form);
      setSubmitted(true);
      toast.success('Bewerbung erfolgreich gesendet!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  };
  
  const benefits = [
    { icon: <DollarSign className="w-6 h-6" />, title: 'Bis zu 15% Provision', desc: 'Verdienen Sie an jedem Kauf Ihrer Follower' },
    { icon: <Gift className="w-6 h-6" />, title: 'Exklusive Rabatte', desc: 'Bieten Sie Ihren Followern 5-10% Rabatt' },
    { icon: <Zap className="w-6 h-6" />, title: 'Gratis Gebote', desc: 'Monatliche Gratis-Gebote zum Testen' },
    { icon: <Crown className="w-6 h-6" />, title: 'VIP-Status', desc: 'Zugang zu exklusiven VIP-Auktionen' },
    { icon: <Target className="w-6 h-6" />, title: 'Eigenes Dashboard', desc: 'Echtzeit-Tracking Ihrer Einnahmen' },
    { icon: <Award className="w-6 h-6" />, title: 'Bonus-Programm', desc: 'Extra Boni bei Erreichen von Zielen' }
  ];
  
  const steps = [
    { num: '1', title: 'Bewerben', desc: 'Füllen Sie das Formular aus' },
    { num: '2', title: 'Freischaltung', desc: 'Wir prüfen und aktivieren Ihren Account' },
    { num: '3', title: 'Teilen', desc: 'Promoten Sie BidBlitz bei Ihren Followern' },
    { num: '4', title: 'Verdienen', desc: 'Erhalten Sie Provision für jeden Kauf' }
  ];
  
  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Bewerbung erhalten!</h1>
          <p className="text-gray-400 mb-6">
            Vielen Dank für Ihr Interesse! Wir werden Ihre Bewerbung prüfen und uns innerhalb von 24-48 Stunden bei Ihnen melden.
          </p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600">
              Zur Startseite
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-20 pb-12" data-testid="influencer-become">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-amber-500/10 to-transparent" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            Influencer-Programm
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
            Werden Sie <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">BidBlitz Partner</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Verdienen Sie Geld mit Ihrer Reichweite! Werden Sie Teil unseres Influencer-Programms 
            und erhalten Sie bis zu <span className="text-yellow-400 font-bold">15% Provision</span> auf alle Käufe Ihrer Follower.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold px-8 py-3"
            >
              <Star className="w-5 h-5 mr-2" />
              Jetzt bewerben
            </Button>
            <Link to="/influencer-login">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-3">
                Bereits Partner? Einloggen
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Stats */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-yellow-400">15%</p>
            <p className="text-gray-400 text-sm">Max. Provision</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-cyan-400">50+</p>
            <p className="text-gray-400 text-sm">Aktive Partner</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-green-400">€10K+</p>
            <p className="text-gray-400 text-sm">Ausgezahlt</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-purple-400">24h</p>
            <p className="text-gray-400 text-sm">Freischaltung</p>
          </div>
        </div>
      </section>
      
      {/* Benefits */}
      <section className="py-16 px-4 bg-[#0F0F16]/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Ihre Vorteile als Partner
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="glass-card rounded-xl p-6 hover:border-yellow-400/30 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-yellow-400/20 flex items-center justify-center text-yellow-400 mb-4">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-gray-400">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            So funktioniert's
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl font-black text-black mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Application Form */}
      {showForm && (
        <section id="apply" className="py-16 px-4">
          <div className="max-w-xl mx-auto">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-400" />
                Partner werden
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="Ihr Name"
                      className="bg-[#181824] border-white/10 text-white"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-white">E-Mail *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      placeholder="ihre@email.de"
                      className="bg-[#181824] border-white/10 text-white"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white flex items-center gap-1">
                      <Instagram className="w-4 h-4" /> Instagram
                    </Label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm({...form, instagram: e.target.value})}
                      placeholder="@username"
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white flex items-center gap-1">
                      <Youtube className="w-4 h-4" /> YouTube
                    </Label>
                    <Input
                      value={form.youtube}
                      onChange={(e) => setForm({...form, youtube: e.target.value})}
                      placeholder="Channel"
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">TikTok</Label>
                    <Input
                      value={form.tiktok}
                      onChange={(e) => setForm({...form, tiktok: e.target.value})}
                      placeholder="@username"
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-white">Follower-Anzahl (gesamt) *</Label>
                  <Input
                    value={form.followers}
                    onChange={(e) => setForm({...form, followers: e.target.value})}
                    placeholder="z.B. 10.000"
                    className="bg-[#181824] border-white/10 text-white"
                    required
                  />
                </div>
                
                <div>
                  <Label className="text-white">Nachricht (optional)</Label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({...form, message: e.target.value})}
                    placeholder="Erzählen Sie uns mehr über sich..."
                    className="w-full bg-[#181824] border border-white/10 text-white rounded-md p-3 h-24 resize-none"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={loading || !form.name || !form.email || !form.followers}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold"
                >
                  {loading ? 'Wird gesendet...' : 'Bewerbung absenden'}
                </Button>
              </form>
            </div>
          </div>
        </section>
      )}
      
      {/* CTA */}
      {!showForm && (
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Bereit durchzustarten?
            </h2>
            <p className="text-gray-400 mb-8">
              Werden Sie Teil des BidBlitz Partner-Programms und verdienen Sie mit Ihrer Reichweite!
            </p>
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold px-8 py-3 text-lg"
            >
              <Star className="w-5 h-5 mr-2" />
              Jetzt kostenlos bewerben
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
