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
import AdminPanel     from "./pages/Adminpanel";
import OwnerPanel     from "./pages/Ownerpanel";

export default function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <SplashScreen onDone={() => setReady(true)} />;
  }

  return (
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
  );
}
