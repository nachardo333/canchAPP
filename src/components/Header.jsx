// src/components/Header.jsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { auth, db } from "../firebase";

export default function Header({ sport = "futbol", onLogin }) {
  const [user, setUser] = useState(null);
  const [points, setPoints] = useState(0);
  const [avatar, setAvatar] = useState("");
  const [username, setUsername] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (u) {
        // Cargar avatar y username desde DB (no desde Auth, para que base64 funcione)
        const pubSnap = await get(ref(db, `public_profiles/${u.uid}`));
        if (pubSnap.exists()) {
          const pub = pubSnap.val();
          setAvatar(pub.photoURL || `https://ui-avatars.com/api/?name=${pub.username || u.email.split("@")[0]}&background=059669&color=fff`);
          setUsername(pub.username || u.displayName || u.email.split("@")[0]);
        } else {
          setAvatar(u.photoURL || `https://ui-avatars.com/api/?name=${u.email.split("@")[0]}&background=059669&color=fff`);
          setUsername(u.displayName || u.email.split("@")[0]);
        }

        // Puntos en tiempo real
        onValue(ref(db, `private_user_data/${u.uid}/puntos`), (snap) => {
          if (snap.exists()) setPoints(snap.val());
        });
      } else {
        setAvatar(""); setUsername(""); setPoints(0);
      }
    });
    return () => unsub();
  }, []);

  // Cerrar menú al click afuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex justify-between items-center mb-8">
      {/* Logo + sport tabs */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-baseline gap-0">
          <span className="font-black text-white text-2xl tracking-tight display">CANCH</span>
          <span className="font-black text-emerald-400 text-2xl tracking-tight display">APP</span>
        </Link>
        <div className="glass p-1 rounded-full flex text-sm font-bold">
          <Link to="/" className={`py-1 px-4 rounded-full transition-all ${sport === "futbol" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "text-gray-400 hover:text-white"}`}>
            Fútbol
          </Link>
          <Link to="/padel" className={`py-1 px-4 rounded-full transition-all ${sport === "padel" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "text-gray-400 hover:text-white"}`}>
            Pádel
          </Link>
        </div>
      </div>

      {/* Auth area */}
      {user ? (
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} className="relative flex items-center gap-2">
            <img src={avatar} alt="avatar"
              className="h-10 w-10 rounded-full border-2 border-emerald-500/40 hover:border-emerald-400 transition object-cover"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${username.charAt(0)}&background=059669&color=fff`; }} />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#05020c] pulse-dot" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 glass rounded-2xl py-2 shadow-2xl z-50 fade-up border border-emerald-500/10">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

              {/* User info */}
              <div className="px-4 py-3 text-center border-b border-white/5 mb-1">
                <img src={avatar} alt="" className="h-14 w-14 rounded-full mx-auto mb-2 border-2 border-emerald-500/30 object-cover"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${username.charAt(0)}&background=059669&color=fff`; }} />
                <p className="font-bold text-white text-sm truncate">{username}</p>
                <p className="text-gray-500 text-xs truncate">{user.email}</p>
                <Link to="/puntos" onClick={() => setMenuOpen(false)}
                  className="mt-2 inline-block bg-amber-900/40 border border-amber-700/30 rounded-full px-3 py-1 text-sm font-bold text-amber-400 hover:bg-amber-900/60 transition">
                  ✨ {points} puntos
                </Link>
              </div>

              {/* Menu items */}
              {[
                { to: "/perfil", label: "Mi Perfil", emoji: "👤" },
                { to: "/puntos", label: "Tienda de Puntos", emoji: "✨" },
                { to: "/configuracion", label: "Configuración", emoji: "⚙️" },
                { to: "/faq", label: "Ayuda y Soporte", emoji: "❓" },
                ...(user?.uid === "zShdRhpBbVOmPSN9BqVvLH1cpWd2" ? [{ to: "/admin/leads", label: "Panel de Leads", emoji: "📋" }] : []),
              ].map((item) => (
                <Link key={item.to} to={item.to}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
                  onClick={() => setMenuOpen(false)}>
                  <span className="text-base">{item.emoji}</span>
                  {item.label}
                </Link>
              ))}

              <div className="border-t border-white/5 mt-1 pt-1">
                <button onClick={() => { signOut(auth); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={onLogin}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2 px-5 rounded-xl transition-all text-sm shadow-lg shadow-emerald-900/40">
          Login
        </button>
      )}
    </header>
  );
}
