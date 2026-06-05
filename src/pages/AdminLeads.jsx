// src/pages/AdminLeads.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update, remove } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";

// UID del admin — tu cuenta
const OWNER_UID = "zShdRhpBbVOmPSN9BqVvLH1cpWd2";

const STATUS_STYLES = {
  nuevo:       "bg-blue-900/40 text-blue-300 border-blue-700/30",
  contactado:  "bg-amber-900/40 text-amber-300 border-amber-700/30",
  activo:      "bg-emerald-900/40 text-emerald-300 border-emerald-700/30",
  descartado:  "bg-red-900/40 text-red-300 border-red-700/30",
};

const STATUS_LABELS = {
  nuevo: "🆕 Nuevo",
  contactado: "📞 Contactado",
  activo: "✅ Activo",
  descartado: "❌ Descartado",
};

export default function AdminLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== OWNER_UID) {
        navigate("/");
        return;
      }
      loadLeads();
    });
  }, []);

  async function loadLeads() {
    setLoading(true);
    const snap = await get(ref(db, "leads"));
    if (snap.exists()) {
      const data = snap.val();
      const list = Object.entries(data)
        .map(([id, l]) => ({ id, ...l }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLeads(list);
    } else {
      setLeads([]);
    }
    setLoading(false);
  }

  async function updateStatus(leadId, status) {
    await update(ref(db, `leads/${leadId}`), { status });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, status }));
  }

  async function deleteLead(leadId) {
    if (!confirm("¿Eliminar este lead?")) return;
    await remove(ref(db, `leads/${leadId}`));
    setLeads(prev => prev.filter(l => l.id !== leadId));
    if (selectedLead?.id === leadId) setSelectedLead(null);
  }

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);

  const counts = {
    all: leads.length,
    nuevo: leads.filter(l => l.status === "nuevo").length,
    contactado: leads.filter(l => l.status === "contactado").length,
    activo: leads.filter(l => l.status === "activo").length,
    descartado: leads.filter(l => l.status === "descartado").length,
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 pt-6 max-w-5xl pb-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate("/")} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="display text-4xl text-white tracking-wide">PANEL DE LEADS</p>
            <p className="text-gray-500 text-xs mt-0.5">Solicitudes de complejos deportivos</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: "nuevo", label: "Nuevos", color: "text-blue-400" },
            { key: "contactado", label: "Contactados", color: "text-amber-400" },
            { key: "activo", label: "Activos", color: "text-emerald-400" },
            { key: "descartado", label: "Descartados", color: "text-red-400" },
          ].map((s) => (
            <div key={s.key} className="glass rounded-2xl p-4 text-center">
              <p className={`display text-3xl ${s.color}`}>{counts[s.key]}</p>
              <p className="text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: "all", label: `Todos (${counts.all})` },
            { key: "nuevo", label: `🆕 Nuevos (${counts.nuevo})` },
            { key: "contactado", label: `📞 Contactados (${counts.contactado})` },
            { key: "activo", label: `✅ Activos (${counts.activo})` },
            { key: "descartado", label: `❌ Descartados (${counts.descartado})` },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition border ${
                filter === f.key
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📭</p>
            <p className="display text-2xl text-gray-500">SIN LEADS AÚN</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead) => (
              <div key={lead.id}
                className="glass rounded-2xl p-4 cursor-pointer hover:border-emerald-500/20 transition neon-card"
                onClick={() => setSelectedLead(lead)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-white text-base">{lead.complejo}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[lead.status] || STATUS_STYLES.nuevo}`}>
                        {STATUS_LABELS[lead.status] || "🆕 Nuevo"}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mt-0.5">{lead.nombre}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-emerald-400 hover:underline">{lead.email}</a>
                      <a href={`https://wa.me/${lead.telefono?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-green-400 hover:underline">📱 {lead.telefono}</a>
                      {lead.canchas && <span className="text-xs text-gray-500">{lead.canchas} canchas</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-600">
                      {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : ""}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {lead.timestamp ? new Date(lead.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Lead Detail Modal ─────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setSelectedLead(null)}>
          <div className="w-full sm:max-w-lg glass rounded-t-3xl sm:rounded-3xl p-6 relative fade-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <button onClick={() => setSelectedLead(null)} className="absolute top-5 right-5 text-gray-500 hover:text-white text-2xl">×</button>

            <p className="display text-2xl text-white mb-4">{selectedLead.complejo}</p>

            {/* Info */}
            <div className="bg-white/5 rounded-2xl p-4 mb-4 space-y-2">
              {[
                ["👤 Contacto", selectedLead.nombre],
                ["📧 Email", selectedLead.email],
                ["📱 WhatsApp", selectedLead.telefono],
                ["🏟️ Canchas", selectedLead.canchas || "No especificado"],
                ["📅 Fecha", selectedLead.timestamp ? new Date(selectedLead.timestamp).toLocaleString("es-ES") : ""],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs w-28 flex-shrink-0">{label}</span>
                  <span className="text-white text-xs font-semibold">{value}</span>
                </div>
              ))}
              {selectedLead.mensaje && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-gray-500 text-xs mb-1">💬 Mensaje</p>
                  <p className="text-gray-300 text-sm">{selectedLead.mensaje}</p>
                </div>
              )}
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2 mb-4">
              <a href={`mailto:${selectedLead.email}`}
                className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm text-center transition">
                📧 Email
              </a>
              <a href={`https://wa.me/${selectedLead.telefono?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm text-center transition">
                💬 WhatsApp
              </a>
            </div>

            {/* Cambiar estado */}
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Cambiar estado</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => updateStatus(selectedLead.id, key)}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    selectedLead.status === key
                      ? `${STATUS_STYLES[key]} border-opacity-100`
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Eliminar */}
            <button onClick={() => deleteLead(selectedLead.id)}
              className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 text-red-400 font-bold py-2.5 rounded-xl text-sm transition">
              🗑️ Eliminar lead
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
