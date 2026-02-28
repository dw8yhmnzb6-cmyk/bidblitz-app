/**
 * Partner Werden - General partner recruitment page (no partnerId needed)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Euro, Users, Bike, Shield, ChevronRight, Check, Star, Zap } from 'lucide-react';

const BENEFITS = [
  { icon: Euro, title: 'Umsatz steigern', desc: 'Erreichen Sie tausende BidBlitz-Nutzer in Ihrer Region' },
  { icon: Users, title: 'Neue Kunden', desc: 'BidBlitz-Nutzer entdecken Ihr Geschäft über die App' },
  { icon: Bike, title: 'Scooter-Parkplatz', desc: 'Scooter-Nutzer kommen direkt zu Ihrem Geschäft' },
  { icon: Shield, title: 'Sichere Zahlung', desc: 'Zahlungen über BidBlitz Pay - schnell und sicher' },
];

const STEPS = [
  { num: '1', title: 'Bewerben', desc: 'Füllen Sie das Formular aus und wir melden uns innerhalb 24h' },
  { num: '2', title: 'Einrichten', desc: 'Wir richten Ihren Partner-Account und QR-Code ein' },
  { num: '3', title: 'Verdienen', desc: 'Kunden bezahlen mit BidBlitz Pay - Sie erhalten wöchentliche Auszahlungen' },
];

export default function PartnerWerdenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pb-24" data-testid="partner-werden-page">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white px-6 py-16 text-center">
        <Building2 className="w-14 h-14 mx-auto mb-4 opacity-90" />
        <h1 className="text-3xl font-bold mb-3">Partner werden</h1>
        <p className="text-amber-100 text-base max-w-md mx-auto">Verdienen Sie mit BidBlitz - registrieren Sie Ihr Geschäft als Partner und profitieren Sie von mehr Kunden</p>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 -mt-8 mb-8">
          {[{n:'50K+',l:'Nutzer'},{n:'15%',l:'Provision'},{n:'7 Tage',l:'Auszahlung'}].map((s,i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-xl font-bold text-amber-600">{s.n}</p>
              <p className="text-xs text-slate-500">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <h2 className="text-lg font-bold text-slate-800 mb-4">Ihre Vorteile</h2>
        <div className="space-y-3 mb-8">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <b.icon className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{b.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-lg font-bold text-slate-800 mb-4">So funktioniert es</h2>
        <div className="space-y-4 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">{s.num}</div>
              <div className="pt-1">
                <h3 className="font-bold text-slate-800">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Partner Types */}
        <h2 className="text-lg font-bold text-slate-800 mb-4">Für alle Branchen</h2>
        <div className="grid grid-cols-2 gap-3 mb-8">
          {['Restaurants & Cafés','Elektronik-Shops','Mode & Fashion','Friseure & Beauty','Fitnessstudios','Supermärkte'].map((t,i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm text-slate-700">{t}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-center text-white mb-8">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-80" />
          <h2 className="text-xl font-bold mb-2">Jetzt Partner werden</h2>
          <p className="text-amber-100 text-sm mb-4">Kostenlos registrieren - keine Grundgebühr</p>
          <Link to="/enterprise" className="inline-block px-8 py-3 bg-white text-amber-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all">
            Jetzt bewerben
          </Link>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 text-center">
          <p className="text-slate-500 text-sm">Fragen? Kontaktieren Sie uns:</p>
          <a href="mailto:partner@bidblitz.ae" className="text-amber-600 font-bold text-lg">partner@bidblitz.ae</a>
        </div>
      </div>
    </div>
  );
}
