/**
 * BidBlitz V2 - Home Recommendations
 * Horizontal carousels: Hotels, Events, Restaurants, Jobs, Flights
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Hotel, Ticket, UtensilsCrossed, Briefcase, Plane, Shield,
  MapPin, Star, Clock, ChevronRight, Crown, Users
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SECTION_CONFIG = {
  hotel: { icon: Hotel, color: "#3B82F6", route: "/hotels" },
  event: { icon: Ticket, color: "#A855F7", route: "/events" },
  restaurant: { icon: UtensilsCrossed, color: "#F59E0B", route: "/restaurants" },
  job: { icon: Briefcase, color: "#6366F1", route: "/jobs" },
  insurance: { icon: Shield, color: "#EF4444", route: "/insurance" },
  flight: { icon: Plane, color: "#06B6D4", route: "/flights" },
};

const HomeRecommendations = ({ onNavigate }) => {
  const [sections, setSections] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/recommendations/home`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setSections(d.sections || []))
      .catch(() => {});
  }, []);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-5" data-testid="home-recommendations">
      {sections.map((section, si) => {
        const cfg = SECTION_CONFIG[section.type] || { icon: Star, color: "#666", route: "/more" };
        const Icon = cfg.icon;
        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + si * 0.08 }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full" style={{ background: cfg.color }} />
                <div>
                  <h3 className="text-[13px] font-semibold font-outfit text-white">{section.title}</h3>
                  <p className="text-[9px] text-gray-500">{section.subtitle}</p>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate(cfg.route)}
                className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: cfg.color }}>
                Alle <ChevronRight size={12} />
              </motion.button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide" style={{ marginLeft: 0, paddingRight: 4 }}>
              {section.items.slice(0, 6).map((item, i) => (
                <motion.div
                  key={item.property_id || item.event_id || item.restaurant_id || item.job_id || item.product_id || item.flight_id || i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + si * 0.08 + i * 0.04 }}
                  onClick={() => onNavigate(cfg.route)}
                  className="flex-shrink-0 w-[40vw] max-w-[170px] bg-[#111118] rounded-xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                >
                  {/* Image */}
                  {(item.images?.[0] || item.image_url || item.company_logo || item.airline_logo) ? (
                    <img
                      src={item.images?.[0] || item.image_url || item.company_logo || item.airline_logo}
                      alt=""
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center" style={{ background: `${cfg.color}10` }}>
                      <Icon size={24} style={{ color: cfg.color }} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-2">
                    {section.type === "hotel" && (
                      <>
                        <p className="text-[10px] font-bold truncate">{item.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={8} className="text-gray-500" />
                          <span className="text-[8px] text-gray-500">{item.city}</span>
                        </div>
                        <p className="text-[10px] font-bold mt-1" style={{ color: cfg.color }}>€{item.price_per_night}/N</p>
                      </>
                    )}

                    {section.type === "event" && (
                      <>
                        <p className="text-[10px] font-bold truncate">{item.title}</p>
                        <p className="text-[8px] text-gray-500">{item.date}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>ab €{item.ticket_price}</p>
                      </>
                    )}

                    {section.type === "restaurant" && (
                      <>
                        <p className="text-[10px] font-bold truncate">{item.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {item.rating > 0 && <><Star size={8} className="text-[#F59E0B] fill-[#F59E0B]" /><span className="text-[8px] text-[#F59E0B]">{item.rating}</span></>}
                          <span className="text-[8px] text-gray-500">{item.city}</span>
                        </div>
                      </>
                    )}

                    {section.type === "job" && (
                      <>
                        <p className="text-[10px] font-bold truncate">{item.title}</p>
                        <p className="text-[8px] text-gray-500 truncate">{item.company_name}</p>
                        {item.salary_max > 0 && <p className="text-[9px] font-bold mt-0.5" style={{ color: cfg.color }}>€{item.salary_max?.toLocaleString()}</p>}
                      </>
                    )}

                    {section.type === "insurance" && (
                      <>
                        <p className="text-[10px] font-bold truncate">{item.title}</p>
                        <p className="text-[8px] text-gray-500">{item.provider}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>€{item.monthly_price}/Mo</p>
                      </>
                    )}

                    {section.type === "flight" && (
                      <>
                        <p className="text-[10px] font-bold">{item.origin_code} → {item.destination_code}</p>
                        <p className="text-[8px] text-gray-500">{item.airline}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>ab €{item.price_economy}</p>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
};

export default HomeRecommendations;
