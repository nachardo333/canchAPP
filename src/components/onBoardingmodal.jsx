// src/components/OnboardingModal.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ref, update } from "firebase/database";
import { db } from "../firebase";

const ZONES = ["La Boca", "Avellaneda", "Nuñez", "Palermo", "Flores", "Caballito", "Belgrano", "San Telmo", "Villa Urquiza", "Otra"];
const LEVELS = ["Principiante", "Intermedio", "Avanzado"];
const POSITIONS = ["ARQUERO", "DEFENSOR", "MEDIOCAMPISTA", "DELANTERO"];
const PADEL_SIDES = ["DRIVE", "REVÉS"];

export default function OnboardingModal({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaNac, setFechaNac] = useState("");

  // Paso 2
  const [deporte, setDeporte] = useState("futbol"); // "futbol" | "padel" | "ambos"
  const [posicion, setPosicion] = useState("MEDIOCAMPISTA");
  const [ladoPadel, setLadoPadel] = useState("DRIVE");
  const [nivel, setNivel] = useState("Intermedio");

  // Paso 3
  const [zona, setZona] = useState("Palermo");
  const [notifMatch, setNotifMatch] = useState(true);
  const [notifInvite, setNotifInvite] = useState(true);

  const totalSteps = 3;

  async function handleFinish() {
    setSaving(true);
    try {
      const uid = user.uid;
      const displayName = nombre.trim() || user.displayName || user.email.split("@")[0];
      const updates = {
        [`/public_profiles/${uid}/username`]: displayName,
        [`/public_profiles/${uid}/apellido`]: apellido.trim(),
        [`/public_profiles/${uid}/roleFutbol`]: posicion,
        [`/public_profiles/${uid}/rolePadel`]: ladoPadel,
        [`/public_profiles/${uid}/nivel`]: nivel,
        [`/public_profiles/${uid}/deporte`]: deporte,
        [`/public_profiles/${uid}/zona`]: zona,
        [`/public_profiles/${uid}/hoursPlayedFutbol`]: 0,
        [`/public_profiles/${uid}/hoursPlayedPadel`]: 0,
        [`/private_user_data/${uid}/telefono`]: telefono.trim(),
        [`/private_user_data/${uid}/fechaNac`]: fechaNac,
        [`/private_user_data/${uid}/zona`]: zona,
        [`/private_user_data/${uid}/notif_match`]: notifMatch,
        [`/private_user_data/${uid}/notif_invite`]: notifInvite,
        [`/private_user_data/${uid}/notif_cancel`]: true,
        [`/private_user_data/${uid}/onboardingCompleted`]: true,
      };
      await update(ref(db), updates);
      onComplete(displayName);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const stepVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <motion.div
        className="glass w-full max-w-md rounded-3xl overflow-hidden relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <p className="display text-3xl text-white">¡HOLA, BIENVENIDO!</p>
          <p className="text-gray-500 text-sm mt-1">Configuremos tu perfil en 3 pasos</p>

          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 flex-shrink-0 ${
                  s < step ? "bg-emerald-600 text-white" :
                  s === step ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40" :
                  "bg-white/10 text-gray-500"
                }`}>
                  {s < step ? "✓" : s}
                </div>
                <div className="flex-col hidden sm:flex">
                  <p className={`text-xs font-bold ${s === step ? "text-emerald-400" : "text-gray-600"}`}>
                    {s === 1 ? "Identidad" : s === 2 ? "Deporte" : "Preferencias"}
                  </p>
                </div>
                {s < 3 && <div className={`flex-1 h-px transition-all duration-500 ${s < step ? "bg-emerald-500" : "bg-white/10"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-8 pb-8 min-h-[320px]">
          <AnimatePresence mode="wait">

            {/* ── Paso 1: Identidad ─────────────────────────────────── */}
            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.25 }}>
                <p className="text-xs text-gray-500 mb-4 mt-2 bg-blue-900/20 border border-blue-700/20 rounded-xl px-3 py-2">
                  ℹ️ Estos datos son necesarios para tus reservas. Podés modificarlos desde tu perfil.
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                      <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                        placeholder="Lionel" maxLength={30}
                        className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Apellido</label>
                      <input value={apellido} onChange={(e) => setApellido(e.target.value)}
                        placeholder="Messi" maxLength={30}
                        className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                    <input value={telefono} onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+54 11 1234-5678" type="tel"
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Fecha de nacimiento</label>
                    <input value={fechaNac} onChange={(e) => setFechaNac(e.target.value)}
                      type="date" max={new Date().toISOString().split("T")[0]}
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm outline-none transition [color-scheme:dark]" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Paso 2: Perfil deportivo ──────────────────────────── */}
            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.25 }}>
                <div className="space-y-4 mt-2">
                  {/* Deporte */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">¿Qué deporte jugás?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "futbol", label: "⚽ Fútbol" },
                        { key: "padel", label: "🎾 Pádel" },
                        { key: "ambos", label: "🏆 Ambos" },
                      ].map((d) => (
                        <button key={d.key} onClick={() => setDeporte(d.key)}
                          className={`py-2.5 rounded-xl text-xs font-bold transition border ${
                            deporte === d.key
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          }`}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Posición fútbol */}
                  {(deporte === "futbol" || deporte === "ambos") && (
                    <div>
                      <label className="text-xs text-gray-500 mb-2 block">Posición en fútbol</label>
                      <div className="grid grid-cols-2 gap-2">
                        {POSITIONS.map((p) => (
                          <button key={p} onClick={() => setPosicion(p)}
                            className={`py-2 rounded-xl text-xs font-bold transition border ${
                              posicion === p
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                            }`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lado pádel */}
                  {(deporte === "padel" || deporte === "ambos") && (
                    <div>
                      <label className="text-xs text-gray-500 mb-2 block">Lado en pádel</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PADEL_SIDES.map((s) => (
                          <button key={s} onClick={() => setLadoPadel(s)}
                            className={`py-2 rounded-xl text-xs font-bold transition border ${
                              ladoPadel === s
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nivel */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Tu nivel</label>
                    <div className="grid grid-cols-3 gap-2">
                      {LEVELS.map((l) => (
                        <button key={l} onClick={() => setNivel(l)}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            nivel === l
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Paso 3: Preferencias ──────────────────────────────── */}
            {step === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.25 }}>
                <div className="space-y-4 mt-2">
                  {/* Zona */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">¿En qué zona de Buenos Aires jugás más?</label>
                    <div className="flex flex-wrap gap-2">
                      {ZONES.map((z) => (
                        <button key={z} onClick={() => setZona(z)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                            zona === z
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          }`}>
                          {z}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notificaciones */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Notificaciones</label>
                    <div className="space-y-2">
                      {[
                        { key: "match", label: "⚽ Recordatorio de partido", value: notifMatch, set: setNotifMatch },
                        { key: "invite", label: "🎟️ Invitaciones de amigos", value: notifInvite, set: setNotifInvite },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center justify-between glass rounded-xl px-4 py-3">
                          <span className="text-sm text-gray-300">{n.label}</span>
                          <button onClick={() => n.set(!n.value)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${n.value ? "bg-emerald-600" : "bg-gray-700"}`}>
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${n.value ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Puntos de bienvenida */}
                  <div className="bg-amber-900/20 border border-amber-700/20 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <p className="text-white font-bold text-sm">¡1000 puntos de bienvenida!</p>
                      <p className="text-gray-500 text-xs">Ya están acreditados en tu cuenta.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer con botones */}
        <div className="px-8 pb-8 flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition text-sm">
              ← Atrás
            </button>
          )}
          {step < totalSteps ? (
            <button onClick={() => setStep(step + 1)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-3 rounded-2xl transition display tracking-wider">
              CONTINUAR →
            </button>
          ) : (
            <button onClick={handleFinish} disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition display tracking-wider">
              {saving ? "GUARDANDO..." : "¡LISTO, A JUGAR! ⚽"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
