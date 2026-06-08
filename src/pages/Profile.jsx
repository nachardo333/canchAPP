// src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { ref, get, update, push, remove, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";
import {
  calcLevel, xpForLevel, getUnlockedTrophies,
  checkPointsExpiry, maxPointsForBooking,
  cashbackAtLevel, getNextMilestones,
  MAX_POINTS_PER_BOOKING, PRECIO_RESERVA,
  POINTS_EXPIRY_DAYS,
} from "../hooks/useGamification";

// ?? Helpers de imagen ?????????????????????????????????????????????????????????
function compressImage(file, maxWidth = 256, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fmt = (n) => "$" + Math.round(n).toLocaleString("es-AR");

// ?? Toast ?????????????????????????????????????????????????????????????????????
function Toast({ message, show }) {
  return (
    <div className={`fixed top-5 right-5 glass border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 z-50 transition-all duration-500 ${show ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"}`}>
      <span className="text-emerald-400 text-xl">&#10003;</span>
      <span className="text-white font-semibold text-sm">{message}</span>
    </div>
  );
}

// Modal de informacion de nivel
function LevelModal({ open, onClose, level, currentXp, neededXp, pct, totalXp }) {
  if (!open) return null;

  const xpSources = [
    { action: "Jugar un partido",   xp: 40 },
    { action: "Ser organizador",    xp: 25 },
    { action: "Recibir voto MVP",   xp: 35 },
    { action: "Primer partido",     xp: 60 },
    { action: "Racha semanal",      xp: 20 },
  ];

  // Proximos 5 niveles con info
  const nextLevels = Array.from({ length: 5 }, (_, i) => {
    const lvl = level + i + 1;
    const xpNeeded = xpForLevel(lvl - 1);
    const cashback = cashbackAtLevel(lvl);
    return { lvl, xpNeeded, hasCashback: cashback > 0, cashback };
  });

  // Proximos 3 hitos de cashback
  const nextMilestones = getNextMilestones(level, 3);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ border: "1px solid rgba(34,197,94,0.2)" }}
      >
        {/* Header verde */}
        <div className="relative px-6 pt-6 pb-5" style={{ background: "linear-gradient(135deg, #052e16, #0a0a1a)" }}>
          <div className="absolute top-0 left-6 right-6 h-px" style={{ background: "linear-gradient(90deg, transparent, #22c55e, transparent)" }} />

          {/* Cerrar */}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Nivel actual */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl text-black flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", boxShadow: "0 0 24px rgba(245,158,11,0.4)" }}>
              {level}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Nivel actual</p>
              <p className="display text-3xl text-white tracking-wide">NIVEL {level}</p>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">{totalXp.toLocaleString()} XP totales acumulados</p>
            </div>
          </div>

          {/* Barra de XP grande */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-semibold">Progreso hacia nivel {level + 1}</span>
              <span className="text-emerald-400 font-bold">{currentXp} / {neededXp} XP</span>
            </div>
            <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-700 relative"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #065f46, #22c55e, #86efac)",
                  boxShadow: "0 0 16px rgba(34,197,94,0.6)",
                }}
              >
                {pct > 10 && (
                  <span className="absolute right-2 top-0 bottom-0 flex items-center text-[10px] font-black text-black">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-600">
              Te faltan <span className="text-white font-bold">{neededXp - currentXp} XP</span> para el nivel {level + 1}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* Proximos niveles con recompensas */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Proximos niveles</p>
            <div className="space-y-2">
              {nextLevels.map(({ lvl, xpNeeded, hasCashback, cashback }) => (
                <div key={lvl}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition"
                  style={hasCashback
                    ? { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)" }
                    : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }
                  }>
                  {/* Badge nivel */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={hasCashback
                      ? { background: "rgba(245,158,11,0.2)", border: "2px solid rgba(245,158,11,0.5)", color: "#f59e0b" }
                      : { background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.08)", color: "#6b7280" }
                    }>
                    {lvl}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">Nivel {lvl}</p>
                      {hasCashback && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                          HITO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">{xpNeeded} XP para subir</p>
                  </div>

                  {/* Recompensa */}
                  {hasCashback ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-amber-400">1 reserva</p>
                      <p className="text-[10px] text-amber-600">gratis</p>
                    </div>
                  ) : (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] text-gray-600">Sin recompensa</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Como ganar XP */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Como ganar XP</p>
            <div className="grid grid-cols-1 gap-2">
              {xpSources.map(s => (
                <div key={s.action} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}>
                  <span className="text-sm text-gray-300">{s.action}</span>
                  <span className="text-sm font-black text-emerald-400">+{s.xp} XP</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reglas de cashback */}
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reglas del cashback</p>
            {[
              { t: "Solo en hitos clave",  d: "Cada 5 niveles. Equivale a 1 reserva gratis por hito." },
              { t: "Tope por reserva",     d: `Maximo ${fmt(MAX_POINTS_PER_BOOKING)} por reserva (25% del valor).` },
              { t: "Vencimiento",          d: `Los puntos expiran a los ${POINTS_EXPIRY_DAYS} dias sin actividad.` },
            ].map(r => (
              <div key={r.t} className="flex gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                <div>
                  <span className="font-semibold text-white">{r.t}: </span>
                  <span className="text-gray-500">{r.d}</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onClose}
            className="w-full py-3 rounded-2xl font-bold text-sm transition"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Barra de XP clickeable
function XPBar({ pct, level, currentXp, neededXp, onClick }) {
  const nextMilestones_ = getNextMilestones(level, 1);
  const nextMilestone = nextMilestones_[0]?.level || null;
  const cashbackAtNext = nextMilestones_[0]?.cashback || null;

  return (
    <button onClick={onClick} className="w-full text-left space-y-1.5 group" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider group-hover:text-gray-400 transition">
            XP hacia nivel {level + 1}
          </span>
          {cashbackAtNext && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/20">
              Nivel {nextMilestone} = 1 reserva gratis
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-emerald-400 font-bold">{currentXp} / {neededXp} XP</span>
          <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition">ver mas</span>
        </div>
      </div>
      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative group-hover:h-4 transition-all duration-200">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #065f46, #22c55e, #86efac)",
            boxShadow: "0 0 12px rgba(34,197,94,0.5)",
          }}
        />
        {pct > 5 && (
          <div className="absolute inset-0 flex items-center pointer-events-none">
            {[25, 50, 75].map(mark => (
              <div key={mark} className="absolute w-px h-2 bg-white/20 top-0.5"
                style={{ left: `${mark}%` }} />
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-600">{pct}% completado - click para ver recompensas</p>
    </button>
  );
}

// ?? Activity Feed row ?????????????????????????????????????????????????????????
const ACT_TYPES = {
  match_played: { icon: "soccer",   color: "#38bdf8", bg: "#0c1a2e", border: "#0369a1" },
  UP:     { icon: "up",       color: "#f59e0b", bg: "#1c1200", border: "#92400e" },
  trophy:       { icon: "COPA",   color: "#fbbf24", bg: "#1c1200", border: "#b45309" },
  booking:      { icon: "calendar", color: "#34d399", bg: "#052e16", border: "#065f46" },
  comment:      { icon: "MSG",     color: "#fb923c", bg: "#1c0a00", border: "#9a3412" },
  cashback:     { icon: "DINERO",    color: "#4ade80", bg: "#052e16", border: "#166534" },
  joined:       { icon: "wave",     color: "#a78bfa", bg: "#1a0a2e", border: "#6d28d9" },
};

const ACT_ICONS = {
  soccer: "FUTBOL",
  up: "arrow_up",
  trophy: "COPA",
  calendar: "CAL",
  MSG: "MSG",
  DINERO: "DINERO",
  wave: "HOLA",
};

function ActivityRow({ event, username }) {
  const type = ACT_TYPES[event.type] || ACT_TYPES.match_played;
  const ts   = event.timestamp ? new Date(event.timestamp) : null;
  const timeAgo = ts ? (() => {
    const diff = Date.now() - ts.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 2) return "Ahora";
    if (h < 1) return `${m}m`;
    if (d < 1) return `${h}h`;
    return `${d}d`;
  })() : "";

  const EMOJI_MAP = {
    soccer: "FUTBOL", up: "UP", trophy: "COPA",
    calendar: "calendar", MSG: "MSG", DINERO: "DINERO", wave: "HOLA",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
      style={{ background: type.bg, borderColor: type.border + "66" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: type.border + "55", border: `2px solid ${type.border}` }}>
        {event.icon || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-snug" style={{ color: "#d1d5db" }}>
          <span className="font-bold" style={{ color: type.color }}>{username}</span>
          {" "}{event.description}
        </p>
        {event.sub && (
          <p className="text-[10px] mt-0.5" style={{ color: type.color + "aa" }}>{event.sub}</p>
        )}
      </div>
      <span className="text-[10px] flex-shrink-0 font-mono" style={{ color: "#6b7280" }}>{timeAgo}</span>
    </div>
  );
}

// Genera el feed a partir de datos reales
function buildFeed(publicData, comments, privateData) {
  const events = [];
  const now  = Date.now();
  const name = publicData?.username || "Jugador";
  const totalXp = privateData?.totalXp || 0;
  const { level } = calcLevel(totalXp);
  const matches = Math.floor(totalXp / 40);
  const puntos  = privateData?.puntos || 0;

  if (matches > 0)
    events.push({ type: "match_played", icon: "FUTBOL",
      description: `jugo ${matches} partido${matches !== 1 ? "s" : ""}.`,
      sub: `${totalXp} XP acumulados`, timestamp: now - 1800000 });

  if (level > 1)
    events.push({ type: "UP", icon: "UP",
      description: `alcanzo el nivel ${level}.`,
      sub: `+${totalXp} XP totales`, timestamp: now - 10800000 });

  if (puntos > 0)
    events.push({ type: "cashback", icon: "DINERO",
      description: `tiene ${fmt(puntos)} en puntos disponibles.`,
      sub: `Usalos para reservar (maximo ${fmt(MAX_POINTS_PER_BOOKING)}/reserva)`,
      timestamp: now - 18000000 });

  Object.values(comments || {})
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 2)
    .forEach(c => events.push({ type: "comment", icon: "MSG",
      description: `recibio un comentario de ${c.commenterName}.`,
      sub: c.text?.length > 45 ? c.text.slice(0, 45) + "..." : c.text,
      timestamp: c.timestamp || now - 28800000 }));

  events.push({ type: "joined", icon: "HOLA",
    description: "se uno a CanchAPP.",
    sub: "Bienvenido a la comunidad", timestamp: now - 259200000 });

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// ?? Trop?es grid ?????????????????????????????????????????????????????????????
const CAT_ORDER = ["Actividad", "Nivel", "Social", "Puntualidad", "Recompensa"];

function TrophiesGrid({ trophies, onCashbackClaim }) {
  const [activeCat, setActiveCat] = useState("Actividad");
  const cats = CAT_ORDER; // sin "Todos"
  const filtered = trophies.filter(t => t.cat === activeCat);
  const unlocked = trophies.filter(t => t.unlocked).length;

  return (
    <div className="glass rounded-3xl p-5">
      {/* Header compacto */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="display text-xl text-white neon-text tracking-wide">LOGROS</p>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
            {unlocked}/{trophies.length}
          </span>
        </div>
        {/* progress ring */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
            <circle cx="24" cy="24" r="18" fill="none" stroke="#22c55e" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - unlocked / trophies.length)}`}
              strokeLinecap="round"/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-white">{Math.round((unlocked/trophies.length)*100)}%</span>
          </div>
        </div>
      </div>

      {/* Filtros de categoria - sin Todos, mas compactos */}
      <div className="flex gap-1 mb-4">
        {cats.map(c => {
          const catUnlocked = trophies.filter(t => t.cat === c && t.unlocked).length;
          const catTotal    = trophies.filter(t => t.cat === c).length;
          return (
            <button key={c} onClick={() => setActiveCat(c)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition text-center ${
                activeCat === c
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/8"
              }`}>
              {c}
              <span className={`ml-1 text-[9px] ${activeCat === c ? "text-black/60" : "text-gray-600"}`}>
                {catUnlocked}/{catTotal}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map(t => (
          <div key={t.id}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
              t.unlocked
                ? "border-opacity-40 bg-opacity-10" + (t.cashback ? " cursor-pointer hover:brightness-110" : "")
                : "border-white/5 bg-white/2 opacity-40 grayscale"
            }`}
            style={t.unlocked ? { borderColor: t.color + "55", background: t.color + "0f" } : {}}
            onClick={() => {
              if (t.unlocked && t.cashback && onCashbackClaim) {
                onCashbackClaim({ level: parseInt(t.id.replace("level_","").replace("cashback_","")) || 0, amount: t.cashback });
              }
            }}>

            {/* Emoji */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border-2 transition-all"
              style={t.unlocked ? { borderColor: t.color + "80", background: t.color + "1a" } : { borderColor: "rgba(255,255,255,0.08)" }}>
              {t.emoji}
            </div>

            <p className="text-[11px] font-bold text-center leading-tight text-white">{t.name}</p>
            <p className="text-[10px] text-gray-500 text-center leading-tight">{t.desc}</p>

            {/* Cashback badge - clickeable si desbloqueado */}
            {t.cashback && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                t.unlocked
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-white/5 text-gray-600 border-white/5"
              }`}>
                {t.unlocked ? "RECLAMAR reserva" : "Reserva gratis"}
              </span>
            )}

            {/* Categoria tag */}
            <span className="text-[9px] uppercase tracking-wider" style={{ color: t.unlocked ? t.color + "aa" : "#4b5563" }}>
              {t.cat}
            </span>

            {/* Check desbloqueado */}
            {t.unlocked && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: t.color + "33", border: `1px solid ${t.color}` }}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: t.color }}>
                  <path d="M2 5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info frenos financieros */}
      <div className="mt-5 p-4 rounded-2xl bg-white/3 border border-white/5 space-y-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Como funcionan los puntos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          {[
            { icon: "cashback", title: "Cashback en hitos", desc: `Cada 5 niveles ~ 1 reserva gratis` },
            { icon: "limit",    title: "Tope por reserva",  desc: `Maximo ${fmt(MAX_POINTS_PER_BOOKING)} (25% del valor)` },
            { icon: "expiry",   title: "Vencimiento",       desc: `Expiran a los ${POINTS_EXPIRY_DAYS} dias sin actividad` },
          ].map(s => (
            <div key={s.title} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-900/50 border border-emerald-700/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500"/>
              </div>
              <div>
                <p className="font-semibold text-white">{s.title}</p>
                <p className="text-gray-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewedUid = searchParams.get("uid");

  const [currentUser,   setCurrentUser]   = useState(null);
  const [publicData,    setPublicData]     = useState(null);
  const [privateData,   setPrivateData]    = useState(null);
  const [comments,      setComments]       = useState({});
  const [loading,       setLoading]        = useState(true);
  const [isOwnProfile,  setIsOwnProfile]   = useState(false);

  const [editing,          setEditing]         = useState(false);
  const [editUsername,     setEditUsername]     = useState("");
  const [editRoleFutbol,   setEditRoleFutbol]   = useState("MEDIOCAMPISTA");
  const [editRolePadel,    setEditRolePadel]    = useState("DRIVE");
  const [stagedPhoto,      setStagedPhoto]      = useState(null);
  const [stagedPhotoFile,  setStagedPhotoFile]  = useState(null);
  const [saving,           setSaving]           = useState(false);

  const [commentText,   setCommentText]    = useState("");
  const [commentRating, setCommentRating]  = useState(0);
  const [toast,         setToast]          = useState({ show: false, message: "" });
  const [showDeletePhoto, setShowDeletePhoto] = useState(false);
  const [showLevelModal,  setShowLevelModal]  = useState(false);
  const [cashbackModal,   setCashbackModal]   = useState(null); // { level, amount }

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);
      const uid = viewedUid || user?.uid;
      if (!uid) { setLoading(false); return; }
      const own = uid === user?.uid;
      setIsOwnProfile(own);

      const pubSnap = await get(ref(db, `public_profiles/${uid}`));
      if (!pubSnap.exists()) { setLoading(false); return; }
      const pub = pubSnap.val();
      setPublicData(pub);
      setEditUsername(pub.username || "");
      setEditRoleFutbol(pub.roleFutbol || "MEDIOCAMPISTA");
      setEditRolePadel(pub.rolePadel || "DRIVE");

      if (own) {
        onValue(ref(db, `private_user_data/${uid}`), (snap) => {
          const raw = snap.exists() ? snap.val() : {};
          console.log("[Profile] private_user_data raw:", raw);
          const checked = checkPointsExpiry(raw);
          if (checked.puntosExpired && !raw.puntosExpired) {
            update(ref(db, `private_user_data/${uid}`), { puntos: 0, puntosExpired: true });
            showToast("Tus puntos expiraron por inactividad (45 dias).");
          }
          setPrivateData(checked);

          // Mostrar cashback pendiente automaticamente si existe
          const pending = raw.cashbackPending || {};
          const pendingEntries = Object.entries(pending).filter(
            ([lvl]) => !raw[`cashbackClaimed_${lvl}`]
          );
          if (pendingEntries.length > 0) {
            const [lvl, info] = pendingEntries[0];
            setTimeout(() => {
              setCashbackModal({ level: Number(lvl), amount: info.amount });
            }, 1000);
          }
        });
      }

      onValue(ref(db, `public_profiles/${uid}/comments`), (snap) => {
        setComments(snap.val() || {});
      });

      setLoading(false);
    });
  }, [viewedUid]);

  async function saveChanges() {
    if (!editUsername.trim()) { showToast("El apodo no puede estar vacio."); return; }
    setSaving(true);
    try {
      let photoURL = publicData?.photoURL || null;
      if (stagedPhotoFile) { showToast("Comprimiendo..."); photoURL = await compressImage(stagedPhotoFile, 256, 0.8); }
      await update(ref(db), {
        [`/public_profiles/${currentUser.uid}/username`]:   editUsername,
        [`/public_profiles/${currentUser.uid}/roleFutbol`]: editRoleFutbol,
        [`/public_profiles/${currentUser.uid}/rolePadel`]:  editRolePadel,
        [`/public_profiles/${currentUser.uid}/photoURL`]:   photoURL,
      });
      if (currentUser.displayName !== editUsername) await updateProfile(currentUser, { displayName: editUsername });
      setPublicData(p => ({ ...p, username: editUsername, roleFutbol: editRoleFutbol, rolePadel: editRolePadel, photoURL }));
      setStagedPhotoFile(null); setStagedPhoto(null); setEditing(false);
      showToast("Perfil actualizado");
    } catch { showToast("Error al guardar."); }
    finally { setSaving(false); }
  }

  async function deletePhoto() {
    try {
      await update(ref(db), { [`/public_profiles/${currentUser.uid}/photoURL`]: null });
      setPublicData(p => ({ ...p, photoURL: null }));
      setStagedPhoto(null); setStagedPhotoFile(null); setShowDeletePhoto(false);
      showToast("Foto eliminada.");
    } catch { showToast("Error."); }
  }

  async function postComment() {
    if (!commentText.trim() || !commentRating) { showToast("Escribi un comentario y selecciona una puntuacion."); return; }
    const uid = viewedUid || currentUser?.uid;
    const myProfile = await get(ref(db, `public_profiles/${currentUser.uid}`));
    const myAvatar  = myProfile.exists() ? myProfile.val().photoURL : null;
    await push(ref(db, `public_profiles/${uid}/comments`), {
      commenterId:    currentUser.uid,
      commenterName:  currentUser.displayName || currentUser.email.split("@")[0],
      commenterAvatar: myAvatar || `https://ui-avatars.com/api/?name=${currentUser.email.charAt(0)}&background=151523&color=34d399`,
      text: commentText, rating: commentRating, timestamp: Date.now(),
    });
    setCommentText(""); setCommentRating(0); showToast("Comentario publicado.");
  }

  async function deleteComment(commentId) {
    const uid = viewedUid || currentUser?.uid;
    await remove(ref(db, `public_profiles/${uid}/comments/${commentId}`));
    showToast("Comentario eliminado.");
  }

  // Datos derivados
  const totalXp     = privateData?.totalXp || 0;
  const { level, currentXp, neededXp, pct } = calcLevel(totalXp);
  const puntos      = privateData?.puntos || 0;
  const maxPuntos   = maxPointsForBooking(puntos);
  const trophies    = getUnlockedTrophies(privateData, publicData);
  const unlockedCt  = trophies.filter(t => t.unlocked).length;
  const XPFeed = publicData ? buildFeed(publicData, comments, privateData) : [];

  const avgRating = (() => {
    const keys = Object.keys(comments);
    if (!keys.length) return null;
    return (keys.reduce((a, k) => a + (comments[k].rating || 0), 0) / keys.length).toFixed(1);
  })();

  const defaultAvatar = `https://ui-avatars.com/api/?name=${publicData?.username || "U"}&background=151523&color=34d399`;
  const avatar = stagedPhoto || publicData?.photoURL || defaultAvatar;

  const nextMilestone_ = getNextMilestones(level, 1)[0] || null;

  if (loading) return <Layout><div className="flex items-center justify-center h-screen"><p className="text-gray-500">Cargando perfil...</p></div></Layout>;
  if (!publicData) return <Layout><div className="text-center p-8 pt-20"><p className="display text-3xl text-red-400">PERFIL NO ENCONTRADO</p><button onClick={() => navigate("/")} className="mt-4 bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold">Volver</button></div></Layout>;

  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-5xl pb-8">

        {/* -- Header -- */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-w?te" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="display text-4xl text-white tracking-wide">
            {isOwnProfile ? "MI " : ""}<span className="neon-text">PERFIL</span>
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* -- Columna principal -- */}
          <div className="flex-grow space-y-5">

            {/* Tarjeta de perfil */}
            <div className="glass rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

              {!editing ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Avatar + nivel */}
                  <div className="relative flex-shrink-0">
                    <div className="relative">
                      <img src={avatar} alt="avatar" className="w-28 h-28 rounded-full border-4 border-emerald-500/50 object-cover" />
                      {/* Anillo de XP alrededor del avatar */}
                      <svg className="absolute inset-0 w-28 h-28 -rotate-90 pointer-events-none" viewBox="0 0 112 112">
                        <circle cx="56" cy="56" r="50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4"/>
                        <circle cx="56" cy="56" r="50" fill="none" stroke="#22c55e" strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 50}`}
                          strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                          strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* Badge nivel */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap z-10">
                      LVL {level}
                    </div>
                    {isOwnProfile && (
                      <button onClick={() => setEditing(true)}
                        className="absolute -top-1 -right-1 glass p-1.5 rounded-full border border-white/10 hover:bg-emerald-900/30 transition z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-w?te" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="text-center sm:text-left flex-grow space-y-3 min-w-0">
                    <p className="display text-4xl text-white tracking-wide truncate">{publicData.username?.toUpperCase()}</p>

                    {/* Roles y rating */}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-emerald-300">FUTBOL {publicData.roleFutbol || "N/A"}</span>
                      <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-sky-300">PADEL {publicData.rolePadel || "N/A"}</span>
                      {avgRating && <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-yellow-400">&#9733; {avgRating}/5</span>}
                      <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-amber-400">COPA {unlockedCt}/{trophies.length} logros</span>
                    </div>

                    {/* Barra XP */}
                    <XPBar pct={pct} level={level} currentXp={currentXp} neededXp={neededXp} onClick={() => setShowLevelModal(true)} />
                  </div>
                </div>
              ) : (
                /* Modo edicion */
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative flex-shrink-0">
                    <label className="cursor-pointer group block">
                      <img src={avatar} alt="" className="w-28 h-28 rounded-full border-4 border-emerald-500/50 object-cover group-hover:opacity-70 transition" />
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <span className="text-white text-xs font-bold">Cambiar</span>
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            setStagedPhotoFile(e.target.files[0]);
                            const reader = new FileReader();
                            reader.onload = (ev) => setStagedPhoto(ev.target.result);
                            reader.readAsDataURL(e.target.files[0]);
                          }
                        }} />
                    </label>
                    <button onClick={() => setShowDeletePhoto(true)} className="absolute -bottom-1 -right-1 bg-red-600 hover:bg-red-500 rounded-full p-1.5 text-white transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <div className="w-full space-y-3">
                    {stagedPhotoFile && <p className="text-xs text-emerald-400">{stagedPhotoFile.name}</p>}
                    <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-2 text-lg font-bold outline-none"
                      placeholder="Apodo" />
                    <select value={editRoleFutbol} onChange={(e) => setEditRoleFutbol(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 outline-none text-sm">
                      {["ARQUERO","DEFENSOR","MEDIOCAMPISTA","DELANTERO"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={editRolePadel} onChange={(e) => setEditRolePadel(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 outline-none text-sm">
                      {["DRIVE","REVES"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={saveChanges} disabled={saving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-2 rounded-xl transition display tracking-wider">
                        {saving ? "GUARDANDO..." : "GUARDAR"}
                      </button>
                      <button onClick={() => { setEditing(false); setStagedPhoto(null); setStagedPhotoFile(null); }}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Trofeos - seccion completa */}
            <TrophiesGrid trophies={trophies} onCashbackClaim={isOwnProfile ? setCashbackModal : null} />

            {/* Comentarios */}
            <div className="glass rounded-3xl p-5">
              <p className="display text-xl text-white mb-5 neon-text tracking-wide">MURO DE COMENTARIOS</p>
              {currentUser && (
                <div className="flex items-start gap-3 mb-5">
                  <img src={publicData?.photoURL && isOwnProfile ? avatar : (currentUser.photoURL || defaultAvatar)}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                  <div className="flex-grow">
                    <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Deja un comentario..."
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl p-3 text-sm resize-none h-20 outline-none placeholder-gray-600" />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(star => (
                          <button key={star} onClick={() => setCommentRating(star)}
                            className={`text-2xl transition ${star <= commentRating ? "text-yellow-400" : "text-gray-700 hover:text-yellow-400"}`}>&#9733;</button>
                        ))}
                      </div>
                      <button onClick={postComment} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition display tracking-wider">PUBLICAR</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3 border-t border-white/5 pt-4">
                {Object.keys(comments).length === 0 ? (
                  <p className="text-center text-gray-600 text-sm">Aun no hay comentarios.</p>
                ) : (
                  Object.entries(comments)
                    .sort(([,a],[,b]) => b.timestamp - a.timestamp)
                    .map(([id, c]) => (
                      <div key={id} className="flex items-start gap-3 relative">
                        <img src={c.commenterAvatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                        <div className="flex-grow bg-white/5 p-3 rounded-2xl">
                          <div className="flex justify-between items-center">
                            <p className="font-bold text-sm text-amber-300">{c.commenterName}</p>
                            <span className="text-yellow-400 text-xs">{"&#9733;".repeat(c.rating)}{"&#9734;".repeat(5 - c.rating)}</span>
                          </div>
                          <p className="text-gray-300 text-sm mt-1">{c.text}</p>
                        </div>
                        {c.commenterId === currentUser?.uid && (
                          <button onClick={() => deleteComment(id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* -- Columna lateral -- */}
          {isOwnProfile && (
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

              {/* Billetera de puntos */}
              <Link to="/puntos"
                className="block glass rounded-3xl p-5 relative overflow-hidden group transition hover:ring-1 hover:ring-emerald-500/30"
                style={{ background: "linear-gradient(135deg, #052e16 0%, #0a0a1a 100%)" }}>
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Billetera</p>
                <div className="flex items-end gap-2 mt-1">
                  {privateData === null ? (
                    <div className="h-12 w-24 bg-white/5 rounded-xl animate-pulse" />
                  ) : (
                    <>
                      <p className="display text-5xl text-amber-400 leading-none">{fmt(puntos)}</p>
                      <p className="text-amber-400 text-xl mb-1">pts</p>
                    </>
                  )}
                </div>
                {puntos > 0 && (
                  <p className="text-xs text-emerald-400/70 mt-1">
                    Usables en tu proxima reserva: {fmt(maxPuntos)}
                  </p>
                )}
                {puntos === 0 && privateData !== null && (
                  <p className="text-xs text-gray-600 mt-1">
                    Llega al nivel 5 para tu primer cashback
                  </p>
                )}
                {nextMilestone_ && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[11px] text-gray-600">Proximo cashback en nivel {nextMilestone_.level}</p>
                    <p className="text-sm font-bold text-amber-400">1 reserva gratis</p>
                  </div>
                )}
              </Link>

              {/* Stats rapidas */}
              <div className="glass rounded-3xl p-5">
                <p className="display text-lg text-white mb-3 neon-text tracking-wide">STATS</p>
                <div className="space-y-2">
                  {[
                    { label: "Nivel",          value: `${level}`,                        color: "#f59e0b" },
                    { label: "XP total",        value: `${totalXp.toLocaleString()}`,    color: "#22c55e" },
                    { label: "Partidos",        value: `${Math.floor(totalXp / 40)}`,    color: "#38bdf8" },
                    { label: "Reputacion",      value: avgRating ? `${avgRating}/5` : "N/A", color: "#fbbf24" },
                    { label: "Logros",          value: `${unlockedCt}/${trophies.length}`, color: "#a78bfa" },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-xs text-gray-500">{s.label}</span>
                      <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feed de actividad */}
              <div className="glass rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-emerald-900 border border-emerald-700 flex items-center justify-center text-sm">&#9889;</div>
                  <p className="display text-lg text-white tracking-wide neon-text">ACTIVIDAD</p>
                </div>
                <div className="space-y-2">
                  {XPFeed.slice(0, 6).map((event, i) => (
                    <ActivityRow key={i} event={event} username={publicData.username || "Vos"} />
                  ))}
                </div>
                {/* Resumen pie */}
                <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: Math.floor(totalXp / 40), l: "partidos" },
                    { v: Object.keys(comments).length, l: "opiniones" },
                    { v: unlockedCt, l: "logros" },
                  ].map(s => (
                    <div key={s.l} className="bg-white/4 rounded-xl py-2">
                      <p className="text-emerald-400 font-black text-lg leading-none">{s.v}</p>
                      <p className="text-gray-600 text-[9px] mt-0.5">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Modal eliminar foto */}
      {showDeletePhoto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass w-full max-w-sm p-6 rounded-3xl text-center">
            <p className="display text-2xl text-white mb-2">ELIMINAR FOTO</p>
            <p className="text-gray-500 text-sm mb-5">Tu perfil volvera a mostrar el avatar con tus iniciales.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeletePhoto(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl transition">Cancelar</button>
              <button onClick={deletePhoto} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl transition">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <LevelModal
        open={showLevelModal}
        onClose={() => setShowLevelModal(false)}
        level={level}
        currentXp={currentXp}
        neededXp={neededXp}
        pct={pct}
        totalXp={totalXp}
      />

      {/* Modal cashback */}
      {cashbackModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
          onClick={() => setCashbackModal(null)}>
          <div className="relative w-full max-w-sm glass rounded-3xl overflow-hidden shadow-2xl"
            style={{ border: "1px solid rgba(245,158,11,0.3)" }}
            onClick={e => e.stopPropagation()}>

            {/* Header dorado */}
            <div className="px-6 pt-6 pb-5 text-center"
              style={{ background: "linear-gradient(135deg, #1c1200, #0a0a1a)" }}>
              <div className="absolute top-0 left-6 right-6 h-px"
                style={{ background: "linear-gradient(90deg, transparent, #f59e0b, transparent)" }} />
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-3"
                style={{ background: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.4)" }}>
                CASH
              </div>
              <p className="display text-2xl text-white tracking-wide">RECOMPENSA</p>
              <p className="text-amber-400 font-black text-3xl mt-1">1 reserva gratis</p>
              <p className="text-xs text-gray-500 mt-1">Nivel {cashbackModal.level} desbloqueado</p>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500 text-center mb-4">
                Elegis como recibir tu recompensa:
              </p>

              {/* Opcion 1: Puntos */}
              <button
                onClick={async () => {
                  const newPuntos = (privateData?.puntos || 0) + cashbackModal.amount;
                  await update(ref(db, `private_user_data/${currentUser.uid}`), {
                    puntos: newPuntos,
                    lastActivityTs: Date.now(),
                    [`cashbackClaimed_${cashbackModal.level}`]: "points",
                    [`cashbackPending/${cashbackModal.level}`]: null,
                  });
                  showToast("Reserva gratis agregada a tu billetera");
                  setCashbackModal(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border transition hover:brightness-110 text-left"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}>
                  PTS
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Agregar a mi billetera</p>
                  <p className="text-xs text-gray-500">Se suman como puntos para reservas futuras</p>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Maximo {fmt(MAX_POINTS_PER_BOOKING)} usables por reserva (25%)
                  </p>
                </div>
              </button>

              {/* Opcion 2: MercadoPago */}
              <button
                onClick={async () => {
                  await update(ref(db, `private_user_data/${currentUser.uid}`), {
                    [`cashbackClaimed_${cashbackModal.level}`]: "mp_pending",
                    [`cashbackPending/${cashbackModal.level}`]: null,
                    [`cashbackPendingMP_${cashbackModal.level}`]: {
                      amount: cashbackModal.amount,
                      requestedAt: Date.now(),
                    },
                  });
                  showToast("Solicitud enviada. Te contactamos en 48hs.");
                  setCashbackModal(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border transition hover:brightness-110 text-left"
                style={{ background: "rgba(0,157,255,0.08)", border: "1px solid rgba(0,157,255,0.25)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs text-white"
                  style={{ background: "rgba(0,157,255,0.15)", border: "2px solid rgba(0,157,255,0.4)" }}>
                  MP
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Recibir por MercadoPago</p>
                  <p className="text-xs text-gray-500">Te enviamos el dinero en 24-48 horas habiles</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(0,157,255,0.8)" }}>
                    Requiere cuenta MP verificada
                  </p>
                </div>
              </button>

              <button onClick={() => setCashbackModal(null)}
                className="w-full py-2.5 text-xs text-gray-600 hover:text-gray-400 transition">
                Decidir mas tarde
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast show={toast.show} message={toast.message} />
    </Layout>
  );
}
