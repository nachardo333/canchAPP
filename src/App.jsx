// src/App.jsx
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SplashScreen   from "./components/SplashScreen";
import DiscoverFutbol from "./pages/DiscoverFutbol";
import ComplexDetail  from "./pages/ComplexDetail";
import MyBookings     from "./pages/MyBookings";
import Community      from "./pages/Community";
import Profile        from "./pages/Profile";
import Puntos         from "./pages/Puntos";
import Settings       from "./pages/Settings";
import AdminLeads     from "./pages/AdminLeads";
import AdminPanel     from "./pages/AdminPanel";
import OwnerPanel     from "./pages/OwnerPanel";
import PixelSnow      from './components/PixelSnow/PixelSnow';

export default function App() {
  const [ready, setReady] = useState(false);
  
  if (!ready) {
    return <SplashScreen onDone={() => setReady(true)} />; 
  }

  return (
    <>
      {/* CAPA DE NIEVE DIRECTA */}
      <PixelSnow 
        color="#ffffff"
        flakeSize={0.02}        // Copos un toque más grandes para verlos bien
        minFlakeSize={1.5}
        pixelResolution={120}   // Píxeles más grandes y notorios
        speed={1.5}             // Más velocidad
        density={0.6}           // Bastante más cantidad de nieve para testear
        variant="snowflake"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />

      {/* SISTEMA DE RUTAS CON TRASPARENCIA FORZADA */}
      <div style={{ 
        position: 'relative', 
        zIndex: 1, 
        backgroundColor: 'transparent' // Forzamos a que este contenedor no tape nada
      }}>
        <BrowserRouter>
          <Routes>
            <Route path="/"              element={<DiscoverFutbol />} />
            <Route path="/padel"         element={<DiscoverFutbol />} />
            <Route path="/complejo/:id"  element={<ComplexDetail />} />
            <Route path="/reservas"      element={<MyBookings />} />
            <Route path="/comunidad"     element={<Community />} />
            <Route path="/perfil"        element={<Profile />} />
            <Route path="/puntos"        element={<Puntos />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="/admin/leads"   element={<AdminLeads />} />
            <Route path="/panel-admin"   element={<AdminPanel />} />
            <Route path="/owner"         element={<OwnerPanel />} />
            <Route path="/faq"           element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </div>
    </>
  );
}