// src/pages/MyBookings.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update, remove, onValue, push } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";
import { processMatchCompletion } from "../hooks/useGamification";

const CANCEL_PENALTY_PCT = 0.15;

// ?? Toast ?????????????????????????????????????????????????????????????????????
function Toast({ show, message }) {
  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass border border-emerald-500/30 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-xl whitespace-nowrap toast ${show ? "show" : ""}`}>
      <span className="text-emerald-400 text-xl">?</span>
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
}

// ?? Booking type badge ????????????????????????????????????????????????????????
function BookingBadge({ type }) {
  if (type === "full") return (
    <span className="text-xs font-bold bg-purple-900/50 text-purple-300 border border-purple-700/30 px-2 py-0.5 rounded-full">?? Cancha entera</span>
  );
  if (type === "invited") return (
    <span className="text-xs font-bold bg-blue-900/50 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">?? Invitado</span>
  );
  return (
    <span className="text-xs font-bold bg-emerald-900/50 text-emerald-400 border border-emerald-700/30 px-2 py-0.5 rounded-full">? Individual</span>
  );
}

// ?? Booking Card ??????????????????????????????????????????????????????????????
function BookingCard({ booking, isPast, onDetail, onCancel, onChat, onInvite }) {
  const date = new Date(`${booking.date}T${booking.time}`);
  const bookingType = booking.bookingType || (booking.invitedBy ? "invited" : "open");
  const canInvite = !isPast && bookingType !== "invited" && (booking.playersJoined || 0) < 10;

  return (
    <div onClick={() => onDetail(booking)}
      className="glass rounded-2xl p-4 flex items-center gap-4 neon-card cursor-pointer">
      {/* Date block */}
      <div className="text-center w-14 flex-shrink-0 pointer-events-none">
        <p className="text-xs font-bold text-emerald-400 uppercase">
          {date.toLocaleDateString("es-ES", { month: "short" })}
        </p>
        <p className="display text-4xl text-white leading-none">
          {date.toLocaleDateString("es-ES", { day: "2-digit" })}
        </p>
        <p className="text-xs text-gray-600">
          {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Info */}
      <div className="flex-grow pointer-events-none min-w-0">
        <h3 className="font-bold text-white text-sm truncate">{booking.court}</h3>
        <p className="text-gray-500 text-xs truncate">{booking.complex}</p>
        <div className="mt-1.5">
          <BookingBadge type={bookingType} />
        </div>
        {!isPast && booking.playersJoined != null && (
          <p className="text-xs text-emerald-400 mt-1">? {booking.playersJoined}/10 jugadores</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-black text-amber-400">{booking.points_cost} pts ?</p>
        <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          {/* Invitar */}
          {canInvite && (
            <button onClick={() => onInvite(booking)}
              className="text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl transition"
              title="Invitar jugadores">
              ?+
            </button>
          )}
          {/* Chat */}
          <button onClick={() => onChat(booking)}
            className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl transition">
            ?
          </button>
          {/* Cancelar */}
          {!isPast && bookingType !== "invited" && (
            <button onClick={() => onCancel(booking)}
              className="text-xs font-bold bg-red-700 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-xl transition">
              ?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ??????????????????????????????????????????????????????????????????????????????
export default function MyBookings() {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });

  // Detail modal
  const [detailModal, setDetailModal] = useState(null);
  const [detailPlayers, setDetailPlayers] = useState([]);
  const [detailGuests, setDetailGuests] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mvpVote, setMvpVote] = useState(null);
  const [mvpSubmitting, setMvpSubmitting] = useState(false);
  const [matchDesc, setMatchDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [isDetailPast, setIsDetailPast] = useState(false);

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Invite modal
  const [inviteModal, setInviteModal] = useState(null); // booking completo
  const [inviteTab, setInviteTab] = useState("registered");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [invitePlayers, setInvitePlayers] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [userPoints, setUserPoints] = useState(0);

  // Chat modal
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBooking, setChatBooking] = useState(null);
  const [chatProfile, setChatProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [playerProfiles, setPlayerProfiles] = useState({});
  const chatUnsubRef = useRef(null);
  const messagesEndRef = useRef(null);

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }

  // ?? Auth ????????????????????????????????????????????????????????????????????
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        setCurrentUser(user);
        const snap = await get(ref(db, `public_profiles/${user.uid}`));
        if (snap.exists()) setChatProfile(snap.val());
        const ptsSnap = await get(ref(db, `private_user_data/${user.uid}`));
        if (ptsSnap.exists()) setUserPoints(ptsSnap.val().puntos || 0);
        loadBookings(user);
      } else {
        navigate("/");
      }
    });
  }, []);

  // ?? Load bookings ???????????????????????????????????????????????????????????
  async function loadBookings(user) {
    setLoading(true);
    const snap = await get(ref(db, `users/${user.uid}/bookings`));
    if (!snap.exists()) { setLoading(false); return; }

    const bookings = snap.val();
    const now = new Date();
    const up = [], past_ = [];

    Object.entries(bookings).forEach(([id, b]) => {
      try {
        if (!b.date || !b.time) {
          // Sin fecha definida va al historial
          past_.push({ ...b, id });
          return;
        }
        const [year, month, day] = b.date.split("-").map(Number);
        const [hour, min] = b.time.split(":").map(Number);
        const dt = new Date(year, month - 1, day, hour, min, 0);
        if (isNaN(dt.getTime())) {
          past_.push({ ...b, id });
          return;
        }
        // Agregar 60 minutos de gracia ? el partido termina ~1hs despues
        const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000);
        dtEnd > now ? up.push({ ...b, id }) : past_.push({ ...b, id });
      } catch {
        past_.push({ ...b, id });
      }
    });

    // Enriquecer con playersJoined
    const enriched = await Promise.all(
      up.map(async (b) => {
        if (b.bookingPath) {
          const s = await get(ref(db, b.bookingPath));
          if (s.exists()) {
            const slotData = s.val();
            return {
              ...b,
              playersJoined: slotData.playersJoined || 0,
              bookingType: slotData.bookingType || b.bookingType,
            };
          }
        }
        return b;
      })
    );

    function toLocalDate(b) {
      try {
        const [y, mo, d] = b.date.split("-").map(Number);
        const [h, mi] = b.time.split(":").map(Number);
        return new Date(y, mo - 1, d, h, mi);
      } catch { return new Date(0); }
    }

    enriched.sort((a, b) => toLocalDate(a) - toLocalDate(b));
    past_.sort((a, b) => toLocalDate(b) - toLocalDate(a));
    setUpcoming(enriched);
    setPast(past_);
    setLoading(false);

    // Procesar XP para reservas pasadas que no fueron procesadas todavia
    const xpChecks = await Promise.all(
      past_.map(async (b) => {
        if (!b.id) return null;
        const snap = await get(ref(db, `users/${user.uid}/bookings/${b.id}/xpProcessed`));
        if (snap.exists()) return null; // ya procesado
        return b;
      })
    );

    const toProcess = xpChecks.filter(Boolean);
    for (const booking of toProcess) {
      try {
        const isOrganizer = booking.bookingType === "full" || !booking.invitedBy;
        const firstSnap = await get(ref(db, `private_user_data/${user.uid}/totalXp`));
        const isFirstMatch = !firstSnap.exists() || firstSnap.val() === 0;

        await processMatchCompletion({
          uid: user.uid,
          isOrganizer,
          isMvp: false, // MVP se suma cuando recibe votos
          isFirstMatch,
          hasStreak: false,
        });

        // Marcar como procesado para no volver a contar
        await update(ref(db, `users/${user.uid}/bookings/${booking.id}`), {
          xpProcessed: true,
        });
      } catch (err) {
        console.error("Error procesando XP para booking:", booking.id, err);
      }
    }
  }

  // ?? Detail modal ????????????????????????????????????????????????????????????
  async function openDetail(booking, isPastBooking = false) {
    setDetailModal(booking);
    setIsDetailPast(isPastBooking);
    setDetailPlayers([]);
    setDetailGuests([]);
    setDetailLoading(true);
    setMvpVote(null);
    setMatchDesc("");
    if (!booking.bookingPath) { setDetailLoading(false); return; }

    const snap = await get(ref(db, booking.bookingPath));
    if (!snap.exists()) { setDetailLoading(false); return; }

    const slotData = snap.val();
    const players = slotData.players || {};
    const guests = slotData.guests || {};

    // Cargar perfiles registrados
    const profileSnaps = await Promise.all(
      Object.keys(players).map((uid) => get(ref(db, `public_profiles/${uid}`)))
    );
    setDetailPlayers(
      profileSnaps.filter((s) => s.exists()).map((s) => ({ uid: s.ref.key || "", ...s.val() }))
    );
    setDetailGuests(
      Object.entries(guests).map(([gid, g]) => ({ uid: gid, name: g.name, invitedByName: g.invitedByName }))
    );

    // Cargar voto MVP previo del usuario actual
    const myVote = slotData.mvpVotes?.[currentUser?.uid];
    if (myVote) setMvpVote(myVote);

    // Cargar descripcion del partido
    setMatchDesc(slotData.description || "");

    setDetailLoading(false);
  }

  async function voteMvp(targetUid) {
    if (!detailModal?.bookingPath || mvpSubmitting) return;
    setMvpSubmitting(true);
    try {
      const path = detailModal.bookingPath;
      await update(ref(db, path + "/mvpVotes"), {
        [currentUser.uid]: targetUid,
      });
      const snap = await get(ref(db, path + "/mvpVotes"));
      if (snap.exists()) {
        const votes = Object.values(snap.val());
        const counts = votes.reduce((acc, uid) => {
          acc[uid] = (acc[uid] || 0) + 1; return acc;
        }, {});
        const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        await update(ref(db, path), { mvpWinner: winner });

        // Sumar XP MVP al ganador via processMatchCompletion
        const prevWinnerSnap = await get(ref(db, path + "/mvpWinner"));
        const prevWinner = prevWinnerSnap.val();
        if (winner && winner !== prevWinner) {
          // Nuevo ganador ? darle XP de MVP
          await processMatchCompletion({
            uid: winner,
            isOrganizer: false,
            isMvp: true,
            isFirstMatch: false,
            hasStreak: false,
          });
        }
        // Contador de votos recibidos en el perfil publico
        const mvpRef = ref(db, `private_user_data/${winner}/mvpVotes`);
        const mvpSnap = await get(mvpRef);
        await update(ref(db, `private_user_data/${winner}`), {
          mvpVotes: (mvpSnap.val() || 0) + 1,
          lastActivityTs: Date.now(),
        });
      }
      setMvpVote(targetUid);
      showToast("Voto MVP registrado");
    } catch { showToast("Error al votar"); }
    finally { setMvpSubmitting(false); }
  }

  async function saveDescription() {
    if (!detailModal?.bookingPath) return;
    setSavingDesc(true);
    try {
      await update(ref(db, detailModal.bookingPath), { description: matchDesc });
      showToast("Descripcion guardada");
    } catch { showToast("Error al guardar"); }
    finally { setSavingDesc(false); }
  }

  // ?? Chat ????????????????????????????????????????????????????????????????????
  async function openChat(booking) {
    setChatBooking(booking);
    setChatOpen(true);
    setMessages([]);

    // Cargar perfiles de jugadores del partido para mostrar avatares
    if (booking.bookingPath) {
      const slotSnap = await get(ref(db, booking.bookingPath));
      if (slotSnap.exists()) {
        const players = slotSnap.val().players || {};
        const profileMap = {};
        await Promise.all(
          Object.keys(players).map(async (uid) => {
            const pSnap = await get(ref(db, `public_profiles/${uid}`));
            if (pSnap.exists()) profileMap[uid] = pSnap.val();
          })
        );
        setPlayerProfiles(profileMap);
      }
    }

    if (chatUnsubRef.current) chatUnsubRef.current();

    // El chat se organiza por bookingPath para que todos los jugadores del partido compartan el mismo chat
    const chatId = booking.bookingPath?.replace(/\//g, "_") || booking.id;
    const msgRef = ref(db, `chats/${chatId}/messages`);
    chatUnsubRef.current = onValue(msgRef, (snap) => {
      if (snap.exists()) {
        const sorted = Object.entries(snap.val())
          .map(([id, m]) => ({ id, ...m }))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMessages(sorted);
      } else {
        setMessages([]);
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  function closeChat() {
    setChatOpen(false);
    if (chatUnsubRef.current) chatUnsubRef.current();
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!chatInput.trim() || !chatBooking) return;
    const chatId = chatBooking.bookingPath?.replace(/\//g, "_") || chatBooking.id;
    await push(ref(db, `chats/${chatId}/messages`), {
      senderId: currentUser.uid,
      senderName: chatProfile?.username || currentUser.displayName || currentUser.email.split("@")[0],
      senderAvatar: chatProfile?.photoURL || currentUser.photoURL || "",
      text: chatInput.trim(),
      type: "user",
      timestamp: new Date().toISOString(),
    });
    setChatInput("");
  }

  // ?? Cancel ??????????????????????????????????????????????????????????????????
  async function confirmCancel() {
    const booking = cancelModal;
    const isFullCourt = booking.bookingType === "full";
    const cost = booking.points_cost || 0;
    const refund = Math.floor(cost * (1 - CANCEL_PENALTY_PCT));

    setCancelling(true);
    try {
      const userRef = ref(db, `private_user_data/${currentUser.uid}`);
      const snap = await get(userRef);
      const currentPoints = snap.val()?.puntos || 0;
      await update(userRef, { puntos: currentPoints + refund });

      if (booking.bookingPath) {
        const slotRef = ref(db, booking.bookingPath);
        const slotSnap = await get(slotRef);
        if (slotSnap.exists()) {
          const d = slotSnap.val();
          const newCount = Math.max((d.playersJoined || 1) - 1, 0);
          const updates = {
            playersJoined: newCount,
            [`players/${currentUser.uid}`]: null,
          };
          if (isFullCourt) {
            updates.bookingType = null;
            updates.ownerId = null;
          }
          await update(slotRef, updates);
        }

        // Mensaje de sistema en el chat
        const chatId = booking.bookingPath.replace(/\//g, "_");
        await push(ref(db, `chats/${chatId}/messages`), {
          type: "system",
          text: `${chatProfile?.username || "Un jugador"} cancel? su lugar ?`,
          timestamp: new Date().toISOString(),
        });
      }

      await remove(ref(db, `users/${currentUser.uid}/bookings/${booking.id}`));

      // Restar hora jugada
      const hoursSnap = await get(ref(db, `public_profiles/${currentUser.uid}/hoursPlayedFutbol`));
      const currentHours = hoursSnap.exists() ? hoursSnap.val() : 0;
      await update(ref(db, `public_profiles/${currentUser.uid}`), {
        hoursPlayedFutbol: Math.max(currentHours - 1, 0),
      });

      setCancelModal(null);
      showToast(`Cancelado. +${refund} pts devueltos (85%)`);
      loadBookings(currentUser);
    } catch (err) {
      console.error("Error al cancelar:", err);
      alert("Hubo un error al cancelar.");
    } finally {
      setCancelling(false);
    }
  }

  // ?? Open invite modal ???????????????????????????????????????????????????????
  async function openInvite(booking) {
    setInviteModal(booking);
    setInviteTab("registered");
    setInviteSearch("");
    setInviteResults([]);
    setGuestName("");
    // Cargar jugadores actuales del slot
    if (!booking.bookingPath) { setInvitePlayers([]); return; }
    const slotSnap = await get(ref(db, booking.bookingPath));
    if (!slotSnap.exists()) { setInvitePlayers([]); return; }
    const slotData = slotSnap.val();
    const players = slotData.players || {};
    const guests = slotData.guests || {};
    const profileSnaps = await Promise.all(
      Object.keys(players).map((uid) => get(ref(db, `public_profiles/${uid}`)))
    );
    const registered = profileSnaps.filter((s) => s.exists()).map((s) => ({
      uid: s.ref?.key || "", type: "registered", ...s.val(),
    }));
    const guestList = Object.entries(guests).map(([gid, g]) => ({
      uid: gid, type: "guest", username: g.name,
    }));
    setInvitePlayers([...registered, ...guestList]);
  }

  // ?? Search users ????????????????????????????????????????????????????????????
  useEffect(() => {
    if (!inviteSearch || inviteSearch.length < 2) { setInviteResults([]); return; }
    setInviteLoading(true);
    const timer = setTimeout(async () => {
      const snap = await get(ref(db, "public_profiles"));
      if (snap.exists()) {
        const profiles = snap.val();
        const results = Object.entries(profiles)
          .filter(([uid, p]) => uid !== currentUser?.uid && p.username?.toLowerCase().includes(inviteSearch.toLowerCase()))
          .map(([uid, p]) => ({ uid, ...p }))
          .slice(0, 6);
        setInviteResults(results);
      }
      setInviteLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [inviteSearch, currentUser]);

  // ?? Invite registered user ??????????????????????????????????????????????????
  async function inviteRegistered(friend) {
    if (userPoints < 10) { alert("No ten?s suficientes puntos (necesit?s 10 pts)."); return; }
    if (!inviteModal?.bookingPath) return;
    setInviting(true);
    try {
      const slotSnap = await get(ref(db, inviteModal.bookingPath));
      const slotData = slotSnap.exists() ? slotSnap.val() : { playersJoined: 0 };
      if ((slotData.playersJoined || 0) >= 10) { alert("El partido ya est? completo."); return; }
      if (slotData.players?.[friend.uid]) { alert(`${friend.username} ya est? anotado.`); return; }

      const bookingId = Date.now();
      const newPoints = userPoints - 10;
      const updates = {
        [`${inviteModal.bookingPath}/players/${friend.uid}`]: true,
        [`${inviteModal.bookingPath}/playersJoined`]: (slotData.playersJoined || 0) + 1,
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
        [`/users/${friend.uid}/bookings/${bookingId}`]: {
          complex: inviteModal.complex, court: inviteModal.court,
          date: inviteModal.date, time: inviteModal.time,
          points_cost: 0, invitedBy: currentUser.uid,
          bookingPath: inviteModal.bookingPath,
        },
        [`/notifications/${friend.uid}/${bookingId}`]: {
          type: "invite",
          from: chatProfile?.username || currentUser.email.split("@")[0],
          complex: inviteModal.complex, court: inviteModal.court,
          date: inviteModal.date, time: inviteModal.time,
          timestamp: Date.now(),
        },
      };
      await update(ref(db), updates);
      setUserPoints(newPoints);
      setInvitePlayers((prev) => [...prev, { uid: friend.uid, type: "registered", username: friend.username, photoURL: friend.photoURL }]);
      setInviteSearch(""); setInviteResults([]);
      // Mensaje de sistema en chat
      const chatId = inviteModal.bookingPath.replace(/\//g, "_");
      await push(ref(db, `chats/${chatId}/messages`), {
        type: "system", text: `${friend.username} fue invitado al partido ??`, timestamp: new Date().toISOString(),
      });
      showToast(`?Invitaste a ${friend.username}! -10 pts`);
      loadBookings(currentUser);
    } catch (err) { console.error(err); alert("Error al invitar."); }
    finally { setInviting(false); }
  }

  // ?? Invite guest ?????????????????????????????????????????????????????????????
  async function inviteGuest() {
    const name = guestName.trim();
    if (!name) { alert("Ingres? un nombre."); return; }
    if (userPoints < 10) { alert("No ten?s suficientes puntos (necesit?s 10 pts)."); return; }
    if (!inviteModal?.bookingPath) return;
    setInviting(true);
    try {
      const slotSnap = await get(ref(db, inviteModal.bookingPath));
      const slotData = slotSnap.exists() ? slotSnap.val() : { playersJoined: 0 };
      if ((slotData.playersJoined || 0) >= 10) { alert("El partido ya est? completo."); return; }

      const guestId = `guest_${Date.now()}`;
      const newPoints = userPoints - 10;
      const updates = {
        [`${inviteModal.bookingPath}/guests/${guestId}`]: {
          name, invitedBy: currentUser.uid,
          invitedByName: chatProfile?.username || currentUser.email.split("@")[0],
        },
        [`${inviteModal.bookingPath}/playersJoined`]: (slotData.playersJoined || 0) + 1,
        [`/private_user_data/${currentUser.uid}/puntos`]: newPoints,
      };
      await update(ref(db), updates);
      setUserPoints(newPoints);
      setInvitePlayers((prev) => [...prev, { uid: guestId, type: "guest", username: name }]);
      setGuestName("");
      const chatId = inviteModal.bookingPath.replace(/\//g, "_");
      await push(ref(db, `chats/${chatId}/messages`), {
        type: "system", text: `${name} fue agregado como invitado ?`, timestamp: new Date().toISOString(),
      });
      showToast(`?${name} agregado! -10 pts`);
      loadBookings(currentUser);
    } catch (err) { console.error(err); alert("Error al agregar invitado."); }
    finally { setInviting(false); }
  }

  // ?? Render ??????????????????????????????????????????????????????????????????
  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="display text-4xl text-white tracking-wide">MIS RESERVAS</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="glass rounded-2xl h-24 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Pr?ximas */}
            <section>
              <p className="display text-2xl text-white mb-4 tracking-wide">
                PR?XIMAS <span className="neon-text">RESERVAS</span>
              </p>
              {upcoming.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-3">?</p>
                  <p className="display text-xl text-gray-500">SIN PR?XIMAS RESERVAS</p>
                  <button onClick={() => navigate("/")} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition display tracking-wider">
                    BUSCAR CANCHAS
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} booking={b} isPast={false}
                      onDetail={(bk) => openDetail(bk, false)} onCancel={setCancelModal}
                      onChat={openChat} onInvite={openInvite} />
                  ))}
                </div>
              )}
            </section>

            {/* Historial */}
            <section>
              <p className="display text-2xl text-white mb-4 tracking-wide">HISTORIAL</p>
              {past.length === 0 ? (
                <p className="text-gray-600 text-sm">No hay reservas en el historial.</p>
              ) : (
                <div className="space-y-3">
                  {past.map((b) => (
                    <BookingCard key={b.id} booking={b} isPast={true}
                      onDetail={(bk) => openDetail(bk, true)} onCancel={setCancelModal} onChat={openChat} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ?? Detail Modal ???????????????????????????????????????????????????????? */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setDetailModal(null)}>
          <div className="glass w-full max-w-md p-6 rounded-3xl relative fade-up">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setDetailModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition text-2xl">?</button>

            <p className="display text-2xl text-white mb-1">DETALLES</p>
            <BookingBadge type={detailModal.bookingType || (detailModal.invitedBy ? "invited" : "open")} />

            <div className="space-y-2 text-sm bg-emerald-950/30 border border-emerald-800/20 rounded-2xl p-4 mt-4 mb-4">
              {[
                ["?? Complejo", detailModal.complex],
                ["? Cancha", detailModal.court],
                ["? Fecha", new Date(`${detailModal.date}T${detailModal.time}`).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
                ["? Hora", new Date(`${detailModal.date}T${detailModal.time}`).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + " hs"],
                ["? Costo", `${detailModal.points_cost} pts`],
              ].map(([label, value]) => (
                <p key={label}><span className="text-gray-500">{label}:</span> <span className="text-white font-semibold">{value}</span></p>
              ))}
            </div>

            {detailLoading ? (
              <div className="h-16 glass rounded-xl animate-pulse" />
            ) : (
              <>
                {/* Jugadores */}
                <p className="text-sm font-bold text-white mb-2">
                  Jugadores ({detailPlayers.length + detailGuests.length}/10)
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto mb-4">
                  {detailPlayers.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                      <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.username}&background=151523&color=34d399`}
                        className="w-7 h-7 rounded-full flex-shrink-0" alt="" />
                      <span className="text-xs text-white font-semibold">{p.username}</span>
                      {p.uid === currentUser?.uid && (
                        <span className="text-xs text-emerald-400 ml-auto">Tu</span>
                      )}
                    </div>
                  ))}
                  {detailGuests.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 p-2 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs flex-shrink-0">G</div>
                      <div>
                        <span className="text-xs text-white font-semibold">{g.name}</span>
                        <span className="text-xs text-gray-600 ml-1.5">invitado</span>
                      </div>
                    </div>
                  ))}
                  {detailPlayers.length === 0 && detailGuests.length === 0 && (
                    <p className="text-xs text-gray-600">Sin jugadores.</p>
                  )}
                </div>

                {/* MVP voting - solo en partidos pasados con jugadores registrados */}
                {isDetailPast && detailPlayers.length >= 1 && (
                  <div className="mb-4 bg-amber-950/20 border border-amber-700/20 rounded-2xl p-3">
                    <p className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                      <span>MVP</span>
                      <span className="text-gray-600 font-normal">Vota al mejor del partido</span>
                      {mvpVote && <span className="ml-auto text-emerald-400">Votado</span>}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {detailPlayers
                        .filter(p => p.uid !== currentUser?.uid)
                        .map((p, i) => (
                          <button key={i}
                            onClick={() => !mvpVote && voteMvp(p.uid)}
                            disabled={!!mvpVote || mvpSubmitting}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                              mvpVote === p.uid
                                ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                : mvpVote
                                  ? "bg-white/3 border-white/5 text-gray-600 cursor-default"
                                  : "bg-white/5 border-white/10 text-gray-300 hover:border-amber-500/40 hover:text-amber-400"
                            }`}>
                            <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.username}&background=151523&color=34d399`}
                              className="w-5 h-5 rounded-full" alt="" />
                            {p.username}
                            {mvpVote === p.uid && <span>MVP</span>}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

                {/* Descripcion del partido */}
                {isDetailPast && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-500 mb-1.5">Como fue el partido?</p>
                    <textarea
                      value={matchDesc}
                      onChange={e => setMatchDesc(e.target.value)}
                      placeholder="Contale a todos como estuvo el partido..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2 text-xs resize-none outline-none placeholder-gray-600"
                    />
                    <button
                      onClick={saveDescription}
                      disabled={savingDesc}
                      className="mt-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50">
                      {savingDesc ? "Guardando..." : "Guardar descripcion"}
                    </button>
                  </div>
                )}
              </>
            )}

            <button onClick={() => { openChat(detailModal); setDetailModal(null); }}
              className="w-full mt-4 bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl transition text-sm display tracking-wider">
              ? ABRIR CHAT DEL PARTIDO
            </button>
          </div>
        </div>
      )}

      {/* ?? Cancel Modal ???????????????????????????????????????????????????????? */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setCancelModal(null)}>
          <div className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
            <button onClick={() => setCancelModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition text-2xl">?</button>

            <p className="display text-3xl text-white mb-2">CANCELAR RESERVA</p>
            <p className="text-gray-500 text-sm mb-5">
              {new Date(`${cancelModal.date}T${cancelModal.time}`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} ? {cancelModal.time} hs
            </p>

            <div className="bg-red-900/20 border border-red-700/30 rounded-2xl p-4 mb-5">
              <p className="text-red-400 font-bold text-sm mb-3">?? Penalidad por cancelaci?n</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Puntos pagados</span>
                  <span className="text-white font-bold">{cancelModal.points_cost} pts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Penalidad (15%)</span>
                  <span className="text-red-400 font-bold">-{Math.ceil(cancelModal.points_cost * CANCEL_PENALTY_PCT)} pts</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold text-sm">A devolver (85%)</span>
                  <span className="text-emerald-400 font-black display text-xl">+{Math.floor(cancelModal.points_cost * (1 - CANCEL_PENALTY_PCT))} pts</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition">
                Mantener
              </button>
              <button onClick={confirmCancel} disabled={cancelling}
                className="flex-1 bg-red-700 hover:bg-red-600 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
                {cancelling ? "..." : "CANCELAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ?? Chat Modal ?????????????????????????????????????????????????????????? */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && closeChat()}>
          <div className="glass w-full max-w-md rounded-3xl flex flex-col relative fade-up" style={{ height: "80vh" }}>
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-blue-900/50 flex items-center justify-center text-xl flex-shrink-0">?</div>
              <div className="flex-grow min-w-0">
                <p className="font-bold text-white text-sm truncate">{chatBooking?.court}</p>
                <p className="text-gray-500 text-xs truncate">{chatBooking?.complex} ? {chatBooking?.date} {chatBooking?.time} hs</p>
              </div>
              <button onClick={closeChat} className="text-gray-500 hover:text-white text-2xl flex-shrink-0">?</button>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2">
              {messages.length === 0 ? (
                <div className="m-auto text-center">
                  <p className="text-4xl mb-2">?</p>
                  <p className="text-gray-600 text-xs">El chat del partido est? vac?o.<br />?S? el primero en escribir!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  // Mensaje de sistema
                  if (msg.type === "system") {
                    return (
                      <div key={i} className="flex justify-center my-1">
                        <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">{msg.text}</span>
                      </div>
                    );
                  }

                  const isMe = msg.senderId === currentUser?.uid;
                  const profile = playerProfiles[msg.senderId];
                  const avatar = msg.senderAvatar || profile?.photoURL ||
                    `https://ui-avatars.com/api/?name=${msg.senderName || "U"}&background=151523&color=34d399`;
                  const name = msg.senderName || profile?.username || msg.senderEmail?.split("@")[0] || "Jugador";

                  return (
                    <div key={i} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMe && (
                        <img src={avatar} className="w-7 h-7 rounded-full flex-shrink-0 mb-0.5" alt="" />
                      )}
                      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && (
                          <p className="text-xs text-gray-500 mb-0.5 ml-1">{name}</p>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm ${isMe
                          ? "bg-emerald-700 rounded-br-sm"
                          : "bg-white/10 rounded-bl-sm"
                        }`}>
                          <p className="text-white">{msg.text}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 mx-1">
                          {new Date(msg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t border-white/5 flex-shrink-0">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escrib? un mensaje..."
                className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition placeholder-gray-600" />
              <button type="submit" disabled={!chatInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm">
                ?
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ?? Invite Modal ???????????????????????????????????????????????????????? */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setInviteModal(null)}>
          <div className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up" style={{ maxHeight: "88vh", overflowY: "auto" }}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setInviteModal(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white transition text-2xl">?</button>

            <p className="display text-2xl text-white mb-0.5">INVITAR JUGADORES</p>
            <p className="text-gray-500 text-xs mb-1">
              {inviteModal.court} ? {inviteModal.date} {inviteModal.time} hs
            </p>
            <p className="text-amber-400 text-xs font-bold mb-4">
              Tus puntos: {userPoints} ? ? Cada invitaci?n cuesta 10 pts (vos pag?s)
            </p>

            {/* Jugadores actuales */}
            {invitePlayers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Ya anotados ({invitePlayers.length}/10)
                </p>
                <div className="flex flex-wrap gap-2">
                  {invitePlayers.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2.5 py-1.5">
                      {p.type === "guest" ? (
                        <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">?</span>
                      ) : (
                        <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.username}&background=151523&color=34d399`}
                          className="w-6 h-6 rounded-full" alt="" />
                      )}
                      <p className="text-xs text-white font-semibold">{p.username}</p>
                      {p.type === "guest" && <span className="text-xs text-gray-600">ext.</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invitePlayers.length >= 10 ? (
              <div className="text-center py-6">
                <p className="display text-2xl text-red-400">PARTIDO COMPLETO</p>
                <p className="text-gray-500 text-sm mt-1">No quedan lugares disponibles</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    { key: "registered", label: "? Usuario registrado" },
                    { key: "guest", label: "? Invitado externo" },
                  ].map((t) => (
                    <button key={t.key} onClick={() => setInviteTab(t.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${inviteTab === t.key ? "bg-emerald-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab: registrado */}
                {inviteTab === "registered" && (
                  <div>
                    <div className="relative mb-3">
                      <input value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)}
                        placeholder="Buscar jugador por apodo..."
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
                        const alreadyIn = invitePlayers.some((p) => p.uid === player.uid);
                        return (
                          <button key={player.uid}
                            onClick={() => !alreadyIn && !inviting && inviteRegistered(player)}
                            disabled={inviting || alreadyIn}
                            className={`w-full flex items-center gap-3 glass rounded-xl p-3 transition text-left ${alreadyIn ? "opacity-40 cursor-not-allowed" : "hover:border-emerald-500/30"}`}>
                            <img src={player.photoURL || `https://ui-avatars.com/api/?name=${player.username}&background=151523&color=34d399`}
                              className="w-10 h-10 rounded-full border border-white/10 flex-shrink-0" alt="" />
                            <div className="flex-grow min-w-0">
                              <p className="text-white font-bold text-sm truncate">{player.username}</p>
                              <p className="text-gray-500 text-xs">{player.hoursPlayedFutbol || 0} hs jugadas</p>
                            </div>
                            <span className={`text-sm font-bold flex-shrink-0 ${alreadyIn ? "text-gray-500" : "text-emerald-400"}`}>
                              {alreadyIn ? "Ya est?" : "Invitar ? 10 pts ?"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab: externo */}
                {inviteTab === "guest" && (
                  <div>
                    <p className="text-gray-500 text-xs mb-3">
                      Agreg? a alguien sin cuenta. Aparecer? como invitado tuyo y vos pag?s los 10 pts.
                    </p>
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
                      placeholder='Nombre del invitado (ej: "El Flaco")'
                      maxLength={30}
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600 mb-3" />
                    <div className="bg-amber-900/20 border border-amber-700/20 rounded-xl px-3 py-2 mb-4">
                      <p className="text-amber-400 text-xs">? Se descontar?n <strong>10 pts</strong> de tu cuenta.</p>
                    </div>
                    <button onClick={inviteGuest} disabled={inviting || !guestName.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
                      {inviting ? "PROCESANDO..." : "AGREGAR INVITADO ? 10 pts"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Toast show={toast.show} message={toast.message} />
    </Layout>
  );
}
