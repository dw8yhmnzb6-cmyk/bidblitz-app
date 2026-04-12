/**
 * BidBlitz V2 - Vendor Cars Management Page
 * CRUD for vendor's car fleet
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, Plus, Search, Loader2, Edit3, Trash2, Eye, X,
  Fuel, Settings2, Users, MapPin, Euro, Check, AlertCircle, ChevronDown,
  Star, Image as ImageIcon
} from "lucide-react";
import {
  getVendorCars, createCar, updateCar, archiveCar,
  uploadCarImage, deleteCarImage, setCarMainImage
} from "../api";
import { useI18n } from "../../../store/I18nContext";

const STATUS_CFG = {
  available: { label: "Verfügbar", color: "#00D26A" },
  rented: { label: "Vermietet", color: "#00C2FF" },
  maintenance: { label: "Wartung", color: "#FFB800" },
  archived: { label: "Archiviert", color: "#666" },
};

const FUEL_OPTS = [
  { value: "petrol", label: "Benzin" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Elektro" },
  { value: "hybrid", label: "Hybrid" },
];

const GEAR_OPTS = [
  { value: "manual", label: "Schaltung" },
  { value: "automatic", label: "Automatik" },
];

const emptyForm = {
  title: "", brand: "", model: "", year: 2024, registration_number: "",
  color: "", fuel_type: "petrol", gearbox: "automatic", seats: 5, doors: 4,
  mileage: 0, city: "", address: "", postal_code: "",
  price_per_day: "", price_per_week: "", price_per_month: "",
  deposit_amount: 500, deductible: 1000,
  min_driver_age: 21, min_license_years: 1, description: "", features: "",
};

export default function VendorCarsPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadCars(); }, [filterStatus]);

  const loadCars = async () => {
    setLoading(true);
    try {
      const data = await getVendorCars(filterStatus);
      setCars(data.cars || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingCar(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (car) => {
    setEditingCar(car);
    setForm({
      ...emptyForm,
      ...car,
      features: (car.features || []).join(", "),
      price_per_day: car.price_per_day || "",
      price_per_week: car.price_per_week || "",
      price_per_month: car.price_per_month || "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        year: parseInt(form.year),
        seats: parseInt(form.seats),
        doors: parseInt(form.doors),
        mileage: parseInt(form.mileage) || 0,
        price_per_day: parseFloat(form.price_per_day),
        price_per_week: form.price_per_week ? parseFloat(form.price_per_week) : null,
        price_per_month: form.price_per_month ? parseFloat(form.price_per_month) : null,
        deposit_amount: parseFloat(form.deposit_amount),
        deductible: parseFloat(form.deductible),
        min_driver_age: parseInt(form.min_driver_age),
        min_license_years: parseInt(form.min_license_years),
        features: form.features ? form.features.split(",").map(f => f.trim()).filter(Boolean) : [],
      };

      if (editingCar) {
        await updateCar(editingCar.car_id, payload);
      } else {
        await createCar(payload);
      }
      setShowForm(false);
      loadCars();
    } catch (err) {
      setError(err.message || "Fehler beim Speichern");
    }
    setSaving(false);
  };

  const handleArchive = async (carId) => {
    if (!window.confirm("Fahrzeug wirklich archivieren?")) return;
    try {
      await archiveCar(carId);
      loadCars();
    } catch (err) { console.error(err); }
  };

  const handleImageUpload = async (carId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadCarImage(carId, file);
      loadCars();
      if (editingCar?.car_id === carId) {
        const data = await getVendorCars(filterStatus);
        const updated = (data.cars || []).find(c => c.car_id === carId);
        if (updated) setEditingCar(updated);
      }
    } catch (err) { alert(err.message); }
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteImage = async (carId, imageUrl) => {
    try {
      await deleteCarImage(carId, imageUrl);
      loadCars();
      if (editingCar?.car_id === carId) {
        const data = await getVendorCars(filterStatus);
        const updated = (data.cars || []).find(c => c.car_id === carId);
        if (updated) setEditingCar(updated);
      }
    } catch (err) { alert(err.message); }
  };

  const handleSetMain = async (carId, imageUrl) => {
    try {
      await setCarMainImage(carId, imageUrl);
      loadCars();
      if (editingCar?.car_id === carId) {
        const data = await getVendorCars(filterStatus);
        const updated = (data.cars || []).find(c => c.car_id === carId);
        if (updated) setEditingCar(updated);
      }
    } catch (err) { alert(err.message); }
  };

  const filtered = cars.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const InputField = ({ label, field, type = "text", ...props }) => (
    <div>
      <label className="text-xs text-[#666] mb-1 block">{label}</label>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
        {...props}
      />
    </div>
  );

  const SelectField = ({ label, field, options }) => (
    <div>
      <label className="text-xs text-[#666] mb-1 block">{label}</label>
      <select
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-cars-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">Meine Fahrzeuge</h1>
              <p className="text-xs text-[#666]">{cars.length} Fahrzeuge</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C2FF] text-black text-sm font-medium"
            data-testid="add-car-btn">
            <Plus size={16} /> Hinzufügen
          </motion.button>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input type="text" placeholder="Suchen..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
              data-testid="vendor-cars-search" />
          </div>
          <select value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value || null)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none cursor-pointer"
            data-testid="vendor-cars-filter">
            <option value="">Alle Status</option>
            <option value="available">Verfügbar</option>
            <option value="rented">Vermietet</option>
            <option value="maintenance">Wartung</option>
          </select>
        </div>
      </div>

      {/* Car List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Car size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Fahrzeuge</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={openCreate}
              className="mt-4 px-6 py-3 rounded-xl bg-[#00C2FF] text-black font-semibold">
              Erstes Fahrzeug anlegen
            </motion.button>
          </div>
        ) : filtered.map((car, idx) => {
          const st = STATUS_CFG[car.status] || STATUS_CFG.available;
          return (
            <motion.div key={car.car_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl border border-white/5 overflow-hidden"
              data-testid={`vendor-car-${car.car_id}`}>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
                      <Car size={24} className="text-[#00C2FF]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{car.title}</h3>
                      <p className="text-xs text-[#666]">{car.brand} {car.model} · {car.year}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-[#888] mb-3">
                  <span className="flex items-center gap-1"><Fuel size={12} />{FUEL_OPTS.find(f=>f.value===car.fuel_type)?.label}</span>
                  <span className="flex items-center gap-1"><Settings2 size={12} />{GEAR_OPTS.find(g=>g.value===car.gearbox)?.label}</span>
                  <span className="flex items-center gap-1"><Users size={12} />{car.seats}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} />{car.city}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-lg font-bold text-[#00C2FF]">€{car.price_per_day}<span className="text-xs text-[#666] font-normal">/Tag</span></span>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(car)}
                      className="p-2 rounded-lg bg-white/5 border border-white/10" data-testid={`edit-car-${car.car_id}`}>
                      <Edit3 size={14} />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleArchive(car.car_id)}
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400"
                      data-testid={`archive-car-${car.car_id}`}>
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => !saving && setShowForm(false)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="min-h-screen bg-[#0A0A0F] md:min-h-0 md:max-w-lg md:mx-auto md:my-8 md:rounded-2xl">
              
              <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">{editingCar ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</h2>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl bg-white/5" data-testid="close-car-form">
                  <X size={20} />
                </motion.button>
              </div>

              <div className="p-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
                )}

                <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide">Fahrzeugdaten</p>
                <InputField label="Titel *" field="title" placeholder="z.B. BMW 3er Limousine" />
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Marke *" field="brand" placeholder="BMW" />
                  <InputField label="Modell *" field="model" placeholder="320d" />
                  <InputField label="Baujahr" field="year" type="number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Kennzeichen *" field="registration_number" placeholder="B-XX 1234" />
                  <InputField label="Farbe *" field="color" placeholder="Schwarz" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Kraftstoff" field="fuel_type" options={FUEL_OPTS} />
                  <SelectField label="Getriebe" field="gearbox" options={GEAR_OPTS} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Sitze" field="seats" type="number" />
                  <InputField label="Türen" field="doors" type="number" />
                  <InputField label="KM-Stand" field="mileage" type="number" />
                </div>

                <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide pt-2">Standort</p>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Stadt *" field="city" placeholder="Berlin" />
                  <InputField label="PLZ" field="postal_code" placeholder="10115" />
                </div>
                <InputField label="Adresse" field="address" placeholder="Musterstraße 1" />

                <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide pt-2">Preise</p>
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Pro Tag * (€)" field="price_per_day" type="number" placeholder="49" />
                  <InputField label="Pro Woche (€)" field="price_per_week" type="number" placeholder="299" />
                  <InputField label="Pro Monat (€)" field="price_per_month" type="number" placeholder="999" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Kaution (€)" field="deposit_amount" type="number" />
                  <InputField label="Selbstbeteiligung (€)" field="deductible" type="number" />
                </div>

                <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide pt-2">Anforderungen</p>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Mindestalter" field="min_driver_age" type="number" />
                  <InputField label="Führerschein (Jahre)" field="min_license_years" type="number" />
                </div>

                <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide pt-2">Beschreibung</p>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Beschreibung</label>
                  <textarea value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Beschreibe dein Fahrzeug..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none focus:border-[#00C2FF]/50" />
                </div>
                <InputField label="Features (kommagetrennt)" field="features" placeholder="Navi, Klimaanlage, PDC" />

                {/* Image Upload Section - only show when editing */}
                {editingCar && (
                  <div>
                    <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide pt-2 mb-3">Fahrzeugbilder</p>
                    
                    {/* Current Images */}
                    {(() => {
                      const allImgs = [editingCar.main_image, ...(editingCar.gallery_images || [])].filter(Boolean);
                      return allImgs.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {allImgs.map((img, i) => (
                            <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-video bg-white/5">
                              <img src={img.startsWith("http") ? img : `${process.env.REACT_APP_BACKEND_URL}${img}`}
                                alt="" className="w-full h-full object-cover" />
                              {editingCar.main_image === img && (
                                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00C2FF] text-black">Haupt</span>
                              )}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {editingCar.main_image !== img && (
                                  <button onClick={() => handleSetMain(editingCar.car_id, img)}
                                    className="p-1.5 rounded-lg bg-[#00C2FF]/30 text-[#00C2FF]" title="Als Hauptbild">
                                    <Star size={14} />
                                  </button>
                                )}
                                <button onClick={() => handleDeleteImage(editingCar.car_id, img)}
                                  className="p-1.5 rounded-lg bg-red-500/30 text-red-400" title="Löschen">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#666] mb-3">Noch keine Bilder hochgeladen</p>
                      );
                    })()}

                    <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/20 cursor-pointer hover:border-[#00C2FF]/50 transition-colors"
                      data-testid="upload-car-image-btn">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <><ImageIcon size={16} /> Bild hochladen</>}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={(e) => handleImageUpload(editingCar.car_id, e)} disabled={uploading} />
                    </label>
                    <p className="text-[10px] text-[#555] mt-1">JPG, PNG oder WebP. Max. 10 MB.</p>
                  </div>
                )}

                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
                  disabled={saving || !form.title || !form.brand || !form.model || !form.price_per_day || !form.city || !form.registration_number || !form.color}
                  className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="save-car-btn">
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> {editingCar ? "Speichern" : "Fahrzeug anlegen"}</>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
