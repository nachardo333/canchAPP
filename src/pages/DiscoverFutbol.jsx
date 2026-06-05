// src/pages/DiscoverFutbol.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push } from "firebase/database";
import { auth, db } from "../firebase";
import { motion, AnimatePresence, useInView } from "framer-motion";
import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";
import Layout from "../components/Layout";
import Header from "../components/Header";
import AuthModal from "../components/AuthModal";
import TiltedCard from "../components/TitledCard";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = 0.5 - Math.cos(dLat) / 2 + (Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * (1 - Math.cos(dLon))) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── BlurText — animación de texto letra por letra ─────────────────────────────
function BlurText({ text, className = "", delay = 0.04 }) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap mr-[0.25em]">
          {word.split("").map((char, ci) => (
            <motion.span
              key={ci}
              className="inline-block"
              initial={{ opacity: 0, filter: "blur(12px)", y: 16 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{
                delay: (wi * word.length + ci) * delay,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
}

// ── CountUp ───────────────────────────────────────────────────────────────────
function CountUp({ to, duration = 1.2 }) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(null);
  const inView = useInView(nodeRef, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return <span ref={nodeRef}>{count}</span>;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-white/5" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Complex Card ──────────────────────────────────────────────────────────────
function ComplexCard({ complex, onClick }) {
  const courtCount = complex.courts ? Object.keys(complex.courts).length : 0;
  const imgSrc = complex.image || "https://placehold.co/400x300/0a1a0f/34d399?text=%E2%9A%BD";

  return (
    <button
      onClick={onClick}
      className="block text-left w-full glass rounded-2xl overflow-hidden group"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      {/* Foto con tilt SOLO en la imagen */}
      <div className="relative w-full overflow-hidden rounded-t-2xl" style={{ height: "200px" }}>
        <TiltedCard
          imageSrc={imgSrc}
          altText={complex.name}
          containerHeight="200px"
          containerWidth="100%"
          imageHeight="200px"
          imageWidth="100%"
          rotateAmplitude={8}
          scaleOnHover={1.06}
          showMobileWarning={false}
          showTooltip={false}
          displayOverlayContent={false}
        />
        {/* Overlays encima del TiltedCard */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        {complex.zone && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="text-xs font-bold bg-emerald-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full uppercase tracking-wider">
              {complex.zone}
            </span>
          </div>
        )}
        {complex.distance != null && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <span className="text-xs bg-black/70 backdrop-blur-sm text-gray-300 px-2.5 py-1 rounded-full font-medium">
              {complex.distance.toFixed(1)} km
            </span>
          </div>
        )}
      </div>

      {/* Info — siempre visible, fuera del tilt */}
      <div className="px-5 py-4 space-y-2">
        <h3 className="display text-2xl text-white tracking-wide leading-tight">
          {complex.name.toUpperCase()}
        </h3>
        {complex.address && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>📍</span>
            <span className="truncate">{complex.address}</span>
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-400">
              {courtCount} cancha{courtCount !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(courtCount, 5) }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              ))}
            </div>
          </div>
          <span className="text-xs text-gray-500 group-hover:text-emerald-400 transition-colors font-medium">
            Ver turnos →
          </span>
        </div>
      </div>
    </button>
  );
}
// ── Slot Card ─────────────────────────────────────────────────────────────────
function SlotCard({ slot, index, onClick }) {
  const fillPct = Math.round(((slot.playersJoined || 0) / 10) * 100);
  const barColor = (slot.playersJoined || 0) === 0 ? "#34d399" : (slot.playersJoined || 0) < 6 ? "#34d399" : "#f59e0b";

  return (
    <motion.button
      onClick={onClick}
      className="flex-shrink-0 w-52 glass rounded-2xl overflow-hidden cursor-pointer text-left group"
      whileHover={{ y: -3, scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="bg-emerald-950/50 border-b border-emerald-800/20 px-4 pt-4 pb-3 relative overflow-hidden">
        <motion.div
          className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
          initial={{ width: "0%" }}
          whileHover={{ width: "100%" }}
          transition={{ duration: 0.4 }}
        />
        <p className="text-xs text-emerald-400 font-semibold capitalize">
          {slot.dateTime.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })}
        </p>
        <p className="display text-4xl text-white leading-none mt-0.5">
          {slot.dateTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          <span className="text-base text-gray-500 font-normal ml-1">hs</span>
        </p>
      </div>
      <div className="p-4">
        <p className="font-bold text-white text-sm truncate">{slot.courtName}</p>
        <p className="text-gray-600 text-xs mt-0.5 truncate">{slot.complexName}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">👤 {slot.playersJoined || 0}/10</span>
            <span className="text-xs font-black bg-emerald-600 text-white px-2.5 py-1 rounded-lg display tracking-wider">
              UNIRSE
            </span>
          </div>
          <div className="w-full bg-gray-800/60 rounded-full h-1 overflow-hidden">
            <motion.div
              className="h-1 rounded-full"
              style={{ backgroundColor: barColor }}
              initial={{ width: 0 }}
              animate={{ width: `${fillPct}%` }}
              transition={{ delay: index * 0.06 + 0.3, duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ── Floating particles hero ───────────────────────────────────────────────────
function HeroParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-emerald-500/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [-20, 20, -20], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Complex Owner Banner ──────────────────────────────────────────────────────
function ComplexOwnerBanner({ onOpen }) {
  return (
    <motion.div
      className="mb-8 relative overflow-hidden glass rounded-3xl p-6 cursor-pointer group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      onClick={onOpen}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      <motion.div
        className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-500/5"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-900/50 border border-emerald-700/30 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
            🏟️
          </div>
          <div>
            <p className="display text-xl text-white tracking-wide">
              ¿TENÉS UN COMPLEJO DEPORTIVO?
            </p>
            <p className="text-gray-400 text-sm mt-0.5">
              Sumá tu complejo a CanchAPP y empezá a recibir reservas online
            </p>
          </div>
        </div>
        <motion.button
          className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl display tracking-wider text-sm whitespace-nowrap"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          QUIERO SUMARME →
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Complex Owner Form Modal ──────────────────────────────────────────────────
function ComplexOwnerModal({ open, onClose }) {
  const [form, setForm] = useState({ complejo: "", nombre: "", email: "", telefono: "", canchas: "", mensaje: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    try {
      await push(ref(db, "leads"), {
        ...form,
        timestamp: Date.now(),
        status: "nuevo",
      });
      setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl relative overflow-hidden"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mt-4 sm:hidden" />

        <div className="p-6">
          <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white text-2xl">×</button>

          {!sent ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-emerald-900/50 border border-emerald-700/30 rounded-2xl flex items-center justify-center text-2xl">🏟️</div>
                <div>
                  <p className="display text-2xl text-white tracking-wide">SUMÁ TU COMPLEJO</p>
                  <p className="text-gray-500 text-xs">Te contactamos en menos de 24hs</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nombre del complejo *</label>
                    <input name="complejo" value={form.complejo} onChange={handleChange} required
                      placeholder="Ej: Club Atlético Norte"
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tu nombre *</label>
                    <input name="nombre" value={form.nombre} onChange={handleChange} required
                      placeholder="Ej: Carlos García"
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email *</label>
                    <input name="email" value={form.email} onChange={handleChange} required type="email"
                      placeholder="tu@email.com"
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">WhatsApp *</label>
                    <input name="telefono" value={form.telefono} onChange={handleChange} required type="tel"
                      placeholder="+54 11 1234-5678"
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">¿Cuántas canchas tenés?</label>
                  <select name="canchas" value={form.canchas} onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition">
                    <option value="">Seleccioná...</option>
                    {["1", "2", "3", "4 - 6", "7 - 10", "Más de 10"].map(o => (
                      <option key={o} value={o}>{o} cancha{o === "1" ? "" : "s"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mensaje (opcional)</label>
                  <textarea name="mensaje" value={form.mensaje} onChange={handleChange}
                    placeholder="Contanos sobre tu complejo, tipo de canchas, zona..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition resize-none placeholder-gray-600" />
                </div>

                <div className="bg-emerald-900/20 border border-emerald-700/20 rounded-xl px-3 py-2">
                  <p className="text-emerald-400 text-xs">✅ Sin costo de alta · Comisión solo por reservas realizadas</p>
                </div>

                <motion.button type="submit" disabled={sending}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl transition display tracking-wider"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}>
                  {sending ? "ENVIANDO..." : "ENVIAR SOLICITUD ✨"}
                </motion.button>
              </form>
            </>
          ) : (
            <motion.div className="text-center py-8"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}>
              <p className="text-6xl mb-4">🎉</p>
              <p className="display text-3xl text-white mb-2">¡RECIBIMOS TU SOLICITUD!</p>
              <p className="text-gray-400 text-sm mb-6">Te contactamos en menos de 24 horas por WhatsApp o email.</p>
              <button onClick={() => { setSent(false); setForm({ complejo: "", nombre: "", email: "", telefono: "", canchas: "", mensaje: "" }); onClose(); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-2xl transition display tracking-wider">
                CERRAR
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Reservation modal ─────────────────────────────────────────────────────────
function ReservationModal({ slot, onClose, onConfirm }) {
  if (!slot) return null;
  const date = new Date(slot.dateTime);
  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-6 relative"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-5 sm:hidden" />
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="display text-3xl text-white mb-5">CONFIRMAR RESERVA</p>
        <div className="bg-emerald-950/40 border border-emerald-800/20 rounded-2xl p-4 mb-5 space-y-3.5">
          {[
            { icon: "🏟️", label: "Complejo", value: slot.complexName },
            { icon: "⚽", label: "Cancha", value: slot.courtName },
            { icon: "📅", label: "Fecha y hora", value: `${date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long" })} · ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} hs` },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-900/50 rounded-lg flex items-center justify-center text-base flex-shrink-0">{row.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{row.label}</p>
                <p className="text-white font-semibold text-sm">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-5">
          <span className="text-gray-400 text-sm">Costo</span>
          <span className="text-2xl font-black text-amber-400">{slot.points || 0} Pts ✨</span>
        </div>
        <motion.button
          onClick={onConfirm}
          className="w-full bg-emerald-600 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-900/40 display text-xl tracking-wider"
          whileHover={{ backgroundColor: "#059669" }}
          whileTap={{ scale: 0.97 }}
        >
          CONFIRMAR Y UNIRME ⚽
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DiscoverFutbol() {
  const navigate = useNavigate();
  const [allComplexes, setAllComplexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const pendingRef = useRef(null);

  const [filters, setFilters] = useState({
    searchTerm: "", selectedDate: null, selectedTime: null, maxDistance: null, userLocation: null,
  });
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [distanceSlider, setDistanceSlider] = useState(10);
  const [timeSelect, setTimeSelect] = useState("");

  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const dateTriggerRef = useRef(null);
  const fpRef = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setCurrentUser(u || null);
      if (u && typeof pendingRef.current === "function") {
        pendingRef.current();
        pendingRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    get(ref(db, "complexes")).then((snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setAllComplexes(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!dateTriggerRef.current) return;
    fpRef.current = flatpickr(dateTriggerRef.current, {
      locale: Spanish, dateFormat: "Y-m-d", minDate: "today",
      onChange: (dates) => setFilters((p) => ({ ...p, selectedDate: dates[0] || null })),
    });
    return () => fpRef.current?.destroy();
  }, []);

  const filtered = (() => {
    let list = [...allComplexes];
    const term = filters.searchTerm.toLowerCase();
    if (term) list = list.filter((c) => c.name?.toLowerCase().includes(term) || c.zone?.toLowerCase().includes(term));
    if (filters.selectedDate || filters.selectedTime) {
      const d = filters.selectedDate;
      const ds = d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0] : null;
      list = list.filter((c) => Object.values(c.courts || {}).some((court) =>
        Object.values(court.availableSlots || {}).some((slot) =>
          (!ds || slot.date === ds) && (!filters.selectedTime || slot.time >= filters.selectedTime)
        )
      ));
    }
    if (filters.maxDistance && filters.userLocation) {
      const { lat, lon } = filters.userLocation;
      list = list.map((c) => ({ ...c, distance: getDistance(lat, lon, c.lat, c.lon) }))
        .filter((c) => c.distance <= filters.maxDistance)
        .sort((a, b) => a.distance - b.distance);
    }
    return list;
  })();

  const nextSlots = (() => {
    const now = new Date();
    const slots = [];
    allComplexes.forEach((complex) => {
      Object.values(complex.courts || {}).forEach((court) => {
        Object.entries(court.availableSlots || {}).forEach(([, slot]) => {
          const dt = new Date(`${slot.date}T${slot.time}`);
          if (dt > now) slots.push({ ...slot, complexId: complex.id, complexName: complex.name, courtName: court.nombre_cancha || court.nombre || court.name, points: court.points, dateTime: dt });
        });
      });
    });
    return slots.sort((a, b) => a.dateTime - b.dateTime);
  })();

  const handleSlotClick = (slot) => {
    if (!currentUser) { pendingRef.current = () => setActiveSlot(slot); setShowAuth(true); return; }
    setActiveSlot(slot);
  };

  const applyDistance = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFilters((p) => ({ ...p, maxDistance: distanceSlider, userLocation: { lat: pos.coords.latitude, lon: pos.coords.longitude } })),
        () => setFilters((p) => ({ ...p, maxDistance: distanceSlider }))
      );
    } else {
      setFilters((p) => ({ ...p, maxDistance: distanceSlider }));
    }
    setShowDistanceModal(false);
  };

  const clearFilter = (key) => {
    if (key === "maxDistance") setFilters((p) => ({ ...p, maxDistance: null, userLocation: null }));
    else { setFilters((p) => ({ ...p, [key]: null })); if (key === "selectedDate") fpRef.current?.clear(); if (key === "selectedTime") setTimeSelect(""); }
  };

  const resetAll = () => {
    setFilters({ searchTerm: "", selectedDate: null, selectedTime: null, maxDistance: null, userLocation: null });
    fpRef.current?.clear(); setTimeSelect(""); setDistanceSlider(10);
  };

  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-5xl">
        <Header sport="futbol" onLogin={() => setShowAuth(true)} />

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-8 relative">
          <HeroParticles />
          <h1 className="display text-6xl sm:text-7xl text-white leading-none">
            <BlurText text="¿A DÓNDE" delay={0.03} />
            {" "}
            <BlurText text="JUGAMOS" className="neon-text" delay={0.03} />
            <br />
            <BlurText text="HOY?" delay={0.03} />
          </h1>
          <motion.p
            className="text-gray-500 mt-3 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            Encontrá canchas disponibles y reservá en segundos.
          </motion.p>
        </div>

        {/* ── Banner dueños de complejos ─────────────────────────────── */}
        {!loading && <ComplexOwnerBanner onOpen={() => setShowOwnerModal(true)} />}

        {/* ── Search ────────────────────────────────────────────────────── */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <input
            type="text" placeholder="Buscar complejo o zona..."
            value={filters.searchTerm}
            onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
            className="w-full bg-white/5 border border-white/8 focus:border-emerald-500 text-white rounded-2xl p-4 pl-12 text-sm outline-none transition placeholder-gray-600"
          />
          <svg className="w-5 h-5 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </motion.div>

        {/* ── Filter chips ──────────────────────────────────────────────── */}
        <motion.div
          className="flex items-center gap-2 mb-8 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {/* Distancia */}
          <button onClick={() => setShowDistanceModal(true)}
            className={`chip flex items-center gap-1.5 text-sm pl-3 pr-2 py-1.5 rounded-full ${filters.maxDistance ? "active" : ""}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span>{filters.maxDistance ? `< ${filters.maxDistance} km` : "Distancia"}</span>
            {filters.maxDistance && (
              <span onClick={(e) => { e.stopPropagation(); clearFilter("maxDistance"); }}
                className="w-4 h-4 rounded-full bg-emerald-500 text-gray-900 text-xs flex items-center justify-center font-bold cursor-pointer">×</span>
            )}
          </button>

          {/* Fecha */}
          <div className={`chip relative flex items-center gap-1.5 text-sm pl-3 pr-2 py-1.5 rounded-full ${filters.selectedDate ? "active" : ""}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="pointer-events-none">
              {filters.selectedDate ? filters.selectedDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "Fecha"}
            </span>
            <input ref={dateTriggerRef} type="text" readOnly className="absolute inset-0 opacity-0 cursor-pointer w-full" />
            {filters.selectedDate && (
              <span onClick={(e) => { e.stopPropagation(); clearFilter("selectedDate"); }}
                className="relative z-10 w-4 h-4 rounded-full bg-emerald-500 text-gray-900 text-xs flex items-center justify-center font-bold cursor-pointer">×</span>
            )}
          </div>

          {/* Hora */}
          <button onClick={() => setShowTimeModal(true)}
            className={`chip flex items-center gap-1.5 text-sm pl-3 pr-2 py-1.5 rounded-full ${filters.selectedTime ? "active" : ""}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span>{filters.selectedTime || "Hora"}</span>
            {filters.selectedTime && (
              <span onClick={(e) => { e.stopPropagation(); clearFilter("selectedTime"); }}
                className="w-4 h-4 rounded-full bg-emerald-500 text-gray-900 text-xs flex items-center justify-center font-bold cursor-pointer">×</span>
            )}
          </button>

          <button onClick={resetAll} className="text-xs text-gray-600 hover:text-gray-400 ml-auto transition">Limpiar filtros</button>
        </motion.div>

        {/* ── Complex grid ──────────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="mb-5">
            <h2 className="display text-3xl text-white tracking-wide">TODOS LOS COMPLEJOS</h2>
            <p className="text-gray-600 text-xs mt-0.5">Seleccioná uno para ver canchas y horarios</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div className="text-center py-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-5xl mb-4">🔍</p>
              <p className="display text-2xl text-gray-400">SIN RESULTADOS</p>
              <p className="text-gray-600 text-sm mt-1">Probá con otros filtros o zonas.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((complex) => (
                <ComplexCard key={complex.id} complex={complex}
                  onClick={() => navigate(`/complejo/${complex.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Next available */}
        <section className="mb-14">
          <div className="mb-5">
            <h2 className="display text-3xl text-white tracking-wide">PROXIMOS TURNOS</h2>
            <p className="text-gray-600 text-xs mt-0.5">Turnos mas proximos para unirse</p>
          </div>
          {nextSlots.length === 0 ? (
            <p className="text-gray-600 text-sm">No hay turnos proximos.</p>
          ) : (
            <div className="overflow-hidden -mx-4 px-4" style={{ maskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)" }}>
              <div
                className="flex gap-3 pb-3"
                style={{
                  width: "max-content",
                  animation: nextSlots.length > 3 ? "scrollSlots 30s linear infinite" : "none",
                }}
                onMouseEnter={e => e.currentTarget.style.animationPlayState = "paused"}
                onMouseLeave={e => e.currentTarget.style.animationPlayState = "running"}
              >
                {/* duplicamos para el loop sin corte */}
                {[...nextSlots, ...nextSlots].map((slot, idx) => (
                  <SlotCard key={idx} slot={slot} index={idx} onClick={() => handleSlotClick(slot)} />
                ))}
              </div>
            </div>
          )}
        </section>

        <style>{`
          @keyframes scrollSlots {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="glass rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0 text-center">
              <div className="w-28 h-28 rounded-full border border-emerald-500/20 bg-emerald-950/40 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <span className="display text-2xl text-white">CANCH<span className="text-emerald-400">APP</span></span>
              </div>
            </div>
            <div className="hidden md:block w-px bg-white/5 self-stretch" />
            <div className="flex-grow">
              <h4 className="display text-xl text-white mb-4 tracking-wide">PREGUNTAS FRECUENTES</h4>
              <div className="space-y-2 text-sm text-gray-500">
                {[
                  ["¿Cómo me registro?", "Podés registrarte con email y contraseña, o usando tu cuenta de Google."],
                  ["¿Cómo reservo un turno?", "Elegí un complejo, seleccioná una cancha y un horario en la grilla para confirmar."],
                  ["¿La reserva es instantánea?", "¡Sí! Todas las reservas se confirman de inmediato."],
                  ["¿Cuánto tiempo tengo para cancelar?", "Podés cancelar hasta 2 horas antes. Se devuelve el 85% de los puntos."],
                ].map(([q, a]) => (
                  <details key={q} className="py-2 border-b border-white/5">
                    <summary className="cursor-pointer hover:text-white transition">{q}</summary>
                    <p className="pt-2 pl-3 text-xs text-gray-600">{a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="hidden md:block w-px bg-white/5 self-stretch" />
            <div className="flex-shrink-0">
              <h4 className="display text-xl text-white mb-4 tracking-wide">CONTACTO</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <p><a href="mailto:contacto@canchapp.com" className="hover:text-emerald-400 transition">contacto@canchapp.com</a></p>
                <p><a href="#" className="hover:text-emerald-400 transition">@CanchAPP_Oficial</a></p>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => {}} />

      <AnimatePresence>
        {showOwnerModal && <ComplexOwnerModal open={showOwnerModal} onClose={() => setShowOwnerModal(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {activeSlot && (
          <ReservationModal slot={activeSlot} onClose={() => setActiveSlot(null)} onConfirm={() => setActiveSlot(null)} />
        )}
      </AnimatePresence>

      {showDistanceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div className="glass w-full max-w-sm p-6 rounded-3xl relative"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }}>
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setShowDistanceModal(false)} className="absolute top-3 right-4 text-gray-500 hover:text-white text-2xl">×</button>
            <p className="display text-2xl text-white mb-4">DISTANCIA MÁXIMA</p>
            <p className="text-center font-black text-4xl text-emerald-400 mb-5 display">{distanceSlider} KM</p>
            <input type="range" min="1" max="50" value={distanceSlider}
              onChange={(e) => setDistanceSlider(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            <button onClick={applyDistance}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all display text-lg tracking-wider">
              APLICAR
            </button>
          </motion.div>
        </div>
      )}

      {showTimeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div className="glass w-full max-w-sm p-6 rounded-3xl relative"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }}>
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setShowTimeModal(false)} className="absolute top-3 right-4 text-gray-500 hover:text-white text-2xl">×</button>
            <p className="display text-2xl text-white mb-4">FILTRAR POR HORA</p>
            <select value={timeSelect} onChange={(e) => setTimeSelect(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm outline-none">
              <option value="">Cualquier hora</option>
              {Array.from({ length: 16 }, (_, i) => (i + 8).toString().padStart(2, "0") + ":00").map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <button onClick={() => { setFilters((p) => ({ ...p, selectedTime: timeSelect || null })); setShowTimeModal(false); }}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all display text-lg tracking-wider">
              APLICAR
            </button>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
