// src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";

function Toast({ message, show }) {
  return (
    <div className={`fixed top-5 right-5 glass border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 z-50 transition-all duration-500 ${show ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"}`}>
      <span className="text-emerald-400 text-xl">✅</span>
      <span className="text-white font-semibold text-sm">{message}</span>
    </div>
  );
}

function SettingRow({ icon, label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xl w-8 text-center">{icon}</span>
        <div>
          <p className="text-white font-semibold text-sm">{label}</p>
          {description && <p className="text-gray-600 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${value ? "bg-emerald-600" : "bg-gray-700"}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${value ? "translate-x-7" : "translate-x-1"}`} />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [privateData, setPrivateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "" });

  // Password change
  const [showPassForm, setShowPassForm] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Notifications settings
  const [notifMatch, setNotifMatch] = useState(true);
  const [notifInvite, setNotifInvite] = useState(true);
  const [notifCancel, setNotifCancel] = useState(true);

  // Privacy
  const [profilePublic, setProfilePublic] = useState(true);
  const [showHours, setShowHours] = useState(true);

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) { navigate("/"); return; }
      setCurrentUser(user);
      const snap = await get(ref(db, `private_user_data/${user.uid}`));
      if (snap.exists()) {
        const d = snap.val();
        setPrivateData(d);
        setNotifMatch(d.notif_match !== false);
        setNotifInvite(d.notif_invite !== false);
        setNotifCancel(d.notif_cancel !== false);
        setProfilePublic(d.profilePublic !== false);
        setShowHours(d.showHours !== false);
      }
      setLoading(false);
    });
  }, []);

  async function saveSetting(key, value) {
    await update(ref(db, `private_user_data/${currentUser.uid}`), { [key]: value });
  }

  async function changePassword() {
    if (newPass !== confirmPass) { showToast("Las contraseñas no coinciden."); return; }
    if (newPass.length < 6) { showToast("Mínimo 6 caracteres."); return; }
    setChangingPass(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPass);
      setShowPassForm(false);
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      showToast("Contraseña actualizada ✅");
    } catch (err) {
      if (err.code === "auth/wrong-password") showToast("Contraseña actual incorrecta.");
      else showToast("Error al cambiar contraseña.");
    } finally {
      setChangingPass(false);
    }
  }

  const isGoogleUser = currentUser?.providerData?.[0]?.providerId === "google.com";

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Cargando...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-2xl pb-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="display text-4xl text-white tracking-wide">⚙️ CONFIGURACIÓN</p>
        </div>

        <div className="space-y-4">

          {/* ── Cuenta ─────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            <p className="display text-lg text-white mb-2 tracking-wide">CUENTA</p>

            <SettingRow icon="📧" label="Email" description={currentUser?.email}>
              <span className="text-xs text-gray-600 bg-white/5 px-2 py-1 rounded-lg">
                {isGoogleUser ? "Google" : "Email"}
              </span>
            </SettingRow>

            <SettingRow icon="👤" label="Mi perfil" description="Ver y editar tu perfil público">
              <Link to="/perfil" className="text-xs text-emerald-400 font-bold hover:underline">Ver →</Link>
            </SettingRow>

            {!isGoogleUser && (
              <SettingRow icon="🔑" label="Cambiar contraseña" description="Actualizá tu contraseña de acceso">
                <button onClick={() => setShowPassForm(!showPassForm)}
                  className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-xl transition">
                  {showPassForm ? "Cancelar" : "Cambiar"}
                </button>
              </SettingRow>
            )}

            {showPassForm && !isGoogleUser && (
              <div className="mt-3 space-y-2 bg-white/3 rounded-2xl p-4">
                {[
                  { val: currentPass, set: setCurrentPass, ph: "Contraseña actual", type: "password" },
                  { val: newPass, set: setNewPass, ph: "Nueva contraseña", type: "password" },
                  { val: confirmPass, set: setConfirmPass, ph: "Confirmar nueva contraseña", type: "password" },
                ].map((f) => (
                  <input key={f.ph} type={f.type} value={f.val} onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm outline-none placeholder-gray-600" />
                ))}
                <button onClick={changePassword} disabled={changingPass}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm display tracking-wider">
                  {changingPass ? "GUARDANDO..." : "GUARDAR CONTRASEÑA"}
                </button>
              </div>
            )}
          </div>

          {/* ── Notificaciones ─────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
            <p className="display text-lg text-white mb-2 tracking-wide">NOTIFICACIONES</p>

            <SettingRow icon="⚽" label="Recordatorio de partido" description="2 horas antes del partido">
              <Toggle value={notifMatch} onChange={(v) => { setNotifMatch(v); saveSetting("notif_match", v); }} />
            </SettingRow>
            <SettingRow icon="🎟️" label="Invitaciones" description="Cuando alguien te invita a un partido">
              <Toggle value={notifInvite} onChange={(v) => { setNotifInvite(v); saveSetting("notif_invite", v); }} />
            </SettingRow>
            <SettingRow icon="❌" label="Cancelaciones" description="Cuando un jugador cancela en tu partido">
              <Toggle value={notifCancel} onChange={(v) => { setNotifCancel(v); saveSetting("notif_cancel", v); }} />
            </SettingRow>
          </div>

          {/* ── Privacidad ─────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            <p className="display text-lg text-white mb-2 tracking-wide">PRIVACIDAD</p>

            <SettingRow icon="👁️" label="Perfil público" description="Otros jugadores pueden ver tu perfil">
              <Toggle value={profilePublic} onChange={(v) => { setProfilePublic(v); saveSetting("profilePublic", v); }} />
            </SettingRow>
            <SettingRow icon="⏱️" label="Mostrar horas jugadas" description="Visible en tu perfil y en comunidad">
              <Toggle value={showHours} onChange={(v) => { setShowHours(v); saveSetting("showHours", v); }} />
            </SettingRow>
          </div>

          {/* ── Puntos ─────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            <p className="display text-lg text-white mb-2 tracking-wide">PUNTOS</p>

            <SettingRow icon="✨" label="Tus puntos" description={`${privateData?.puntos || 0} puntos disponibles`}>
              <Link to="/puntos" className="text-xs font-bold bg-amber-900/50 border border-amber-700/30 text-amber-400 px-3 py-1.5 rounded-xl hover:bg-amber-900/70 transition">
                Comprar →
              </Link>
            </SettingRow>
          </div>

          {/* ── App ────────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gray-500/30 to-transparent" />
            <p className="display text-lg text-white mb-2 tracking-wide">APP</p>

            <SettingRow icon="❓" label="Ayuda y soporte" description="Preguntas frecuentes">
              <Link to="/faq" className="text-xs text-emerald-400 font-bold hover:underline">Ver →</Link>
            </SettingRow>
            <SettingRow icon="📋" label="Versión" description="CanchAPP v1.0.0">
              <span className="text-xs text-gray-600">v1.0.0</span>
            </SettingRow>
          </div>

          {/* ── Cerrar sesión ───────────────────────────────────────── */}
          <button onClick={() => signOut(auth).then(() => navigate("/"))}
            className="w-full glass rounded-3xl p-4 flex items-center justify-center gap-3 text-red-400 hover:bg-red-900/20 border border-red-900/20 hover:border-red-700/30 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            <span className="font-bold display tracking-wider">CERRAR SESIÓN</span>
          </button>

        </div>
      </div>

      <Toast show={toast.show} message={toast.message} />
    </Layout>
  );
}
