// src/pages/ComplexDetail.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update, set, push } from "firebase/database";
import { auth, db } from "../firebase";
import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";
import Layout from "../components/Layout";
import AuthModal from "../components/AuthModal";

// ── Constants ─────────────────────────────────────────────────────────────────
const POINTS_PER_PLAYER = 10;       // costo individual por slot
const POINTS_FULL_COURT = 100;      // costo alquilar cancha entera
const CANCEL_PENALTY_PCT = 0.15;    // 15% penalidad al cancelar
const MIN_ADVANCE_HOURS = 2;        // horas mínimas de anticipación

// ── Helpers ───────────────────────────────────────────────────────────────────
function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSlotTooSoon(dateStr, timeStr) {
  const slotTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  const diffHours = (slotTime - now) / (1000 * 60 * 60);
  return diffHours < MIN_ADVANCE_HOURS;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ show, message = "¡Te uniste al partido!" }) {
  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass border border-emerald-500/30 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-xl whitespace-nowrap toast ${show ? "show" : ""}`}>
      <span className="text-xl">⚽</span>
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 sm:h-80 bg-white/5" />
      <div className="px-4 pt-4 space-y-3">
        <div className="h-8 bg-white/5 rounded w-2/3" />
        <div className="h-4 bg-white/5 rounded w-1/3" />
        <div className="h-56 bg-white/5 rounded-2xl mt-6" />
      </div>
    </div>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function Carousel({ images, name }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div className="relative w-full h-64 sm:h-80 overflow-hidden">
      {images.map((img, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}>
          <img src={img} alt={name} className="w-full h-full object-cover"
            onError={(e) => { e.target.src = "https://placehold.co/1200x500/0a2a1a/34d399?text=%E2%9A%BD"; }} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05020c] via-[#05020c]/10 to-black/30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? "w-5 h-2 bg-emerald-400" : "w-2 h-2 bg-gray-600 hover:bg-gray-400"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Time slot ─────────────────────────────────────────────────────────────────
function TimeSlot({ time, slot, isAdminBooked, isJoined, isOwner, tooSoon, onJoin, onCancel }) {
  const playersJoined = slot?.playersJoined || 0;
  const isFullCourt = slot?.bookingType === "full";
  const full = playersJoined >= 10;
  const fillPct = Math.round((playersJoined / 10) * 100);

  // Slot bloqueado por anticipación insuficiente
  if (tooSoon) {
    return (
      <div className="time-slot glass flex flex-col items-center justify-center text-center p-3 rounded-xl opacity-30 cursor-not-allowed">
        <span className="font-bold text-sm text-gray-500">{time}</span>
        <span className="text-xs text-gray-600 mt-1">Cerrado</span>
      </div>
    );
  }

  // Reservado por admin del complejo
  if (isAdminBooked) {
    return (
      <div className="time-slot glass flex flex-col items-center justify-center text-center p-3 rounded-xl opacity-35 cursor-not-allowed">
        <span className="font-bold text-sm text-gray-500">{time}</span>
        <span className="text-xs text-gray-600 mt-1">Reservado</span>
      </div>
    );
  }

  // Cancha alquilada entera — solo muestra si el owner puede ver
  if (isFullCourt) {
    if (isOwner) {
      return (
        <div className="time-slot flex flex-col items-center justify-center text-center p-3 rounded-xl bg-purple-900/20 border border-purple-700/40 cursor-pointer"
          onClick={onCancel}>
          <span className="font-bold text-sm text-purple-400">{time}</span>
          <span className="text-xs text-purple-400 mt-1">Tu cancha</span>
          <span className="text-xs text-red-400 mt-0.5">Cancelar</span>
        </div>
      );
    }
    return (
      <div className="time-slot glass flex flex-col items-center justify-center text-center p-3 rounded-xl opacity-40 cursor-not-allowed">
        <span className="font-bold text-sm text-purple-400">{time}</span>
        <span className="text-xs text-purple-500 mt-1">Alquilada</span>
      </div>
    );
  }

  // Ya se unió — puede cancelar
  if (isJoined) {
    return (
      <button onClick={onCancel}
        className="time-slot flex flex-col items-center justify-center text-center p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 w-full">
        <span className="font-bold text-sm text-emerald-400">{time}</span>
        <span className="text-xs text-emerald-500 mt-1">✓ Unido</span>
        <span className="text-xs text-red-400 mt-0.5">Cancelar</span>
      </button>
    );
  }

  // Completo
  if (full) {
    return (
      <div className="time-slot glass flex flex-col items-center justify-center text-center p-3 rounded-xl opacity-40 cursor-not-allowed">
        <span className="font-bold text-sm text-red-400">{time}</span>
        <span className="text-xs text-red-500 mt-1">Completo</span>
      </div>
    );
  }

  const barColor = playersJoined === 0 ? "bg-emerald-500" : playersJoined < 6 ? "bg-emerald-400" : "bg-amber-400";

  return (
    <button onClick={onJoin}
      className="time-slot available glass flex flex-col items-center justify-center text-center p-3 rounded-xl border border-transparent w-full">
      <span className="font-bold text-sm text-white">{time}</span>
      <span className="text-xs text-gray-500 mt-1">{playersJoined}/10</span>
      <div className="w-full mt-2 bg-gray-800/60 rounded-full h-1">
        <div className={`${barColor} h-1 rounded-full transition-all`} style={{ width: `${fillPct || 0}%` }} />
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ComplexDetail() {
  const { id: complexId } = useParams();
  const navigate = useNavigate();

  const [complexData, setComplexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserPoints, setCurrentUserPoints] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [activeCourtId, setActiveCourtId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [confirming, setConfirming] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  // Modal de selección de modo
  const [modeModal, setModeModal] = useState(null); // { time, slotKey, slotData }

  // Modal de confirmación de reserva
  const [reservationModal, setReservationModal] = useState(null); // { time, slotKey, slotData, mode: "join"|"full" }

  // Modal de cancelación
  const [cancelModal, setCancelModal] = useState(null); // { time, slotKey, slotData, isFullCourt }

  // Modal de invitar amigo
  const [inviteModal, setInviteModal] = useState(null); // { time, slotKey }
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteTab, setInviteTab] = useState("registered"); // "registered" | "guest"
  const [guestName, setGuestName] = useState("");
  const [slotPlayers, setSlotPlayers] = useState([]); // jugadores actuales del slot

  // Toast
  const [toast, setToast] = useState({ show: false, message: "" });

  const datePickerRef = useRef(null);
  const pendingRef = useRef(null);

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);
      if (user) {
        const snap = await get(ref(db, `private_user_data/${user.uid}`));
        if (snap.exists()) setCurrentUserPoints(snap.val().puntos || 0);
        if (typeof pendingRef.current === "function") {
          pendingRef.current();
          pendingRef.current = null;
        }
      }
    });
  }, []);

  // ── Fetch complex ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!complexId) { setError("ID de complejo no encontrado."); setLoading(false); return; }
    get(ref(db, `complexes/${complexId}`)).then((snap) => {
      if (!snap.exists()) { setError("Complejo no encontrado."); setLoading(false); return; }
      const data = { id: complexId, ...snap.val() };
      setComplexData(data);
      setActiveCourtId(Object.keys(data.courts)[0]);
      setTimeout(() => setHeaderVisible(true), 400);
      setLoading(false);
    });
  }, [complexId]);

  // ── Flatpickr ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!datePickerRef.current || loading) return;
    const fp = flatpickr(datePickerRef.current, {
      locale: Spanish,
      dateFormat: "D d/m",
      defaultDate: "today",
      minDate: "today",
      onChange: (dates) => dates[0] && setSelectedDate(dates[0]),
    });
    return () => fp.destroy();
  }, [loading]);

  const getCourtName = useCallback((court) => {
    return court?.nombre_cancha || court?.nombre || court?.name || "Cancha";
  }, []);

  // ── Click en slot ───────────────────────────────────────────────────────────
  const handleSlotClick = useCallback((time) => {
    if (!currentUser) {
      pendingRef.current = () => handleSlotClick(time);
      setShowAuth(true);
      return;
    }
    const court = complexData.courts[activeCourtId];
    const formattedDate = localDateStr(selectedDate);
    const slotKey = `${formattedDate}_${time.replace(":", "")}`;
    const slotData = court.availableSlots?.[slotKey] || { playersJoined: 0, players: {} };

    // Si ya hay jugadores anotados → solo modo individual
    if (slotData.playersJoined > 0) {
      setReservationModal({ time, slotKey, slotData, mode: "join" });
    } else {
      // Elegir modo
      setModeModal({ time, slotKey, slotData });
    }
  }, [currentUser, complexData, activeCourtId, selectedDate]);

  // ── Click cancelar ──────────────────────────────────────────────────────────
  const handleCancelClick = useCallback((time) => {
    const court = complexData.courts[activeCourtId];
    const formattedDate = localDateStr(selectedDate);
    const slotKey = `${formattedDate}_${time.replace(":", "")}`;
    const slotData = court.availableSlots?.[slotKey] || {};
    const isFullCourt = slotData.bookingType === "full";
    setCancelModal({ time, slotKey, slotData, isFullCourt });
  }, [complexData, activeCourtId, selectedDate]);

  // ── Confirmar reserva ───────────────────────────────────────────────────────
  const confirmReservation = async () => {
    const { time, slotKey, slotData, mode } = reservationModal;
    const court = complexData.courts[activeCourtId];
    const courtName = getCourtName(court);
    const isFullCourt = mode === "full";
    const cost = isFullCourt ? POINTS_FULL_COURT : POINTS_PER_PLAYER;

    if (currentUserPoints < cost) {
      alert(`No tenés suficientes puntos. Necesitás ${cost} pts.`);
      return;
    }

    setConfirming(true);
    try {
      const playersJoined = slotData.playersJoined || 0;
      const newPoints = currentUserPoints - cost;
      const bookingId = Date.now();
      const dateStr = localDateStr(selectedDate);

      // Crear reserva admin si es el primero o si alquila entera
      if (playersJoined === 0 || isFullCourt) {
        const adminRef = push(ref(db, `complexes/${complexId}/reservas/${dateStr}`));
        await set(adminRef, {
          cliente: `${isFullCourt ? "Cancha entera" : "Partido"} (${currentUser.displayName || currentUser.email.split("@")[0]})`,
          id_cancha: activeCourtId,
          nombre_cancha: courtName,
          hora_inicio: time,
          precio: Number(court.precio_hora) || 0,
          userId: currentUser.uid,
          tipo: isFullCourt ? "full" : "open",
        });
      }

      const updates = {
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/date`]: dateStr,
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/time`]: time,
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/points`]: POINTS_PER_PLAYER,
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
        [`/users/${currentUser.uid}/bookings/${bookingId}`]: {
          complex: complexData.name,
          court: courtName,
          date: dateStr,
          time,
          points_cost: cost,
          bookingType: isFullCourt ? "full" : "open",
          bookingPath: `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`,
        },
      };

      if (isFullCourt) {
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/bookingType`] = "full";
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/ownerId`] = currentUser.uid;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`] = 1;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/players/${currentUser.uid}`] = true;
      } else {
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`] = (slotData.playersJoined || 0) + 1;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/players/${currentUser.uid}`] = true;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/bookingType`] = "open";
      }

      // Sumar hora jugada al perfil
      const hoursRef = ref(db, `public_profiles/${currentUser.uid}/hoursPlayedFutbol`);
      const hoursSnap = await get(hoursRef);
      const currentHours = hoursSnap.exists() ? hoursSnap.val() : 0;
      updates[`/public_profiles/${currentUser.uid}/hoursPlayedFutbol`] = currentHours + 1;

      await update(ref(db), updates);

      setCurrentUserPoints(newPoints);
      setComplexData((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        if (!updated.courts[activeCourtId].availableSlots) updated.courts[activeCourtId].availableSlots = {};
        const s = updated.courts[activeCourtId].availableSlots[slotKey] || {};
        updated.courts[activeCourtId].availableSlots[slotKey] = {
          ...s,
          playersJoined: isFullCourt ? 1 : (s.playersJoined || 0) + 1,
          players: { ...(s.players || {}), [currentUser.uid]: true },
          bookingType: isFullCourt ? "full" : "open",
          ownerId: isFullCourt ? currentUser.uid : s.ownerId,
          date: dateStr,
          time,
        };
        return updated;
      });

      setReservationModal(null);
      setModeModal(null);
      showToast(isFullCourt ? "¡Cancha alquilada! 🏟️" : "¡Te uniste al partido! ⚽");

    } catch (err) {
      console.error("Error al confirmar reserva:", err);
      alert("Hubo un error al procesar tu reserva.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Confirmar cancelación ───────────────────────────────────────────────────
  const confirmCancellation = async () => {
    const { slotKey, slotData, isFullCourt } = cancelModal;
    const cost = isFullCourt ? POINTS_FULL_COURT : POINTS_PER_PLAYER;
    const refund = Math.floor(cost * (1 - CANCEL_PENALTY_PCT)); // 85%

    setConfirming(true);
    try {
      const newPoints = currentUserPoints + refund;
      const playersJoined = Math.max((slotData.playersJoined || 1) - 1, 0);

      const updates = {
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/players/${currentUser.uid}`]: null,
      };

      if (isFullCourt || playersJoined === 0) {
        // Limpiar slot completamente
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`] = 0;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/bookingType`] = null;
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/ownerId`] = null;
      } else {
        updates[`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`] = playersJoined;
      }

      // Buscar y eliminar la reserva del usuario
      const bookingsSnap = await get(ref(db, `users/${currentUser.uid}/bookings`));
      if (bookingsSnap.exists()) {
        Object.entries(bookingsSnap.val()).forEach(([bId, b]) => {
          if (b.bookingPath === `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`) {
            updates[`/users/${currentUser.uid}/bookings/${bId}`] = null;
          }
        });
      }

      // Restar hora jugada
      const hoursSnap = await get(ref(db, `public_profiles/${currentUser.uid}/hoursPlayedFutbol`));
      const currentHours = hoursSnap.exists() ? hoursSnap.val() : 0;
      updates[`/public_profiles/${currentUser.uid}/hoursPlayedFutbol`] = Math.max(currentHours - 1, 0);

      await update(ref(db), updates);

      setCurrentUserPoints(newPoints);
      setComplexData((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        const s = updated.courts[activeCourtId].availableSlots?.[slotKey];
        if (s) {
          delete s.players?.[currentUser.uid];
          s.playersJoined = playersJoined;
          if (isFullCourt || playersJoined === 0) {
            s.bookingType = null;
            s.ownerId = null;
          }
        }
        return updated;
      });

      setCancelModal(null);
      showToast(`Cancelado. +${refund} pts devueltos (85%)`);

    } catch (err) {
      console.error("Error al cancelar:", err);
      alert("Hubo un error al cancelar.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Buscar usuario para invitar ─────────────────────────────────────────────
  useEffect(() => {
    if (!inviteSearch || inviteSearch.length < 2) { setInviteResults([]); return; }
    setInviteLoading(true);
    const timer = setTimeout(async () => {
      const snap = await get(ref(db, "public_profiles"));
      if (snap.exists()) {
        const profiles = snap.val();
        const results = Object.entries(profiles)
          .filter(([uid, p]) =>
            uid !== currentUser?.uid &&
            p.username?.toLowerCase().includes(inviteSearch.toLowerCase())
          )
          .map(([uid, p]) => ({ uid, ...p }))
          .slice(0, 5);
        setInviteResults(results);
      }
      setInviteLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [inviteSearch, currentUser]);

  // ── Cargar jugadores del slot ───────────────────────────────────────────────
  const loadSlotPlayers = useCallback(async (slotKey) => {
    const slotSnap = await get(ref(db, `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`));
    if (!slotSnap.exists()) { setSlotPlayers([]); return; }
    const slotData = slotSnap.val();
    const players = slotData.players || {};
    const guests = slotData.guests || {};

    // Cargar perfiles de jugadores registrados
    const registeredPlayers = await Promise.all(
      Object.keys(players).map(async (uid) => {
        const snap = await get(ref(db, `public_profiles/${uid}`));
        return snap.exists()
          ? { uid, type: "registered", ...snap.val() }
          : { uid, type: "registered", username: "Jugador" };
      })
    );

    // Jugadores invitados externos
    const guestPlayers = Object.entries(guests).map(([gid, g]) => ({
      uid: gid, type: "guest", username: g.name, invitedBy: g.invitedBy,
    }));

    setSlotPlayers([...registeredPlayers, ...guestPlayers]);
  }, [complexId, activeCourtId]);

  // ── Confirmar invitación (usuario registrado) ───────────────────────────────
  const confirmInvite = async (friendUid, friendUsername) => {
    if (currentUserPoints < POINTS_PER_PLAYER) {
      alert(`No tenés suficientes puntos. Necesitás ${POINTS_PER_PLAYER} pts.`);
      return;
    }
    const { slotKey, time } = inviteModal;
    const court = complexData.courts[activeCourtId];
    const courtName = getCourtName(court);
    const dateStr = localDateStr(selectedDate);

    setConfirming(true);
    try {
      const slotSnap = await get(ref(db, `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`));
      const slotData = slotSnap.exists() ? slotSnap.val() : { playersJoined: 0 };

      const totalOccupied = (slotData.playersJoined || 0) + Object.keys(slotData.guests || {}).length;
      if (totalOccupied >= 10) { alert("El partido ya está completo."); setConfirming(false); return; }
      if (slotData.players?.[friendUid]) { alert(`${friendUsername} ya está anotado.`); setConfirming(false); return; }

      const newPoints = currentUserPoints - POINTS_PER_PLAYER;
      const bookingId = Date.now();
      const updates = {
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/players/${friendUid}`]: true,
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`]: (slotData.playersJoined || 0) + 1,
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
        [`/users/${friendUid}/bookings/${bookingId}`]: {
          complex: complexData.name, court: courtName, date: dateStr, time,
          points_cost: 0, invitedBy: currentUser.uid,
          bookingPath: `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`,
        },
        [`/notifications/${friendUid}/${bookingId}`]: {
          type: "invite",
          from: currentUser.displayName || currentUser.email.split("@")[0],
          complex: complexData.name, court: courtName, date: dateStr, time,
          timestamp: Date.now(),
        },
      };
      await update(ref(db), updates);
      setCurrentUserPoints(newPoints);
      setComplexData((prev) => {
        const u = JSON.parse(JSON.stringify(prev));
        const s = u.courts[activeCourtId].availableSlots?.[slotKey] || {};
        s.players = { ...(s.players || {}), [friendUid]: true };
        s.playersJoined = (s.playersJoined || 0) + 1;
        u.courts[activeCourtId].availableSlots[slotKey] = s;
        return u;
      });
      await loadSlotPlayers(slotKey);
      setInviteSearch(""); setInviteResults([]);
      showToast(`¡Invitaste a ${friendUsername}! -${POINTS_PER_PLAYER} pts`);
    } catch (err) {
      console.error("Error al invitar:", err);
      alert("Hubo un error al invitar.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Confirmar invitación (invitado externo) ─────────────────────────────────
  const confirmGuestInvite = async () => {
    const name = guestName.trim();
    if (!name) { alert("Ingresá un nombre para el invitado."); return; }
    if (currentUserPoints < POINTS_PER_PLAYER) {
      alert(`No tenés suficientes puntos. Necesitás ${POINTS_PER_PLAYER} pts.`);
      return;
    }
    const { slotKey } = inviteModal;

    setConfirming(true);
    try {
      const slotSnap = await get(ref(db, `complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}`));
      const slotData = slotSnap.exists() ? slotSnap.val() : { playersJoined: 0 };
      const totalOccupied = (slotData.playersJoined || 0);
      if (totalOccupied >= 10) { alert("El partido ya está completo."); setConfirming(false); return; }

      const guestId = `guest_${Date.now()}`;
      const newPoints = currentUserPoints - POINTS_PER_PLAYER;
      const updates = {
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/guests/${guestId}`]: {
          name, invitedBy: currentUser.uid,
          invitedByName: currentUser.displayName || currentUser.email.split("@")[0],
        },
        [`/complexes/${complexId}/courts/${activeCourtId}/availableSlots/${slotKey}/playersJoined`]: totalOccupied + 1,
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
      };
      await update(ref(db), updates);
      setCurrentUserPoints(newPoints);
      setComplexData((prev) => {
        const u = JSON.parse(JSON.stringify(prev));
        const s = u.courts[activeCourtId].availableSlots?.[slotKey] || {};
        s.guests = { ...(s.guests || {}), [guestId]: { name, invitedBy: currentUser.uid } };
        s.playersJoined = totalOccupied + 1;
        u.courts[activeCourtId].availableSlots[slotKey] = s;
        return u;
      });
      await loadSlotPlayers(slotKey);
      setGuestName("");
      showToast(`¡${name} agregado como invitado! -${POINTS_PER_PLAYER} pts`);
    } catch (err) {
      console.error("Error al agregar invitado:", err);
      alert("Hubo un error.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Render schedule ─────────────────────────────────────────────────────────
  const renderSchedule = () => {
    if (!complexData || !activeCourtId) return null;
    const court = complexData.courts[activeCourtId];
    const formattedDate = localDateStr(selectedDate);
    const adminBookings = complexData.reservas?.[formattedDate] || {};
    const bookedAdminTimes = Object.values(adminBookings)
      .filter((b) => b.id_cancha === activeCourtId)
      .map((b) => b.hora_inicio);

    return Array.from({ length: 15 }, (_, i) => {
      const hour = i + 8;
      const time = `${hour.toString().padStart(2, "0")}:00`;
      const slotKey = `${formattedDate}_${time.replace(":", "")}`;
      const slot = court.availableSlots?.[slotKey] || null;
      const isJoined = slot?.players?.[currentUser?.uid] || false;
      const isOwner = slot?.ownerId === currentUser?.uid;
      const isAdminBooked = bookedAdminTimes.includes(time);
      const tooSoon = isSlotTooSoon(formattedDate, time);

      return (
        <TimeSlot
          key={time}
          time={time}
          slot={slot}
          isAdminBooked={isAdminBooked}
          isJoined={isJoined}
          isOwner={isOwner}
          tooSoon={tooSoon}
          onJoin={() => handleSlotClick(time)}
          onCancel={() => handleCancelClick(time)}
        />
      );
    });
  };

  if (loading) return <Layout><div className="max-w-4xl mx-auto pt-16"><Skeleton /></div></Layout>;
  if (error) return <Layout><div className="text-center p-8 pt-24"><p className="display text-3xl text-red-400">ERROR</p><p className="text-gray-500 mt-2">{error}</p></div></Layout>;

  const images = complexData.images?.length ? complexData.images : complexData.image ? [complexData.image] : ["https://placehold.co/1200x500/0a2a1a/34d399?text=%E2%9A%BD"];
  const activeCourt = complexData.courts[activeCourtId];
  const activeCourtName = getCourtName(activeCourt);

  return (
    <Layout>
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-30 px-4 pt-4 pb-2">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition flex-shrink-0 border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className={`display text-xl text-white truncate transition-all duration-500 ${headerVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>
            {complexData.name.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto pt-14">
        <Carousel images={images} name={complexData.name} />

        {/* Complex info */}
        <div className="px-4 -mt-6 relative z-10 mb-6 slide-left">
          <p className="display text-5xl sm:text-6xl text-white leading-none">{complexData.name.toUpperCase()}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-emerald-400 text-sm flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {complexData.zone}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-sm truncate">{complexData.address}</span>
          </div>
          {complexData.descripcion && <p className="text-gray-500 text-sm mt-2">{complexData.descripcion}</p>}
        </div>

        {/* Booking section */}
        <div className="px-4 mb-6 fade-up-2">
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <p className="display text-2xl text-white tracking-wide">ELEGÍ TU TURNO</p>
                <p className="text-xs text-gray-600 mt-0.5">Seleccioná una cancha y un horario</p>
              </div>
              <div className="relative flex-shrink-0">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <input ref={datePickerRef} type="text" readOnly placeholder="Hoy"
                  className="bg-white/5 border border-white/10 pl-9 pr-3 py-2 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition cursor-pointer" />
              </div>
            </div>

            {/* Court tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-0.5 no-scrollbar">
              {Object.entries(complexData.courts).map(([courtId, court]) => (
                <button key={courtId} onClick={() => setActiveCourtId(courtId)}
                  className={`court-tab flex-shrink-0 ${activeCourtId === courtId ? "active" : ""}`}>
                  {getCourtName(court)}
                </button>
              ))}
            </div>

            {/* Pricing info */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-700/20 rounded-xl px-3 py-1.5">
                <span className="text-amber-400 text-xs font-bold">👤 Unirme: {POINTS_PER_PLAYER} pts</span>
              </div>
              <div className="flex items-center gap-1.5 bg-purple-900/20 border border-purple-700/20 rounded-xl px-3 py-1.5">
                <span className="text-purple-300 text-xs font-bold">🏟️ Cancha entera: {POINTS_FULL_COURT} pts</span>
              </div>
              <div className="flex items-center gap-1.5 bg-red-900/20 border border-red-700/20 rounded-xl px-3 py-1.5">
                <span className="text-red-400 text-xs font-bold">⚠️ Cancelar: devuelve 85%</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-600 mb-4">
              {[
                { color: "bg-emerald-500", label: "Libre" },
                { color: "bg-amber-400", label: "Casi lleno" },
                { color: "bg-purple-500", label: "Alquilada" },
                { color: "bg-gray-600", label: "Reservado" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${l.color} inline-block`} />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Aviso cancelación automática */}
            <div className="bg-blue-900/20 border border-blue-700/20 rounded-xl px-3 py-2 mb-4">
              <p className="text-blue-300 text-xs">
                ℹ️ Si el partido no se completa a <strong>2 horas antes</strong>, se cancela y se devuelve el <strong>100%</strong> de los puntos.
              </p>
            </div>

            {/* Schedule grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {renderSchedule()}
            </div>
          </div>
        </div>

        {/* Map section */}
        <div className="px-4 mb-8 fade-up-3">
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            <p className="display text-2xl text-white mb-4 flex items-center gap-2 tracking-wide">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              DÓNDE ESTAMOS
            </p>
            <div className="h-52 rounded-2xl overflow-hidden mb-4 border border-white/5">
              <iframe src={complexData.mapUrl || `https://maps.google.com/maps?q=${complexData.lat},${complexData.lon}&z=15&output=embed`}
                width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade" title="Mapa del complejo" />
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{complexData.address}</p>
                <p className="text-gray-500 text-xs mt-0.5">{complexData.zone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* ── Modal: elegir modo ──────────────────────────────────────────────── */}
      {modeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setModeModal(null)}>
          <div className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setModeModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition text-2xl">×</button>

            <p className="display text-2xl text-white mb-2">¿CÓMO QUERÉS JUGAR?</p>
            <p className="text-gray-500 text-sm mb-6">
              <span className="text-white font-bold">{modeModal.time} hs</span> · {activeCourtName}
            </p>

            {/* Modo 1: Unirme */}
            <button
              onClick={() => { setModeModal(null); setReservationModal({ ...modeModal, mode: "join" }); }}
              className="w-full glass border border-emerald-500/30 hover:border-emerald-400/60 rounded-2xl p-4 mb-3 text-left transition group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="display text-xl text-white group-hover:text-emerald-400 transition">👤 UNIRME AL PARTIDO</p>
                  <p className="text-gray-500 text-xs mt-1">Hasta 10 jugadores se anotan individualmente</p>
                  <p className="text-xs text-gray-600 mt-1">⚠️ Si no se completa 2 hs antes → devolución 100%</p>
                </div>
                <span className="display text-2xl text-amber-400 font-black">{POINTS_PER_PLAYER} pts</span>
              </div>
            </button>

            {/* Modo 2: Cancha entera */}
            <button
              onClick={() => { setModeModal(null); setReservationModal({ ...modeModal, mode: "full" }); }}
              className="w-full glass border border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-4 mb-3 text-left transition group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="display text-xl text-white group-hover:text-purple-400 transition">🏟️ ALQUILAR CANCHA ENTERA</p>
                  <p className="text-gray-500 text-xs mt-1">La cancha es solo tuya, podés invitar amigos</p>
                  <p className="text-xs text-gray-600 mt-1">Cancelar devuelve 85% de los puntos</p>
                </div>
                <span className="display text-2xl text-purple-300 font-black">{POINTS_FULL_COURT} pts</span>
              </div>
            </button>

            <p className="text-center text-xs text-gray-600 mt-2">Tus puntos: <span className="text-emerald-400 font-bold">{currentUserPoints}</span></p>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar reserva ────────────────────────────────────────── */}
      {reservationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setReservationModal(null)}>
          <div className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setReservationModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <p className="display text-3xl text-white mb-1">CONFIRMAR RESERVA</p>
            <p className={`text-xs font-bold mb-5 ${reservationModal.mode === "full" ? "text-purple-400" : "text-emerald-400"}`}>
              {reservationModal.mode === "full" ? "🏟️ Cancha entera" : "👤 Unirme al partido"}
            </p>

            <div className="bg-emerald-950/40 border border-emerald-800/20 rounded-2xl p-4 mb-5 space-y-3.5">
              {[
                { icon: "🏟️", label: "Complejo", value: complexData.name },
                { icon: "⚽", label: "Cancha", value: activeCourtName },
                { icon: "📅", label: "Fecha y hora",
                  value: `${selectedDate.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long" })} · ${reservationModal.time} hs` },
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

            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Costo</span>
              <span className={`display text-3xl font-black ${reservationModal.mode === "full" ? "text-purple-300" : "text-amber-400"}`}>
                {reservationModal.mode === "full" ? POINTS_FULL_COURT : POINTS_PER_PLAYER} Pts ✨
              </span>
            </div>

            <div className="flex items-center justify-between mb-5 text-xs">
              <span className="text-gray-600">Tus puntos</span>
              <span className={`font-bold ${currentUserPoints >= (reservationModal.mode === "full" ? POINTS_FULL_COURT : POINTS_PER_PLAYER) ? "text-emerald-400" : "text-red-400"}`}>
                {currentUserPoints} pts
              </span>
            </div>

            {reservationModal.mode === "join" && (
              <p className="text-xs text-blue-300 bg-blue-900/20 rounded-xl px-3 py-2 mb-4">
                ℹ️ Si el partido no se completa 2 hs antes, se cancela y se devuelve el 100% de tus puntos.
              </p>
            )}

            <button onClick={confirmReservation} disabled={confirming}
              className={`w-full active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black py-3.5 px-4 rounded-2xl transition-all shadow-lg display text-xl tracking-wider ${
                reservationModal.mode === "full"
                  ? "bg-purple-700 hover:bg-purple-600 shadow-purple-900/40"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40"
              }`}>
              {confirming ? "PROCESANDO..." : reservationModal.mode === "full" ? "ALQUILAR CANCHA 🏟️" : "CONFIRMAR Y UNIRME ⚽"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: cancelar reserva ─────────────────────────────────────────── */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setCancelModal(null)}>
          <div className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <button onClick={() => setCancelModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition text-2xl">×</button>

            <p className="display text-3xl text-white mb-2">CANCELAR RESERVA</p>
            <p className="text-gray-500 text-sm mb-5">
              {cancelModal.time} hs · {activeCourtName}
            </p>

            <div className="bg-red-900/20 border border-red-700/30 rounded-2xl p-4 mb-5">
              <p className="text-red-400 font-bold text-sm mb-2">⚠️ Penalidad por cancelación</p>
              <p className="text-gray-400 text-xs">
                Al cancelar, se te devuelve el <span className="text-white font-bold">85%</span> de los puntos.
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-500 text-xs">Puntos a devolver</span>
                <span className="text-emerald-400 font-black display text-xl">
                  +{Math.floor((cancelModal.isFullCourt ? POINTS_FULL_COURT : POINTS_PER_PLAYER) * 0.85)} pts
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-500 text-xs">Puntos que perdés</span>
                <span className="text-red-400 font-bold text-xs">
                  -{Math.ceil((cancelModal.isFullCourt ? POINTS_FULL_COURT : POINTS_PER_PLAYER) * 0.15)} pts
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition">
                Mantener reserva
              </button>
              <button onClick={confirmCancellation} disabled={confirming}
                className="flex-1 bg-red-700 hover:bg-red-600 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
                {confirming ? "..." : "CANCELAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: invitar amigos ───────────────────────────────────────────── */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setInviteModal(null)}>
          <div className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => { setInviteModal(null); setInviteSearch(""); setInviteResults([]); setGuestName(""); setSlotPlayers([]); }}
              className="absolute top-5 right-5 text-gray-500 hover:text-white transition text-2xl">×</button>

            <p className="display text-2xl text-white mb-1">INVITAR JUGADORES</p>
            <p className="text-gray-500 text-xs mb-4">
              Cada invitación cuesta <span className="text-amber-400 font-bold">{POINTS_PER_PLAYER} pts</span> · Tus pts: <span className="text-emerald-400 font-bold">{currentUserPoints}</span>
            </p>

            {/* Jugadores actuales */}
            {slotPlayers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Jugadores anotados ({slotPlayers.length}/10)</p>
                <div className="flex flex-wrap gap-2">
                  {slotPlayers.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2.5 py-1.5">
                      {p.type === "guest" ? (
                        <>
                          <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">👤</span>
                          <div>
                            <p className="text-xs text-white font-semibold">{p.username}</p>
                            <p className="text-xs text-gray-600">Invitado</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.username}&background=151523&color=34d399`}
                            className="w-6 h-6 rounded-full" alt="" />
                          <p className="text-xs text-white font-semibold">{p.username}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slotPlayers.length >= 10 ? (
              <div className="text-center py-6">
                <p className="display text-2xl text-red-400">PARTIDO COMPLETO</p>
                <p className="text-gray-500 text-sm mt-1">No hay más lugares disponibles</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    { key: "registered", label: "👤 Usuario registrado" },
                    { key: "guest", label: "🙋 Invitado externo" },
                  ].map((t) => (
                    <button key={t.key} onClick={() => setInviteTab(t.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${inviteTab === t.key ? "bg-emerald-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab: usuario registrado */}
                {inviteTab === "registered" && (
                  <div>
                    <div className="relative mb-3">
                      <input value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)}
                        placeholder="Buscar por apodo..."
                        className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600" />
                      {inviteLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {inviteSearch.length >= 2 && !inviteLoading && inviteResults.length === 0 && (
                        <p className="text-gray-600 text-sm text-center py-4">No se encontraron jugadores</p>
                      )}
                      {inviteResults.map((player) => {
                        const alreadyIn = slotPlayers.some((p) => p.uid === player.uid);
                        return (
                          <button key={player.uid} onClick={() => !alreadyIn && confirmInvite(player.uid, player.username)}
                            disabled={confirming || alreadyIn}
                            className={`w-full flex items-center gap-3 glass rounded-xl p-3 transition text-left ${alreadyIn ? "opacity-40 cursor-not-allowed" : "hover:border-emerald-500/30"}`}>
                            <img src={player.photoURL || `https://ui-avatars.com/api/?name=${player.username}&background=151523&color=34d399`}
                              className="w-10 h-10 rounded-full border border-emerald-500/30 flex-shrink-0" alt="" />
                            <div className="flex-grow">
                              <p className="text-white font-bold text-sm">{player.username}</p>
                              <p className="text-gray-500 text-xs">{player.hoursPlayedFutbol || player.hoursPlayed || 0} hs jugadas</p>
                            </div>
                            <span className={`text-sm font-bold ${alreadyIn ? "text-gray-500" : "text-emerald-400"}`}>
                              {alreadyIn ? "Ya está" : `Invitar · ${POINTS_PER_PLAYER} pts →`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab: invitado externo */}
                {inviteTab === "guest" && (
                  <div>
                    <p className="text-gray-500 text-xs mb-3">
                      Agregá a alguien que no tenga cuenta. Aparecerá como <span className="text-white">"Invitado de {currentUser?.displayName || "vos"}"</span>.
                    </p>
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
                      placeholder='Nombre del invitado (ej: "Pepe el vecino")'
                      maxLength={30}
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600 mb-3" />
                    <div className="bg-amber-900/20 border border-amber-700/20 rounded-xl px-3 py-2 mb-4">
                      <p className="text-amber-400 text-xs">
                        ✨ Se descontarán <strong>{POINTS_PER_PLAYER} pts</strong> de tu cuenta para agregar este invitado.
                      </p>
                    </div>
                    <button onClick={confirmGuestInvite} disabled={confirming || !guestName.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
                      {confirming ? "PROCESANDO..." : `AGREGAR INVITADO · ${POINTS_PER_PLAYER} pts`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Botón flotante de invitar — aparece si el usuario tiene lugar en cualquier slot del día */}
      {currentUser && (() => {
        const court = complexData?.courts?.[activeCourtId];
        const formattedDate = localDateStr(selectedDate);
        const mySlot = Object.entries(court?.availableSlots || {}).find(
          ([, s]) => s.date === formattedDate && (
            s.players?.[currentUser.uid] ||
            (s.bookingType === "full" && s.ownerId === currentUser.uid)
          )
        );
        if (!mySlot) return null;
        const [slotKey, slotData] = mySlot;
        const totalPlayers = slotData.playersJoined || 0;
        if (totalPlayers >= 10) return null;
        return (
          <button
            onClick={async () => {
              setInviteModal({ slotKey, time: slotData.time });
              setInviteTab("registered");
              await loadSlotPlayers(slotKey);
            }}
            className="fixed bottom-20 right-4 z-40 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-black px-4 py-3 rounded-2xl shadow-lg display tracking-wider transition flex items-center gap-2">
            <span>👥</span> INVITAR ({totalPlayers}/10)
          </button>
        );
      })()}

      <Toast show={toast.show} message={toast.message} />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => {}} />
    </Layout>
  );
}
