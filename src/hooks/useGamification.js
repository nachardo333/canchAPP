// src/hooks/useGamification.js
// Sistema de gamificacion de CanchAPP - niveles infinitos
// Regla de oro: XP motiva, cashback solo en hitos cada 5 niveles, siempre sostenible.

import { ref, update, get } from "firebase/database";
import { db } from "../firebase";

// -- XP por accion -------------------------------------------------------------
export const XP_PER_MATCH       = 40;
export const XP_ORGANIZER_BONUS = 25;
export const XP_MVP_BONUS       = 35;
export const XP_FIRST_MATCH     = 60;
export const XP_STREAK_BONUS    = 20;

// -- Frenos financieros --------------------------------------------------------
export const POINTS_EXPIRY_DAYS     = 45;
export const MAX_POINTS_COVERAGE    = 0.25;
export const PRECIO_RESERVA         = 27500;
export const MAX_POINTS_PER_BOOKING = Math.floor(PRECIO_RESERVA * MAX_POINTS_COVERAGE);

// -- Formula XP exponencial ----------------------------------------------------
// XP para subir del nivel N al N+1 = 100 * N^1.5
// N1->2: 100 | N5->6: 1118 | N10->11: 3162 | N50->51: 35355
export function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.5));
}

// Dado XP total, retorna nivel actual + progreso dentro del nivel
export function calcLevel(totalXp) {
  let level = 1;
  let remaining = totalXp || 0;
  while (true) {
    const needed = xpForLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  const needed = xpForLevel(level);
  const pct = Math.min(Math.round((remaining / needed) * 100), 99);
  return { level, currentXp: remaining, neededXp: needed, pct };
}

// -- Cashback cada 5 niveles, escala con 18% de mejora por hito ---------------
// Nivel 5=$800 | 10=$1652 | 15=$2515 | 20=$3540 | 25=$4795...
// Primeros niveles mas generosos para enganchar. Nunca supera 8% de lo ganado.
export function cashbackAtLevel(level) {
  if (level % 5 !== 0) return 0;
  const hito = level / 5;
  // Bonus extra en los primeros 3 hitos para motivar usuarios nuevos
  const baseMultiplier = hito <= 1 ? 800 : hito <= 2 ? 700 : hito <= 3 ? 600 : 400;
  return Math.round(baseMultiplier * hito * Math.pow(1.18, hito - 1));
}

// Retorna info completa de un nivel hito
export function getMilestoneInfo(level) {
  const cashback = cashbackAtLevel(level);
  if (cashback === 0) return null;
  const hito = level / 5;
  return {
    level,
    cashback,
    hito,
    label: hito <= 2 ? "Promesa" :
           hito <= 4 ? "Regular" :
           hito <= 6 ? "Habitual" :
           hito <= 8 ? "Veterano" :
           hito <= 10 ? "Crack" : "Leyenda",
  };
}

// Proximos N hitos desde un nivel dado
export function getNextMilestones(fromLevel, count = 3) {
  const milestones = [];
  let lvl = fromLevel + 1;
  while (milestones.length < count) {
    if (lvl % 5 === 0) milestones.push(getMilestoneInfo(lvl));
    lvl++;
  }
  return milestones;
}

// -- Frenos financieros --------------------------------------------------------
export function checkPointsExpiry(privateData) {
  if (!privateData?.puntos || privateData.puntos <= 0) return privateData;
  const lastActivity = privateData.lastActivityTs || null;
  if (!lastActivity) return privateData; // usuario viejo sin timestamp, no expiramos
  const daysSince = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
  if (daysSince > POINTS_EXPIRY_DAYS) {
    return { ...privateData, puntos: 0, puntosExpired: true };
  }
  return privateData;
}

export function maxPointsForBooking(availablePoints) {
  return Math.min(availablePoints, MAX_POINTS_PER_BOOKING);
}

// -- Procesar partido completado -----------------------------------------------
export async function processMatchCompletion(matchData) {
  const { uid, isOrganizer = false, isMvp = false, isFirstMatch = false, hasStreak = false } = matchData;

  let xpGained = XP_PER_MATCH;
  if (isOrganizer)  xpGained += XP_ORGANIZER_BONUS;
  if (isMvp)        xpGained += XP_MVP_BONUS;
  if (isFirstMatch) xpGained += XP_FIRST_MATCH;
  if (hasStreak)    xpGained += XP_STREAK_BONUS;

  const snap = await get(ref(db, "private_user_data/" + uid));
  if (!snap.exists()) return null;
  const data = snap.val();

  const prevTotalXp = data.totalXp || 0;
  const newTotalXp  = prevTotalXp + xpGained;
  const prevState   = calcLevel(prevTotalXp);
  const newState    = calcLevel(newTotalXp);
  const leveledUp   = newState.level > prevState.level;

  const updates = {
    totalXp:        newTotalXp,
    lastActivityTs: Date.now(),
  };

  const events = [{ type: "xp_gained", amount: xpGained }];

  if (leveledUp) {
    updates.level = newState.level;
    events.push({ type: "level_up", from: prevState.level, to: newState.level });

    // Cashback solo en multiples de 5
    for (let lvl = prevState.level + 1; lvl <= newState.level; lvl++) {
      const cashback = cashbackAtLevel(lvl);
      if (cashback > 0) {
        // NO lo damos automaticamente - guardamos como pendiente para que el usuario elija
        const pending = data.cashbackPending || {};
        updates.cashbackPending = { ...pending, [lvl]: { amount: cashback, unlockedAt: Date.now() } };
        events.push({ type: "cashback_unlocked", level: lvl, amount: cashback });
      }
    }
  }

  await update(ref(db, "private_user_data/" + uid), updates);
  return { xpGained, prevLevel: prevState.level, newLevel: newState.level, leveledUp, events, newTotalXp };
}

// -- Catalogo de trofeos (dinamico - se genera segun nivel) -------------------
const STATIC_TROPHIES = [
  // Actividad
  { id: "first_match",        cat: "Actividad",   name: "Primer Saque",       emoji: "S1", color: "#22c55e",
    desc: "Jugar tu primer partido",               check: (d) => (d.totalXp || 0) >= XP_PER_MATCH },
  { id: "ten_matches",        cat: "Actividad",   name: "De Arranque",        emoji: "10", color: "#f97316",
    desc: "Jugar 10 partidos",                     check: (d) => Math.floor((d.totalXp || 0) / XP_PER_MATCH) >= 10 },
  { id: "fifty_matches",      cat: "Actividad",   name: "Maquina de Jugar",   emoji: "50", color: "#ef4444",
    desc: "Jugar 50 partidos",                     check: (d) => Math.floor((d.totalXp || 0) / XP_PER_MATCH) >= 50 },
  { id: "hundred_matches",    cat: "Actividad",   name: "Centenario",         emoji: "C", color: "#a855f7",
    desc: "Jugar 100 partidos",                    check: (d) => Math.floor((d.totalXp || 0) / XP_PER_MATCH) >= 100 },
  // Social
  { id: "organizer",          cat: "Social",      name: "Organizador",        emoji: "OR", color: "#06b6d4",
    desc: "Organizar tu primer turno",             check: (d) => (d.matchesOrganized || 0) >= 1 },
  { id: "mvp",                cat: "Social",      name: "MVP",                emoji: "MV", color: "#f59e0b",
    desc: "Recibir un voto MVP",                   check: (d) => (d.mvpVotes || 0) >= 1 },
  { id: "good_teammate",      cat: "Social",      name: "Buen Companero",     emoji: "BC", color: "#10b981",
    desc: "3 comentarios positivos",               check: (d, p) => Object.keys(p?.comments || {}).length >= 3 },
  // Puntualidad
  { id: "perfect_attendance", cat: "Puntualidad", name: "Asistencia Perfecta", emoji: "AP", color: "#22c55e",
    desc: "10 partidos sin ausentarse",            check: (d) => (d.perfectAttendance || 0) >= 10 },
];

// Genera trofeos de nivel dinamicamente (cada hito de 5)
function getLevelTrophies(privateData) {
  const trophies = [];
  const { level } = calcLevel(privateData?.totalXp || 0);
  // Mostrar los primeros 6 hitos (nivel 5 al 30) + el actual y siguiente
  const maxToShow = Math.max(30, Math.ceil(level / 5) * 5 + 10);
  for (let lvl = 5; lvl <= maxToShow; lvl += 5) {
    const info = getMilestoneInfo(lvl);
    const hue = Math.min(lvl * 2, 360);
    trophies.push({
      id:       "level_" + lvl,
      cat:      "Nivel",
      name:     "Nivel " + lvl,
      emoji:    lvl <= 10 ? "N" + lvl : lvl <= 25 ? "NV" : "LG",
      color:    lvl <= 10 ? "#84cc16" : lvl <= 20 ? "#38bdf8" : lvl <= 35 ? "#a855f7" : lvl <= 50 ? "#f59e0b" : "#f43f5e",
      desc:     "Llegar al nivel " + lvl,
      check:    (d) => calcLevel(d.totalXp || 0).level >= lvl,
      cashback: info.cashback,
      label:    info.label,
    });
  }
  return trophies;
}

export function getUnlockedTrophies(privateData, publicData) {
  const levelTrophies = getLevelTrophies(privateData);
  const all = [...STATIC_TROPHIES, ...levelTrophies];
  return all.map(t => ({
    ...t,
    unlocked: t.check(privateData || {}, publicData || {}),
  }));
}