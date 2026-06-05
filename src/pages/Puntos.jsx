// src/pages/Puntos.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";
import Layout from "../components/Layout";

const PACKS = [
  { points: 10,  price: 100, label: "Ideal para empezar",  stars: 1, popular: false },
  { points: 50,  price: 450, label: "¡Ahorrás un 10%!",    stars: 2, popular: true  },
  { points: 100, price: 800, label: "El mejor valor",       stars: 3, popular: false },
];

export default function Puntos() {
  const navigate = useNavigate();
  const [userPoints, setUserPoints] = useState(null);
  const [toast, setToast] = useState({ show: false, points: 0, price: 0 });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        const snap = await get(ref(db, `private_user_data/${user.uid}`));
        setUserPoints(snap.exists() ? snap.val().puntos || 0 : 0);
      } else {
        navigate("/");
      }
    });
  }, []);

  function handleBuy(points, price) {
    setToast({ show: true, points, price });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  }

  return (
    <Layout>
      <div className="relative container mx-auto px-4 pt-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="glass p-2.5 rounded-xl hover:bg-emerald-900/30 transition border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="display text-4xl text-white neon-text tracking-wide">TIENDA DE PUNTOS</p>
          </div>
          <div className="glass rounded-full px-4 py-2 border border-amber-700/30">
            <p className="text-sm font-bold text-amber-400">
              {userPoints !== null ? `${userPoints} Pts ✨` : "Cargando..."}
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mb-8">
          Comprá puntos para canjear por reservas en tus complejos favoritos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PACKS.map((pack) => (
            <div
              key={pack.points}
              className={`glass rounded-3xl p-6 flex flex-col items-center text-center neon-card relative overflow-hidden ${pack.popular ? "border border-emerald-500/50" : ""}`}
            >
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              {pack.popular && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-black px-3 py-0.5 rounded-b-lg display tracking-wider">
                  MÁS POPULAR
                </div>
              )}

              <p className="text-4xl mt-2">{"✨".repeat(pack.stars)}</p>
              <p className="display text-4xl text-white mt-3 tracking-wide">{pack.points} PUNTOS</p>
              <p className="text-gray-500 text-sm my-2">{pack.label}</p>
              <p className="display text-5xl text-white font-black my-4">
                ${pack.price}
                <span className="text-base text-gray-500 font-normal ml-1">ARS</span>
              </p>

              <button
                onClick={() => handleBuy(pack.points, pack.price)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-2xl transition display tracking-wider text-lg shadow-lg shadow-emerald-900/40"
              >
                COMPRAR
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-700 text-xs mt-8">
          Los pagos se procesan a través de Mercado Pago de forma segura.
        </p>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-5 right-5 z-50 bg-white border-l-4 border-emerald-500 shadow-xl rounded-xl p-4 flex items-center gap-3 fade-up">
          <svg className="w-6 h-6 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-bold text-gray-800 text-sm">Simulación de Pago</p>
            <p className="text-xs text-gray-600">
              Iniciando compra de <strong>{toast.points} puntos</strong> por ARS ${toast.price}.
              <br />
              <span className="opacity-60">Redirigiendo a Mercado Pago (Simulación)</span>
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}
