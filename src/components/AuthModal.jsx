// src/components/AuthModal.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, db } from "../firebase";
import OnboardingModal from "./OnboardingModal";

export default function AuthModal({ open, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [view, setView] = useState("login");
  const [role, setRole] = useState("user");
  const [loginFeedback, setLoginFeedback] = useState("");
  const [registerFeedback, setRegisterFeedback] = useState("");

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newUser, setNewUser] = useState(null);

  if (!open && !showOnboarding) return null;

  // ?? Chequear si ya complet? onboarding ??????????????????????????
  async function checkOnboarding(user) {
    const snap = await get(ref(db, `private_user_data/${user.uid}/onboardingCompleted`));
    return snap.exists() && snap.val() === true;
  }

  // ?? Login ???????????????????????????????????????????????????????
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginFeedback("");
    const { email, password } = e.target;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.value, password.value);
      if (role === "admin") {
        const snap = await get(ref(db, `private_user_data/${cred.user.uid}`));
        console.log("UID:", cred.user.uid);
        console.log("Snap existe:", snap.exists());
        console.log("Data:", snap.val());
        console.log("managedComplexId:", snap.val()?.managedComplexId);
        console.log("role:", snap.val()?.role);
        if (snap.exists() && (snap.val().managedComplexId || snap.val().role === "admin")) {
          onClose();
          navigate("/panel-admin");
        } else {
          setLoginFeedback("Tu cuenta no tiene un complejo asignado. Contactá a soporte.");
          await signOut(auth);
        }
      } else {
        const completed = await checkOnboarding(cred.user);
        if (!completed) {
          const pubSnap = await get(ref(db, `public_profiles/${cred.user.uid}`));
          if (!pubSnap.exists()) {
            await update(ref(db), {
              [`/public_profiles/${cred.user.uid}/username`]: cred.user.displayName || cred.user.email.split("@")[0],
              [`/public_profiles/${cred.user.uid}/photoURL`]: `https://ui-avatars.com/api/?name=${cred.user.email.split("@")[0]}&background=151523&color=34d399`,
              [`/public_profiles/${cred.user.uid}/hoursPlayedFutbol`]: 0,
              [`/private_user_data/${cred.user.uid}/email`]: cred.user.email,
              [`/private_user_data/${cred.user.uid}/puntos`]: 0,
            });
          }
          setNewUser(cred.user);
          setShowOnboarding(true);
          onClose();
        } else {
          onSuccess?.();
          onClose();
        }
      }
    } catch {
      setLoginFeedback("Email o contraseña incorrectos.");
    }
  };

  // ?? Google ??????????????????????????????????????????????????????
  const handleGoogle = async () => {
    setLoginFeedback("");
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = cred.user;
      const completed = await checkOnboarding(user);

      if (!completed) {
        // Crear perfil b?sico si no existe
        const pubSnap = await get(ref(db, `public_profiles/${user.uid}`));
        if (!pubSnap.exists()) {
          await update(ref(db), {
            [`/public_profiles/${user.uid}/username`]: user.displayName || user.email.split("@")[0],
            [`/public_profiles/${user.uid}/photoURL`]: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || "U"}&background=151523&color=34d399`,
            [`/public_profiles/${user.uid}/hoursPlayedFutbol`]: 0,
            [`/private_user_data/${user.uid}/email`]: user.email,
            [`/private_user_data/${user.uid}/puntos`]: 0,
          });
        }
        setNewUser(user);
        setShowOnboarding(true);
        onClose(); // cerrar el modal de login
      } else {
        onSuccess?.();
        onClose();
      }
    } catch {
      setLoginFeedback("Error al iniciar sesión con Google.");
    }
  };

  // ?? Register ????????????????????????????????????????????????????
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterFeedback("");
    const username = e.target.username.value.trim();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirm = e.target["confirm-password"].value;

    if (password !== confirm) { setRegisterFeedback("Las contraseñas no coinciden."); return; }
    if (password.length < 6) { setRegisterFeedback("Mínimo 6 caracteres."); return; }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await updateProfile(cred.user, { displayName: username });
      await update(ref(db), {
        [`/public_profiles/${uid}/username`]: username,
        [`/public_profiles/${uid}/photoURL`]: `https://ui-avatars.com/api/?name=${username}&background=151523&color=34d399`,
        [`/public_profiles/${uid}/hoursPlayedFutbol`]: 0,
        [`/private_user_data/${uid}/email`]: email,
        [`/private_user_data/${uid}/puntos`]: 0,
      });

      setNewUser(cred.user);
      setShowOnboarding(true);
      onClose();
    } catch (err) {
      setRegisterFeedback(
        err.code === "auth/email-already-in-use" ? "Ese email ya está en uso." : "Error al registrar."
      );
    }
  };

  // ?? Onboarding completado ???????????????????????????????????????
  function handleOnboardingComplete(displayName) {
    setShowOnboarding(false);
    setNewUser(null);
    onSuccess?.();
  }

  return (
    <>
      {/* Onboarding modal */}
      {showOnboarding && newUser && (
        <OnboardingModal user={newUser} onComplete={handleOnboardingComplete} />
      )}

      {/* Auth modal */}
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="glass w-full max-w-md p-8 rounded-3xl relative fade-up">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl leading-none transition">&times;</button>

            {/* ── LOGIN ─────────────────────────────────── */}
            {view === "login" && (
              <div>
                <p className="display text-4xl text-white mb-1">BIENVENIDO</p>
                <p className="text-gray-500 text-sm mb-6">Iniciá sesión para reservar canchas</p>

                {/* Role toggle */}
                <div className="relative w-full p-1 bg-black/40 rounded-full flex mb-5 border border-white/5">
                  <div className="absolute top-1 left-1 h-[calc(100%-0.5rem)] w-1/2 bg-emerald-600 rounded-full transition-transform duration-300"
                    style={{ transform: role === "admin" ? "translateX(100%)" : "translateX(0)" }} />
                  {["user", "admin"].map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`relative z-10 w-1/2 py-2 text-sm font-bold transition-colors capitalize ${role === r ? "text-white" : "text-gray-500"}`}>
                      {r === "user" ? "Jugador" : "Administrador"}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <input name="email" type="email" placeholder="Email" required
                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600" />
                  <input name="password" type="password" placeholder="Contraseña" required
                    className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600" />
                  <button type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all mt-2 shadow-lg shadow-emerald-900/40">
                    Ingresar
                  </button>
                  {loginFeedback && <p className="text-red-400 text-xs text-center">{loginFeedback}</p>}
                </form>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-gray-600 text-xs">o</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <button onClick={handleGoogle}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </button>

                <p className="text-center mt-5 text-sm text-gray-500">
                  ¿No tenés cuenta?{" "}
                  <button onClick={() => { setView("register"); setLoginFeedback(""); }}
                    className="text-emerald-400 font-semibold hover:underline">Registrate</button>
                </p>
              </div>
            )}

            {/* ── REGISTER ──────────────────────────────── */}
            {view === "register" && (
              <div>
                <p className="display text-4xl text-white mb-1">CREAR CUENTA</p>
                <p className="text-gray-500 text-sm mb-6">Reservá canchas y ganá puntos jugando</p>
                <form onSubmit={handleRegister} className="space-y-3">
                  {[
                    { name: "username", type: "text", placeholder: "Apodo (público)" },
                    { name: "email", type: "email", placeholder: "Email" },
                    { name: "password", type: "password", placeholder: "Contraseña (mín. 6 caracteres)" },
                    { name: "confirm-password", type: "password", placeholder: "Confirmar contraseña" },
                  ].map((f) => (
                    <input key={f.name} name={f.name} type={f.type} placeholder={f.placeholder} required
                      className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition placeholder-gray-600" />
                  ))}
                  <button type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all mt-2 shadow-lg shadow-emerald-900/40">
                    Crear Cuenta
                  </button>
                  {registerFeedback && <p className="text-red-400 text-xs text-center">{registerFeedback}</p>}
                </form>
                <p className="text-center mt-5 text-sm text-gray-500">
                  ¿Ya tenés cuenta?{" "}
                  <button onClick={() => { setView("login"); setRegisterFeedback(""); }}
                    className="text-emerald-400 font-semibold hover:underline">Iniciá sesión</button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
