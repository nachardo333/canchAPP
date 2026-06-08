// src/pages/OwnerPanel.jsx — Panel exclusivo del owner (vos)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import { motion } from "framer-motion";

const OWNER_UID = "zShdRhpBbVOmPSN9BqVvLH1cpWd2";

function StatCard({ icon, label, value, color = "emerald" }) {
  const colors = {
    emerald: "bg-emerald-900/30 border-emerald-700/20 text-emerald-400",
    blue:    "bg-blue-900/30 border-blue-700/20 text-blue-400",
    amber:   "bg-amber-900/30 border-amber-700/20 text-amber-400",
    purple:  "bg-purple-900/30 border-purple-700/20 text-purple-400",
    red:     "bg-red-900/30 border-red-700/20 text-red-400",
  };
  return (
    <div className={`rounded-2xl p-5 border ${colors[color]} flex items-center gap-4`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">{label}</p>
        <p className="text-white font-black text-2xl leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function OwnerPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Data
  const [complexes, setComplexes] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== OWNER_UID) { navigate("/"); return; }

      // Complejos
      const cSnap = await get(ref(db, "complexes"));
      if (cSnap.exists()) {
        const data = cSnap.val();
        const list = Object.entries(data).map(([id, c]) => {
          const courts = Object.values(c.courts || {});
          const totalSlots = courts.reduce((acc, court) => acc + Object.keys(court.availableSlots || {}).length, 0);
          const totalPlayersC = courts.reduce((acc, court) =>
            acc + Object.values(court.availableSlots || {}).reduce((a, s) => a + (s.playersJoined || 0), 0), 0);
          return { id, ...c, courtCount: courts.length, totalSlots, totalPlayers: totalPlayersC };
        });
        setComplexes(list);
        setTotalPlayers(list.reduce((acc, c) => acc + c.totalPlayers, 0));
      }

      // Usuarios
      const uSnap = await get(ref(db, "public_profiles"));
      if (uSnap.exists()) {
        setUsers(Object.entries(uSnap.val()).map(([uid, u]) => ({ uid, ...u })));
      }

      // Leads
      const lSnap = await get(ref(db, "leads"));
      if (lSnap.exists()) {
        const list = Object.entries(lSnap.val()).map(([id, l]) => ({ id, ...l }));
        setLeads(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      }

      // Reservas totales
      const usersSnap = await get(ref(db, "users"));
      if (usersSnap.exists()) {
        let count = 0;
        Object.values(usersSnap.val()).forEach(u => {
          count += Object.keys(u.bookings || {}).length;
        });
        setTotalBookings(count);
      }

      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#05020c] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const TABS = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "complexes", label: "Complejos", icon: "🏟️" },
    { key: "users", label: "Usuarios", icon: "👥" },
    { key: "leads", label: "Leads", icon: "📋", badge: leads.filter(l => l.status === "nuevo").length },
  ];

  return (
    <div className="min-h-screen bg-[#05020c] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#080614] border-r border-white/5 flex flex-col fixed h-full z-40">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-white text-lg">C</div>
            <div>
              <p className="font-black text-white text-sm leading-none">CANCHAPP</p>
              <p className="text-amber-400 text-xs font-bold">OWNER PANEL</p>
            </div>
          </div>

          <nav className="space-y-1">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.key ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}>
                <span>{tab.icon}</span>
                <span className="flex-grow text-left">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">{tab.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5 space-y-2">
          <button onClick={() => navigate("/admin/leads")}
            className="w-full text-left text-gray-500 hover:text-white text-sm font-bold transition">
            📋 Panel de Leads
          </button>
          <button onClick={() => navigate("/")}
            className="w-full text-left text-gray-500 hover:text-white text-sm font-bold transition">
            ← Volver a la app
          </button>
          <button onClick={() => signOut(auth).then(() => navigate("/"))}
            className="w-full text-left text-red-500/60 hover:text-red-400 text-sm font-bold transition">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">

        {/* ── DASHBOARD ──────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white">Dashboard Global</h1>
              <p className="text-gray-500 text-sm mt-1">Vista general de toda la plataforma</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon="🏟️" label="Complejos" value={complexes.length} color="emerald" />
              <StatCard icon="👥" label="Usuarios" value={users.length} color="blue" />
              <StatCard icon="📅" label="Reservas totales" value={totalBookings} color="amber" />
              <StatCard icon="⚽" label="Jugadores activos" value={totalPlayers} color="purple" />
            </div>

            {/* Leads nuevos */}
            {leads.filter(l => l.status === "nuevo").length > 0 && (
              <div className="bg-amber-900/20 border border-amber-700/20 rounded-3xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-black text-amber-400">🆕 Leads nuevos sin revisar</p>
                  <button onClick={() => setActiveTab("leads")} className="text-xs text-amber-400 hover:underline">Ver todos →</button>
                </div>
                <div className="space-y-2">
                  {leads.filter(l => l.status === "nuevo").slice(0, 3).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="font-bold text-white text-sm">{lead.complejo}</p>
                        <p className="text-gray-500 text-xs">{lead.nombre} · {lead.telefono}</p>
                      </div>
                      <p className="text-xs text-gray-600">
                        {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("es-ES") : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complejos overview */}
            <div className="bg-white/3 border border-white/5 rounded-3xl p-6">
              <h3 className="font-black text-white text-lg mb-4">Complejos activos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {complexes.map(c => (
                  <div key={c.id} className="bg-white/5 rounded-2xl p-4">
                    <p className="font-bold text-white text-sm truncate">{c.name}</p>
                    <p className="text-emerald-400 text-xs mt-0.5">📍 {c.zone}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>⚽ {c.courtCount} canchas</span>
                      <span>👤 {c.totalPlayers} jugadores</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLEJOS ──────────────────────────────────────────────── */}
        {activeTab === "complexes" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white">Complejos</h1>
              <p className="text-gray-500 text-sm mt-1">{complexes.length} complejos en la plataforma</p>
            </div>
            <div className="space-y-4">
              {complexes.map(c => (
                <div key={c.id} className="bg-white/3 border border-white/5 rounded-3xl p-5 flex items-center gap-5 hover:border-emerald-500/20 transition">
                  <img src={c.image || "https://placehold.co/80x80/0a2a1a/34d399?text=🏟️"}
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" alt="" />
                  <div className="flex-grow min-w-0">
                    <p className="font-black text-white text-lg">{c.name}</p>
                    <p className="text-gray-500 text-sm">📍 {c.zone} · {c.address}</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-emerald-400 font-bold">⚽ {c.courtCount} canchas</span>
                      <span className="text-blue-400 font-bold">🕐 {c.totalSlots} slots</span>
                      <span className="text-amber-400 font-bold">👤 {c.totalPlayers} jugadores</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                      c.totalPlayers > 0 ? "bg-emerald-900/40 text-emerald-400 border-emerald-700/30" : "bg-white/5 text-gray-500 border-white/10"
                    }`}>
                      {c.totalPlayers > 0 ? "🟢 Activo" : "⚫ Sin actividad"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── USUARIOS ───────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white">Usuarios</h1>
              <p className="text-gray-500 text-sm mt-1">{users.length} usuarios registrados</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-3xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                      <th className="pb-3">Usuario</th>
                      <th className="pb-3">Deporte</th>
                      <th className="pb-3">Nivel</th>
                      <th className="pb-3">Zona</th>
                      <th className="pb-3">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.uid} className="hover:bg-white/3 transition">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.username}&background=151523&color=34d399`}
                              className="w-8 h-8 rounded-full object-cover" alt="" />
                            <span className="font-bold text-white">{u.username || "Sin apodo"}</span>
                          </div>
                        </td>
                        <td className="py-3 text-gray-400">{u.deporte || "—"}</td>
                        <td className="py-3 text-gray-400">{u.nivel || "—"}</td>
                        <td className="py-3 text-gray-400">{u.zona || "—"}</td>
                        <td className="py-3 text-emerald-400 font-bold">{u.hoursPlayedFutbol || 0} hs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS ──────────────────────────────────────────────────── */}
        {activeTab === "leads" && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-white">Leads</h1>
                <p className="text-gray-500 text-sm mt-1">{leads.length} solicitudes totales</p>
              </div>
              <button onClick={() => navigate("/admin/leads")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl transition text-sm">
                Abrir Panel de Leads →
              </button>
            </div>
            <div className="space-y-3">
              {leads.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-5xl mb-3">📭</p>
                  <p className="text-gray-500">Sin leads todavía.</p>
                </div>
              ) : (
                leads.slice(0, 10).map(lead => (
                  <div key={lead.id} className="bg-white/3 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-black text-white">{lead.complejo}</p>
                      <p className="text-gray-500 text-xs">{lead.nombre} · {lead.email} · {lead.telefono}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                        lead.status === "nuevo" ? "bg-blue-900/40 text-blue-300 border-blue-700/30" :
                        lead.status === "activo" ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/30" :
                        "bg-gray-800/40 text-gray-400 border-gray-700/30"
                      }`}>{lead.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
