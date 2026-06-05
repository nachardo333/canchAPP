// src/components/Layout.jsx
import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import GrassBackground from "./GrassBackground";

const OWNER_UID = "zShdRhpBbVOmPSN9BqVvLH1cpWd2";

const THEMES = {
  emerald: { accent1: "#34d399" },
  sky:     { accent1: "#38bdf8" },
  amber:   { accent1: "#f59e0b" },
};

const BACKGROUNDS = {
  default: "linear-gradient(45deg, #020f0c, #0a001f, #001122)",
  nebula:  "linear-gradient(45deg, #3a004f, #001242)",
  sunset:  "linear-gradient(45deg, #4f0000, #5c3b00)",
  ocean:   "linear-gradient(45deg, #003a4f, #00421e)",
};

const NAV_ITEMS = [
  {
    key: "home", to: "/", label: "Inicio",
    icon: <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />,
  },
  {
    key: "bookings", to: "/reservas", label: "Reservas",
    icon: <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />,
  },
  {
    key: "community", to: "/comunidad", label: "Comunidad",
    icon: <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 15v-3a2 2 0 00-2-2H6a2 2 0 00-2 2v3H2v-3a4 4 0 014-4h8a4 4 0 014 4v3h-2z" />,
  },
  {
    key: "profile", to: "/perfil", label: "Perfil",
    icon: <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />,
  },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState("");
  const [username, setUsername] = useState("");
  const [points, setPoints] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú al click afuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auth + tema + fondo + avatar
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) { setAvatar(""); setUsername(""); setPoints(0); return; }

      // Avatar y username desde DB
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

      // Tema y fondo
      const privSnap = await get(ref(db, `private_user_data/${u.uid}`));
      if (!privSnap.exists()) return;
      const d = privSnap.val();

      // Detectar admin de complejo
      if (d.role === "admin" || d.managedComplexId) setIsAdmin(true);
      if (d.theme && THEMES[d.theme]) {
        document.documentElement.style.setProperty("--clr-green-lt", THEMES[d.theme].accent1);
      }
      const bg = BACKGROUNDS[d.background] || BACKGROUNDS.default;
      const el = document.getElementById("animated-bg");
      if (el) {
        el.style.backgroundImage = bg;
        if (d.background && d.background !== "default") {
          el.style.backgroundSize = "100% 100%";
          el.style.animation = "none";
        } else {
          el.style.backgroundSize = "400% 400%";
          el.style.animation = "bg-shift 20s ease infinite";
        }
      }
    });
    return () => unsub();
  }, []);

  const menuItems = [
    { to: "/perfil",        label: "Mi Perfil",        emoji: "👤" },
    { to: "/reservas",      label: "Mis Reservas",      emoji: "📅" },
    { to: "/puntos",        label: "Tienda de Puntos",  emoji: "✨" },
    { to: "/configuracion", label: "Configuración",     emoji: "⚙️" },
    { to: "/faq",           label: "Ayuda y Soporte",   emoji: "❓" },
    ...(user?.uid === OWNER_UID ? [
      { to: "/owner",       label: "Panel Owner",       emoji: "👑" },
      { to: "/admin/leads", label: "Panel de Leads",    emoji: "📋" },
    ] : []),
    // Panel admin para dueños de complejos (se chequea al cargar)
    ...(isAdmin ? [
      { to: "/panel-admin", label: "Panel Admin",       emoji: "🏟️" },
    ] : []),
  ];

  return (
    <>
      <GrassBackground />
      <div id="animated-bg" className="animated-bg" />
      <div className="ambient-orb" />

      {/* Top bar con avatar — oculto en inicio donde Header ya lo muestra */}
      {user && location.pathname !== "/" && location.pathname !== "/padel" && (
        <div className="fixed top-0 right-0 z-40 p-4" ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} className="relative">
            <img src={avatar} alt="avatar"
              className="h-10 w-10 rounded-full border-2 border-emerald-500/40 hover:border-emerald-400 transition object-cover shadow-lg"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${username.charAt(0)}&background=059669&color=fff`; }} />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#05020c] pulse-dot" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 glass rounded-2xl py-2 shadow-2xl z-50 fade-up border border-emerald-500/10">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

              {/* User info */}
              <div className="px-4 py-3 border-b border-white/5 mb-1">
                <div className="flex items-center gap-3">
                  <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover border border-emerald-500/30 flex-shrink-0"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${username.charAt(0)}&background=059669&color=fff`; }} />
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{username}</p>
                    <Link to="/puntos" onClick={() => setMenuOpen(false)}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 transition">
                      ✨ {points} puntos
                    </Link>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              {menuItems.map((item) => (
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
      )}

      <main className="pb-20">{children}</main>

      {/* Bottom Nav */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center z-40">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <Link key={item.key} to={item.to}
              className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${isActive ? "text-emerald-400 scale-110" : "text-gray-500 hover:text-gray-300"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                {item.icon}
              </svg>
              <span className={`text-xs font-semibold ${isActive ? "text-emerald-400" : ""}`}>{item.label}</span>
              {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400 pulse-dot" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
