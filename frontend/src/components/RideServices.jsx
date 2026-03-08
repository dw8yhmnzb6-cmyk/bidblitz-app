import React from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function RideServices() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const services = [
    {
      name: t('rides.taxi') || "Taxi",
      icon: "🚕",
      price: t('rides.from') + " 50 Coins" || "ab 50 Coins",
      color: "from-yellow-500 to-orange-500",
      route: "/taxi",
      description: t('rides.taxiDesc') || "Schnell & bequem"
    },
    {
      name: t('rides.scooter') || "E-Scooter",
      icon: "🛴",
      price: t('rides.from') + " 20 Coins" || "ab 20 Coins",
      color: "from-green-500 to-emerald-600",
      route: "/scooter",
      description: t('rides.scooterDesc') || "Flexibel & günstig"
    },
    {
      name: t('rides.bike') || "E-Bike",
      icon: "🚲",
      price: t('rides.from') + " 10 Coins" || "ab 10 Coins",
      color: "from-blue-500 to-indigo-600",
      route: "/bike",
      description: t('rides.bikeDesc') || "Umweltfreundlich"
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm text-white p-5 rounded-2xl border border-white/10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>🚗</span>
          {t('rides.title') || "Fahrdienste"}
        </h2>
        <button 
          onClick={() => navigate('/transport')}
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          data-testid="view-all-rides-btn"
        >
          {t('common.viewAll') || "Alle anzeigen"} →
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-3 gap-3">
        {services.map((service) => (
          <button
            key={service.name}
            onClick={() => navigate(service.route)}
            className={`bg-gradient-to-br ${service.color} p-4 rounded-xl shadow-lg 
              hover:scale-105 hover:shadow-xl active:scale-95 
              transition-all duration-200 text-left relative overflow-hidden group`}
            data-testid={`ride-service-${service.route.slice(1)}`}
          >
            {/* Background Glow Effect */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            
            {/* Icon */}
            <div className="text-4xl mb-2 drop-shadow-lg">{service.icon}</div>

            {/* Name */}
            <p className="font-bold text-base">
              {service.name}
            </p>

            {/* Description */}
            <p className="text-xs text-white/70 mb-1">
              {service.description}
            </p>

            {/* Price */}
            <p className="text-xs font-medium bg-black/20 px-2 py-1 rounded-lg inline-block mt-1">
              {service.price}
            </p>

            {/* Arrow Indicator */}
            <div className="absolute bottom-3 right-3 text-white/50 group-hover:text-white/80 transition-colors">
              →
            </div>
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-4 flex justify-between text-xs text-slate-400">
        <span>🕐 24/7 {t('rides.available') || "Verfügbar"}</span>
        <span>⚡ {t('rides.fastBooking') || "Schnelle Buchung"}</span>
        <span>💰 {t('rides.payWithCoins') || "Mit Coins bezahlen"}</span>
      </div>
    </div>
  );
}
