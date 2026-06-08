// src/pages/AdminPanel.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, update, remove, onValue } from "firebase/database";
import { auth, db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";

const OWNER_UID      = "zShdRhpBbVOmPSN9BqVvLH1cpWd2";
const PRECIO_CANCHA  = 25000;
const COMISION_PCT   = 0.10;
const PTS_INDIVIDUAL = 10;
const PTS_ENTERA     = 100;
const MAX_PLAYERS    = 10;

const fmt   = n => "$" + Math.round(n).toLocaleString("es-AR");
const tod   = () => new Date().toISOString().split("T")[0];
const addD  = (b,n) => { const d=new Date(b); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const range = (s,n) => Array.from({length:n},(_,i)=>addD(s,i));
const cx    = (...a) => a.filter(Boolean).join(" ");

const PAY_STATUS = {
  online:   { label:"Pagado Online",    short:"Online",   dot:"bg-emerald-500" },
  partial:  { label:"Se\u00f1ado (50%)", short:"Se\u00f1ado", dot:"bg-amber-500"   },
  inperson: { label:"Paga en Complejo", short:"En local", dot:"bg-slate-400"   },
};

const PAY_LIGHT = { online:"bg-emerald-50 text-emerald-700 ring-emerald-200", partial:"bg-amber-50 text-amber-700 ring-amber-200", inperson:"bg-slate-100 text-slate-600 ring-slate-200" };
const PAY_DARK  = { online:"bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", partial:"bg-amber-500/10 text-amber-400 ring-amber-500/20", inperson:"bg-white/5 text-slate-400 ring-white/10" };

// ?? Dark mode aislado al panel ? NO modifica <html> ???????????????????????????
function useAdminTheme() {
  const [dark, _set] = useState(() => localStorage.getItem("adminTheme") === "dark");
  const toggle = () => _set(d => { const n=!d; localStorage.setItem("adminTheme",n?"dark":"light"); return n; });
  return [dark, toggle];
}

// ?? Tokens de tema ????????????????????????????????????????????????????????????
function T(dark) {
  return {
    bg:   dark?"bg-[#06060f]":"bg-slate-100",
    side: dark?"bg-[#0a0a14] border-white/5":"bg-white border-slate-200 shadow-sm",
    card: dark?"bg-[#0d0d1a] ring-1 ring-white/6":"bg-white ring-1 ring-slate-200 shadow-sm",
    modal:dark?"bg-[#0c0c16] ring-1 ring-white/8":"bg-white ring-1 ring-slate-200 shadow-xl",
    div:  dark?"border-white/6":"border-slate-200",
    inp:  dark?"bg-white/5 border-white/10 text-white placeholder-slate-500":"bg-white border-slate-300 text-slate-900 placeholder-slate-400",
    sel:  dark?"bg-white/5 border-white/10 text-white":"bg-white border-slate-300 text-slate-900",
    p:    dark?"text-white":"text-slate-900",
    s:    dark?"text-slate-400":"text-slate-500",
    m:    dark?"text-slate-300":"text-slate-700",
    pill: dark?"bg-white/6 hover:bg-white/10":"bg-slate-100 hover:bg-slate-200",
    rh:   dark?"hover:bg-white/3":"hover:bg-slate-50",
    nav:  dark?"bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25":"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    navI: dark?"text-slate-400 hover:bg-white/6 hover:text-white":"text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    kpiEm:dark?"from-emerald-500/12 to-transparent":"from-emerald-50 to-white",
    kpiSk:dark?"from-sky-500/12 to-transparent":"from-sky-50 to-white",
    kpiAm:dark?"from-amber-500/12 to-transparent":"from-amber-50 to-white",
    kpiVi:dark?"from-violet-500/12 to-transparent":"from-violet-50 to-white",
    tag: {
      green: dark?"bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20":"bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
      blue:  dark?"bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20":"bg-sky-100 text-sky-700 ring-1 ring-sky-200",
      amber: dark?"bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20":"bg-amber-100 text-amber-700 ring-1 ring-amber-200",
      purple:dark?"bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20":"bg-violet-100 text-violet-700 ring-1 ring-violet-200",
      red:   dark?"bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20":"bg-rose-100 text-rose-700 ring-1 ring-rose-200",
      slate: dark?"bg-white/5 text-slate-400 ring-1 ring-white/10":"bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    },
  };
}

// ?? UI Primitives ?????????????????????????????????????????????????????????????
const Tag = ({c="slate",children,th}) => (
  <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ring-1",th.tag[c])}>{children}</span>
);

function PayTag({status,th,dark}) {
  if(!status||!PAY_STATUS[status]) return null;
  const s=PAY_STATUS[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ring-1",dark?PAY_DARK[status]:PAY_LIGHT[status])}>
      <span className={cx("w-1.5 h-1.5 rounded-full flex-shrink-0",s.dot)}/>{s.short}
    </span>
  );
}

function Pill({active,onClick,children,th}) {
  return (
    <button onClick={onClick} className={cx("px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
      active?"bg-emerald-500 text-black shadow-lg shadow-emerald-500/20":cx(th.s,"hover:brightness-95"))}>
      {children}
    </button>
  );
}

function Toast({show,message,type="success",th}) {
  return (
    <motion.div initial={{x:120,opacity:0}} animate={show?{x:0,opacity:1}:{x:120,opacity:0}} transition={{type:"spring",damping:20}}
      className={cx("fixed top-6 right-6 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl ring-1 text-sm font-medium",
        th.card, type==="success"?"text-emerald-600":"text-rose-600")}>
      <span>{type==="success"?"\u2713":"\u2715"}</span>{message}
    </motion.div>
  );
}

function BookingAlert({alerts,onDismiss}) {
  return (
    <AnimatePresence>
      {alerts.map(a=>(
        <motion.div key={a.id} initial={{y:-80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-80,opacity:0}} transition={{type:"spring",damping:20}}
          className="fixed top-0 left-56 right-0 z-[250] flex items-center justify-between px-6 py-3 bg-emerald-500 text-black font-bold text-sm shadow-xl">
          <div className="flex items-center gap-3">
            <motion.span animate={{scale:[1,1.3,1]}} transition={{repeat:3,duration:0.4}} className="text-xl">ALERTA</motion.span>
            <span>Nueva reserva: <strong>{a.courtName}</strong> \u00b7 {a.time} hs</span>
          </div>
          <button onClick={()=>onDismiss(a.id)} className="text-black/60 hover:text-black font-black text-lg ml-4">\u00d7</button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function Modal({open,onClose,children,size="md",th}) {
  const sizes={sm:"max-w-sm",md:"max-w-md",lg:"max-w-lg",xl:"max-w-xl"};
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}>
      <div className="absolute inset-0" onClick={onClose}/>
      <motion.div initial={{scale:.95,opacity:0,y:8}} animate={{scale:1,opacity:1,y:0}} transition={{type:"spring",damping:24,stiffness:300}}
        className={cx("relative w-full",sizes[size],th.modal,"rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto")}>
        {children}
      </motion.div>
    </div>
  );
}

function MH({title,sub,onClose,th}) {
  return (
    <div className={cx("flex items-start justify-between p-6 pb-4 border-b sticky top-0 z-10",th.modal,th.div)}>
      <div>
        <h3 className={cx("text-lg font-bold",th.p)}>{title}</h3>
        {sub&&<p className={cx("text-xs mt-0.5",th.s)}>{sub}</p>}
      </div>
      <button onClick={onClose} className={cx("w-8 h-8 rounded-xl flex items-center justify-center transition ml-4 flex-shrink-0",th.pill,th.s,"hover:brightness-90")}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  );
}

function Btn({variant="primary",size="md",disabled,onClick,children,className=""}) {
  const v={
    primary:"bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20",
    ghost:"bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold",
    danger:"bg-rose-50 hover:bg-rose-100 text-rose-600 ring-1 ring-rose-200 font-semibold",
    amber:"bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-500/20",
  };
  const s={sm:"px-3 py-1.5 text-xs rounded-xl",md:"px-4 py-2 text-sm rounded-xl",lg:"px-5 py-2.5 text-sm rounded-xl"};
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx("transition-all disabled:opacity-40 disabled:cursor-not-allowed",v[variant],s[size],className)}>
      {children}
    </button>
  );
}

function TInput({label,value,onChange,placeholder,type="text",th,className=""}) {
  return (
    <div className={className}>
      {label&&<label className={cx("block text-[11px] font-semibold uppercase tracking-wider mb-1.5",th.s)}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={cx("w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400",th.inp)}/>
    </div>
  );
}

function TSelect({label,value,onChange,children,th,className=""}) {
  return (
    <div className={className}>
      {label&&<label className={cx("block text-[11px] font-semibold uppercase tracking-wider mb-1.5",th.s)}>{label}</label>}
      <select value={value} onChange={onChange}
        className={cx("w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition",th.sel)}>
        {children}
      </select>
    </div>
  );
}

function DateStrip({selected, onChange, th, dark}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => selected.slice(0,7));

  const quickDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(tod() + "T12:00");
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const [pYear, pMonth] = pickerMonth.split("-").map(Number);
  const firstDay = new Date(pYear, pMonth - 1, 1).getDay();
  const daysInMonth = new Date(pYear, pMonth, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  const monthLabel = new Date(selected + "T12:00")
    .toLocaleDateString("es-ES", {month:"long", year:"numeric"});

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => { setPickerMonth(selected.slice(0,7)); setShowPicker(true); }}
          className={cx("text-sm font-bold capitalize flex items-center gap-1.5 hover:text-emerald-400 transition", th.p)}>
          {monthLabel}
          <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">ver mes</span>
        </button>
        {selected !== tod() && (
          <button onClick={() => onChange(tod())}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition">
            Hoy
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {quickDates.map(d => {
          const dt    = new Date(d + "T12:00");
          const isT   = d === tod();
          const isSel = d === selected;
          return (
            <button key={d} onClick={() => onChange(d)}
              className={cx(
                "flex flex-col items-center py-2 px-1 rounded-xl transition-all",
                isSel ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30"
                : isT  ? cx("ring-2 ring-emerald-500/50", th.pill, "text-emerald-500")
                       : cx(th.pill, th.s, "hover:ring-1 hover:ring-emerald-400/40")
              )}>
              <span className="text-[9px] uppercase tracking-wider font-semibold">
                {dt.toLocaleDateString("es-ES", {weekday:"short"})}
              </span>
              <span className={cx("text-base font-black leading-tight mt-0.5", isSel ? "text-black" : th.p)}>
                {dt.getDate()}
              </span>
              {isT && !isSel && <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5"/>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input type="date" value={selected}
          onChange={e => e.target.value && onChange(e.target.value)}
          className={cx("flex-1 text-xs px-3 py-2 rounded-xl border outline-none transition", th.inp)}
        />
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}}
          onClick={() => setShowPicker(false)}>
          <div className={cx("w-full max-w-sm rounded-2xl p-5 shadow-2xl", th.card)}
            style={{border:"1px solid rgba(255,255,255,0.08)"}}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-4">
              <button onClick={() => {
                const d = new Date(pYear, pMonth - 2, 1);
                setPickerMonth(d.toISOString().slice(0,7));
              }} className={cx("w-8 h-8 rounded-xl flex items-center justify-center font-bold transition", th.pill, th.s)}>
                &lt;
              </button>
              <div className="text-center">
                <p className={cx("font-bold capitalize text-sm", th.p)}>
                  {new Date(pYear, pMonth-1, 1).toLocaleDateString("es-ES",{month:"long"})}
                </p>
                <select value={pYear}
                  onChange={e => setPickerMonth(e.target.value+"-"+String(pMonth).padStart(2,"0"))}
                  className={cx("text-xs mt-0.5 rounded-lg px-2 py-0.5 outline-none border", th.inp)}>
                  {Array.from({length:6}, (_,i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => {
                const d = new Date(pYear, pMonth, 1);
                setPickerMonth(d.toISOString().slice(0,7));
              }} className={cx("w-8 h-8 rounded-xl flex items-center justify-center font-bold transition", th.pill, th.s)}>
                &gt;
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map(d => (
                <div key={d} className={cx("text-center text-[10px] font-bold py-1", th.s)}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({length: startOffset}).map((_, i) => <div key={"e"+i}/>)}
              {Array.from({length: daysInMonth}, (_, i) => {
                const day = String(i+1).padStart(2,"0");
                const dateStr = pYear+"-"+String(pMonth).padStart(2,"0")+"-"+day;
                const isT   = dateStr === tod();
                const isSel = dateStr === selected;
                return (
                  <button key={day}
                    onClick={() => { onChange(dateStr); setShowPicker(false); }}
                    className={cx(
                      "aspect-square rounded-xl text-xs font-semibold transition-all flex items-center justify-center",
                      isSel ? "bg-emerald-500 text-black shadow-md"
                      : isT  ? cx("ring-2 ring-emerald-400/60 text-emerald-400", th.pill)
                             : cx(th.pill, th.s, "hover:bg-emerald-500/10 hover:text-emerald-400")
                    )}>
                    {i+1}
                  </button>
                );
              })}
            </div>

            <button onClick={() => setShowPicker(false)}
              className={cx("w-full mt-4 py-2 rounded-xl text-xs font-semibold transition", th.pill, th.s)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({icon,label,value,sub,kpiFrom,onClick,th}) {
  return (
    <motion.button whileHover={onClick?{scale:1.02}:{}} whileTap={onClick?{scale:.98}:{}} onClick={onClick}
      className={cx("relative overflow-hidden bg-gradient-to-br to-transparent",kpiFrom,th.card,"p-5 text-left w-full transition-all",onClick?"cursor-pointer":"cursor-default")}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {onClick&&<span className={cx("text-[10px] font-medium",th.s)}>tap \u2192</span>}
      </div>
      <p className={cx("text-2xl font-black leading-none",th.p)}>{value}</p>
      <p className={cx("text-[11px] font-semibold uppercase tracking-wide mt-1",th.s)}>{label}</p>
      {sub&&<p className={cx("text-[11px] mt-0.5",th.s)}>{sub}</p>}
    </motion.button>
  );
}

function slotStatus(slot) {
  if(slot.blocked)                          return {label:"Bloqueado",c:"red",   dot:"bg-rose-500"};
  if(slot.bookingType==="full")             return {label:"Entera",   c:"purple",dot:"bg-violet-500"};
  if((slot.playersJoined||0)>=MAX_PLAYERS) return {label:"Completo", c:"green", dot:"bg-emerald-500"};
  if((slot.playersJoined||0)>0)            return {label:"En curso", c:"blue",  dot:"bg-sky-500"};
  return {label:"Libre",c:"slate",dot:"bg-slate-400"};
}

function playChime() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type="sine";o.frequency.setValueAtTime(880,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320,ctx.currentTime+0.1);
    g.gain.setValueAtTime(0.15,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);
    o.start(ctx.currentTime);o.stop(ctx.currentTime+0.5);
  } catch{}
}

// ?????????????????????????????????????????????????????????????????????????????
// PAGE COMPONENT
// ?????????????????????????????????????????????????????????????????????????????
export default function AdminPanel() {
  const navigate = useNavigate();
  const [dark, toggleDark] = useAdminTheme();
  const th = T(dark);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Override global CanchAPP background for admin panel
  useEffect(() => {
    document.body.classList.add("admin-mode");
    document.body.setAttribute("data-admin-dark", dark ? "1" : "0");
    return () => {
      document.body.classList.remove("admin-mode");
      document.body.removeAttribute("data-admin-dark");
    };
  }, [dark]);

  const [user,setUser]               = useState(null);
  const [complexId,setComplexId]     = useState(null);
  const [complexData,setComplexData] = useState(null);
  const [tab,setTab]                 = useState("dashboard");
  const [loading,setLoading]         = useState(true);
  const [toast,setToast]             = useState({show:false,message:"",type:"success"});
  const [courts,setCourts]           = useState([]);
  const [selDate,setSelDate]         = useState(tod());
  const [courtFilter,setCourtFilter] = useState("all");
  const [bookingAlerts,setBookingAlerts] = useState([]);
  const prevRef = useRef({});

  // Buscador global
  const [gSearch,setGSearch]   = useState("");
  const [gResults,setGResults] = useState({courts:[],slots:[],users:[]});
  const [gLoading,setGLoading] = useState(false);

  // Historial cancha
  const [history,setHistory]     = useState(null);
  const [histData,setHistData]   = useState([]);

  // Modales
  const [billing,setBilling]       = useState(false);
  const [billPeriod,setBillPeriod] = useState("day");
  const [courtModal,setCourtModal] = useState(false);
  const [editCourt,setEditCourt]   = useState(null);
  const [cForm,setCForm]           = useState({nombre_cancha:"",deporte:"F\u00fatbol",tipo_superficie:"C\u00e9sped Sint\u00e9tico"});
  const [slotModal,setSlotModal]   = useState(false);
  const [sCourtId,setSCourtId]     = useState("");
  const [sDate,setSDate]           = useState(tod());
  const [sHours,setSHours]         = useState([]);
  const [detail,setDetail]         = useState(null);
  const [detPl,setDetPl]           = useState([]);
  const [loadPl,setLoadPl]         = useState(false);
  const [addModal,setAddModal]     = useState(null);
  const [addTab,setAddTab]         = useState("registered");
  const [pSearch,setPSearch]       = useState("");
  const [pResults,setPResults]     = useState([]);
  const [pLoading,setPLoading]     = useState(false);
  const [guestName,setGuestName]   = useState("");
  const [payModal,setPayModal]     = useState(null);
  const [profForm,setProfForm]     = useState({name:"",address:"",zone:"",descripcion:""});
  const [savingP,setSavingP]       = useState(false);
  const unsubRef = useRef(null);

  const toast$ = (msg,type="success") => {
    setToast({show:true,message:msg,type});
    setTimeout(()=>setToast(t=>({...t,show:false})),3000);
  };

  // Auth
  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(!u){navigate("/");return;}
    const snap=await get(ref(db,"private_user_data/"+u.uid));
    if(!snap.exists()){navigate("/");return;}
    const d=snap.val();
    if(!d.managedComplexId&&!d.role&&u.uid!==OWNER_UID){navigate("/");return;}
    const cId=d.managedComplexId||(u.uid===OWNER_UID?"complejo_bombonera":null);
    if(!cId){navigate("/");return;}
    setUser(u);setComplexId(cId);
    const cs=await get(ref(db,"complexes/"+cId));
    if(cs.exists()){
      const cd={id:cId,...cs.val()};
      setComplexData(cd);
      setProfForm({name:cd.name||"",address:cd.address||"",zone:cd.zone||"",descripcion:cd.descripcion||""});
    }
    if(unsubRef.current) unsubRef.current();
    unsubRef.current=onValue(ref(db,"complexes/"+cId+"/courts"),s=>{
      if(!s.exists()){setCourts([]);return;}
      const nc=Object.entries(s.val()).map(([id,c])=>({id,...c}));
      nc.forEach(court=>{
        Object.entries(court.availableSlots||{}).forEach(([key,slot])=>{
          const prev=prevRef.current[court.id+"_"+key]||0;
          const curr=slot.playersJoined||0;
          if(curr>prev&&prev>=0){
            const aid=Date.now()+"_"+key;
            setBookingAlerts(a=>[...a,{id:aid,courtName:court.nombre_cancha,time:slot.time,playerName:"Nuevo jugador"}]);
            playChime();
            setTimeout(()=>setBookingAlerts(a=>a.filter(x=>x.id!==aid)),8000);
          }
          prevRef.current[court.id+"_"+key]=curr;
        });
      });
      setCourts(nc);
    });
    setLoading(false);
  }),[]);

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);

  // Global search
  useEffect(()=>{
    if(!gSearch||gSearch.length<2){setGResults({courts:[],slots:[],users:[]});return;}
    setGLoading(true);
    const t=setTimeout(async()=>{
      const q=gSearch.toLowerCase();
      const mCourts=courts.filter(c=>c.nombre_cancha?.toLowerCase().includes(q));
      const mSlots=[];
      courts.forEach(c=>Object.entries(c.availableSlots||{}).forEach(([key,s])=>{
        if((s.playersJoined||0)>0&&(c.nombre_cancha?.toLowerCase().includes(q)||s.time?.includes(q)||s.date?.includes(q)))
          mSlots.push({...s,key,courtId:c.id,courtName:c.nombre_cancha});
      }));
      const us=await get(ref(db,"public_profiles"));
      const mUsers=us.exists()
        ?Object.entries(us.val()).filter(([,p])=>p.username?.toLowerCase().includes(q)).map(([uid,p])=>({uid,...p})).slice(0,6)
        :[];
      setGResults({courts:mCourts,slots:mSlots.slice(0,10),users:mUsers});
      setGLoading(false);
    },400);
    return()=>clearTimeout(t);
  },[gSearch,courts]);

  // Historial
  useEffect(()=>{
    if(!history) return;
    const slots=Object.entries(history.court.availableSlots||{})
      .map(([key,s])=>({key,...s}))
      .filter(s=>s.date===history.date)
      .sort((a,b)=>a.time.localeCompare(b.time));
    setHistData(slots);
  },[history]);

  // Player search
  useEffect(()=>{
    if(!pSearch||pSearch.length<2){setPResults([]);return;}
    setPLoading(true);
    const t=setTimeout(async()=>{
      const s=await get(ref(db,"public_profiles"));
      if(s.exists()) setPResults(
        Object.entries(s.val()).filter(([,p])=>p.username?.toLowerCase().includes(pSearch.toLowerCase()))
          .map(([uid,p])=>({uid,...p})).slice(0,6)
      );
      setPLoading(false);
    },350);
    return()=>clearTimeout(t);
  },[pSearch]);

  // Computed
  const filteredCourts=courtFilter==="all"?courts:courts.filter(c=>c.deporte===courtFilter);
  const courtTypes=["all",...new Set(courts.map(c=>c.deporte).filter(Boolean))];
  const slotsDay=filteredCourts.flatMap(c=>
    Object.entries(c.availableSlots||{})
      .filter(([,s])=>s.date===selDate)
      .map(([key,s])=>({...s,key,courtId:c.id,courtName:c.nombre_cancha||"Cancha"}))
  ).sort((a,b)=>a.time.localeCompare(b.time));

  function calcBill(daysBack){
    const r=range(addD(tod(),-daysBack+1),daysBack);
    let ent=0,ind=0;
    courts.forEach(c=>Object.values(c.availableSlots||{}).forEach(s=>{
      if(!r.includes(s.date)) return;
      if(s.bookingType==="full") ent++;
      else if((s.playersJoined||0)>0) ind+=s.playersJoined;
    }));
    return{ent,ind,ingrEnt:ent*PRECIO_CANCHA,ingrInd:ind*(PRECIO_CANCHA/MAX_PLAYERS),total:ent*PRECIO_CANCHA+ind*(PRECIO_CANCHA/MAX_PLAYERS)};
  }

  const totalPl  = slotsDay.reduce((a,s)=>a+(s.playersJoined||0),0);
  const occupied = slotsDay.filter(s=>(s.playersJoined||0)>0).length;
  const fullCts  = slotsDay.filter(s=>s.bookingType==="full").length;
  const billDay  = calcBill(1);

  // Actions
  async function openDetail(slot){
    setDetail(slot);setDetPl([]);setLoadPl(true);
    const profs=await Promise.all(Object.keys(slot.players||{}).map(async uid=>{
      const s=await get(ref(db,"public_profiles/"+uid));
      return s.exists()?{uid,type:"reg",...s.val()}:{uid,type:"reg",username:"Jugador"};
    }));
    const guests=Object.entries(slot.guests||{}).map(([gid,g])=>({uid:gid,type:"guest",username:g.name,invBy:g.invitedByName}));
    setDetPl([...profs,...guests]);setLoadPl(false);
  }

  async function cancelPlayer(slot,uid,isGuest){
    if(!confirm("\u00bfCancelar esta reserva?")) return;
    const p="complexes/"+complexId+"/courts/"+slot.courtId+"/availableSlots/"+slot.key;
    const u={};
    u[(isGuest?p+"/guests/"+uid:p+"/players/"+uid)]=null;
    u[p+"/playersJoined"]=Math.max((slot.playersJoined||1)-1,0);
    await update(ref(db),u);
    setDetPl(prev=>prev.filter(p=>p.uid!==uid));
    setDetail(prev=>({...prev,playersJoined:Math.max((prev.playersJoined||1)-1,0)}));
    toast$("Reserva cancelada");
  }

  async function markFull(slot){
    if(!confirm("\u00bfMarcar como cancha entera?")) return;
    await update(ref(db,"complexes/"+complexId+"/courts/"+slot.courtId+"/availableSlots/"+slot.key),
      {bookingType:"full",ownerId:user.uid,playersJoined:MAX_PLAYERS,paymentStatus:"online"});
    setDetail(p=>({...p,bookingType:"full",playersJoined:MAX_PLAYERS}));
    toast$("Marcado como entera \u2713");
  }

  async function toggleBlock(slot){
    await update(ref(db,"complexes/"+complexId+"/courts/"+slot.courtId+"/availableSlots/"+slot.key),
      {blocked:slot.blocked?null:true});
    toast$(slot.blocked?"Slot desbloqueado":"Slot bloqueado");
    setDetail(null);
  }

  async function setPayStatus(slot,status){
    await update(ref(db,"complexes/"+complexId+"/courts/"+slot.courtId+"/availableSlots/"+slot.key),{paymentStatus:status});
    toast$("Estado actualizado \u2713");
    setPayModal(null);setDetail(null);
  }

  async function addRegistered(pUid,pName){
    const sl=addModal;
    if((sl.playersJoined||0)>=MAX_PLAYERS){toast$("Slot lleno","error");return;}
    if(sl.players?.[pUid]){toast$("Ya est\u00e1 anotado","error");return;}
    const p="complexes/"+complexId+"/courts/"+sl.courtId+"/availableSlots/"+sl.key;
    await update(ref(db),{[p+"/players/"+pUid]:true,[p+"/playersJoined"]:(sl.playersJoined||0)+1,[p+"/bookingType"]:"open",[p+"/paymentStatus"]:"online"});
    toast$(pName+" agregado \u2713");
    setAddModal(null);setPSearch("");setPResults([]);
  }

  async function addGuest(){
    const name=guestName.trim();
    if(!name){toast$("Ingres\u00e1 un nombre","error");return;}
    const sl=addModal;
    const p="complexes/"+complexId+"/courts/"+sl.courtId+"/availableSlots/"+sl.key;
    await update(ref(db),{[p+"/guests/guest_"+Date.now()]:{name,invitedBy:user.uid,invitedByName:"Admin"},[p+"/playersJoined"]:(sl.playersJoined||0)+1,[p+"/paymentStatus"]:"inperson"});
    toast$(name+" agregado \u2713");
    setAddModal(null);setGuestName("");
  }

  async function saveCourt(){
    if(!cForm.nombre_cancha?.trim()){toast$("Ingres\u00e1 un nombre","error");return;}
    const path=editCourt?"complexes/"+complexId+"/courts/"+editCourt:"complexes/"+complexId+"/courts/c_"+Date.now();
    await update(ref(db,path),{...cForm,points:PTS_INDIVIDUAL,precio_hora:PRECIO_CANCHA});
    toast$(editCourt?"Cancha actualizada \u2713":"Cancha creada \u2713");
    setCourtModal(false);setEditCourt(null);
    setCForm({nombre_cancha:"",deporte:"F\u00fatbol",tipo_superficie:"C\u00e9sped Sint\u00e9tico"});
  }

  async function delCourt(id){
    if(!confirm("\u00bfEliminar cancha y todos sus slots?")) return;
    await remove(ref(db,"complexes/"+complexId+"/courts/"+id));
    toast$("Cancha eliminada");
  }

  async function addSlots(){
    if(!sCourtId||!sDate||!sHours.length){toast$("Complet\u00e1 todos los campos","error");return;}
    const u={};
    sHours.forEach(h=>{u["/complexes/"+complexId+"/courts/"+sCourtId+"/availableSlots/"+sDate+"_"+h.replace(":","")]={date:sDate,time:h,playersJoined:0,points:PTS_INDIVIDUAL};});
    await update(ref(db),u);
    toast$(sHours.length+" slots agregados \u2713");
    setSlotModal(false);setSHours([]);
  }

  async function delSlot(cId,key,hasPl){
    if(hasPl&&!confirm("Tiene jugadores. \u00bfEliminar igual?")) return;
    await remove(ref(db,"complexes/"+complexId+"/courts/"+cId+"/availableSlots/"+key));
    toast$("Slot eliminado");
  }

  async function saveProfile(){
    setSavingP(true);
    try{await update(ref(db,"complexes/"+complexId),profForm);setComplexData(p=>({...p,...profForm}));toast$("Guardado \u2713");}
    catch{toast$("Error","error");}
    finally{setSavingP(false);}
  }

  if(loading) return (
    <div className={cx("min-h-screen flex items-center justify-center",th.bg)}>
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const TABS=[
    {key:"dashboard",label:"Dashboard",icon:"Stats"},
    {key:"courts",   label:"Canchas",  icon:"\u26BD"},
    {key:"slots",    label:"Horarios", icon:"Hora"},
    {key:"search",   label:"Buscar",   icon:"Buscar"},
    {key:"profile",  label:"Complejo", icon:"Campo"},
  ];

  // Slot row
  const SlotRow = ({slot,i}) => {
    const st=slotStatus(slot);
    const isFull=slot.bookingType==="full";
    const hasPl=(slot.playersJoined||0)>0;
    const pct=Math.round(((slot.playersJoined||0)/MAX_PLAYERS)*100);
    const invoice=isFull?PRECIO_CANCHA:(slot.playersJoined||0)*(PRECIO_CANCHA/MAX_PLAYERS);
    return (
      <tr key={i} className={cx("border-b transition-colors",th.div,th.rh)}>
        <td className="px-6 py-3">
          <span className={cx("font-bold",th.p)}>{slot.time}</span>
          {slot.blocked&&<span className="ml-2 text-[10px] text-rose-500 font-semibold">BLOQ.</span>}
        </td>
        <td className={cx("px-4 py-3 text-xs font-medium",th.s)}>{slot.courtName}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cx("text-xs font-semibold w-8",th.p)}>{slot.playersJoined||0}/10</span>
            <div className={cx("w-16 rounded-full h-1.5 overflow-hidden",dark?"bg-white/8":"bg-slate-200")}>
              <div className={cx("h-full rounded-full",isFull?"bg-violet-500":"bg-emerald-500")} style={{width:pct+"%"}}/>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className={cx("w-1.5 h-1.5 rounded-full",st.dot)}/>
            <Tag c={st.c} th={th}>{st.label}</Tag>
          </div>
        </td>
        <td className="px-4 py-3">
          <button onClick={()=>setPayModal(slot)} className="hover:opacity-70 transition">
            <PayTag status={slot.paymentStatus||(hasPl?"inperson":null)} th={th} dark={dark}/>
          </button>
        </td>
        <td className={cx("px-4 py-3 text-xs font-semibold",dark?"text-amber-400":"text-amber-600")}>{fmt(invoice)}</td>
        <td className="px-6 py-3">
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            <button onClick={()=>openDetail(slot)} className={cx("px-2.5 py-1 text-[11px] font-semibold rounded-lg transition",th.pill,th.m)}>Ver</button>
            {!slot.blocked&&!isFull&&(<>
              <button onClick={()=>{setAddModal(slot);setAddTab("registered");}}
                className={cx("px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ring-1",dark?"text-emerald-400 bg-emerald-500/10 ring-emerald-500/20":"text-emerald-600 bg-emerald-50 ring-emerald-200")}>+ Jugador</button>
              <button onClick={()=>markFull(slot)}
                className={cx("px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ring-1",dark?"text-violet-400 bg-violet-500/10 ring-violet-500/20":"text-violet-600 bg-violet-50 ring-violet-200")}>Alquilar</button>
            </>)}
            <button onClick={()=>toggleBlock(slot)}
              className={cx("px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ring-1",
                slot.blocked?(dark?"text-emerald-400 bg-emerald-500/10 ring-emerald-500/20":"text-emerald-600 bg-emerald-50 ring-emerald-200")
                            :(dark?"text-rose-400 bg-rose-500/10 ring-rose-500/20":"text-rose-600 bg-rose-50 ring-rose-200")
              )}>{slot.blocked?"DESBLOQUEAR":"BLOQUEAR"}</button>
            {!hasPl&&<button onClick={()=>delSlot(slot.courtId,slot.key,false)}
              className={cx("px-2 py-1 text-[11px] rounded-lg transition",dark?"text-rose-400 bg-rose-500/8":"text-rose-500 bg-rose-50")}>X</button>}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className={cx("min-h-screen flex",th.bg)}
      style={{fontFamily:"'Poppins',sans-serif", backgroundColor: dark?"#06060f":"#f8fafc"}}>
      <BookingAlert alerts={bookingAlerts} onDismiss={id=>setBookingAlerts(a=>a.filter(x=>x.id!==id))}/>

      {/* Mobile overlay */}
      {sidebarOpen&&(
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={()=>setSidebarOpen(false)}/>
      )}

      {/* SIDEBAR */}
      <aside className={cx(
        "fixed h-full z-40 flex flex-col border-r transition-transform duration-300 w-60",
        th.side,
        sidebarOpen?"translate-x-0":"-translate-x-full lg:translate-x-0"
      )} style={{backgroundColor: dark?"#08080f":"#ffffff"}}>
        <div className={cx("p-4 border-b",th.div)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-black text-sm">C</div>
              <div>
                <p className={cx("font-bold text-sm leading-none tracking-tight",th.p)}>CanchAPP</p>
                <p className="text-emerald-500 text-[10px] font-semibold tracking-widest uppercase mt-0.5">Admin</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={toggleDark} className={cx("w-8 h-8 rounded-xl flex items-center justify-center transition text-sm",th.pill)}>
                {dark?"SOL":"LUN"}
              </button>
              <button onClick={()=>setSidebarOpen(false)} className={cx("w-8 h-8 rounded-xl flex items-center justify-center transition lg:hidden",th.pill,th.s)}>X</button>
            </div>
          </div>
        </div>
        <div className={cx("px-4 py-3 border-b",th.div)}>
          <p className={cx("text-[10px] uppercase tracking-wider font-semibold mb-0.5",th.s)}>Gestionando</p>
          <p className={cx("text-sm font-semibold truncate",th.p)}>{complexData?.name||complexId}</p>
          <p className={cx("text-xs truncate",th.s)}>{complexData?.zone}</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);setSidebarOpen(false);}}
              className={cx("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                tab===t.key?th.nav:th.navI)}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className={cx("px-4 py-3 border-t",th.div,"space-y-2")}>
          {[{l:"Canchas",v:courts.length},{l:"Slots hoy",v:slotsDay.length},{l:"Jugadores",v:totalPl}].map(s=>(
            <div key={s.l} className="flex justify-between text-xs">
              <span className={th.s}>{s.l}</span>
              <span className={cx("font-semibold",th.m)}>{s.v}</span>
            </div>
          ))}
        </div>
        <div className={cx("p-3 border-t",th.div,"space-y-1")}>
          <button onClick={()=>navigate("/")} className={cx("w-full text-left px-3 py-2 text-xs rounded-xl transition font-medium",th.s,th.navI)}>Volver a la app</button>
          <button onClick={()=>signOut(auth).then(()=>navigate("/"))} className="w-full text-left px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 rounded-xl transition font-medium">Cerrar sesion</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 lg:ml-60 overflow-y-auto min-h-screen"
        style={{backgroundColor: dark?"#06060f":"#f8fafc"}}>
        {/* Top bar mobile */}
        <div className={cx("sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b lg:hidden",th.side,th.div)}>
          <button onClick={()=>setSidebarOpen(true)} className={cx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",th.pill,th.p)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <p className={cx("font-bold text-sm flex-1",th.p)}>{TABS.find(t=>t.key===tab)?.label||"Dashboard"}</p>
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-black text-xs">C</div>
        </div>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cx("text-xl lg:text-2xl font-bold tracking-tight",th.p)}>Dashboard</h1>
                <p className={cx("text-sm mt-0.5 capitalize",th.s)}>{new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</p>
              </div>
              <Btn variant="amber" onClick={()=>setBilling(true)}>DINERO Facturacion</Btn>
            </div>
            <DateStrip selected={selDate} onChange={setSelDate} th={th} dark={dark}/>
            <div className={cx("flex gap-1.5 p-1 rounded-2xl w-fit",th.pill)}>
              {courtTypes.map(ct=>(
                <Pill key={ct} active={courtFilter===ct} onClick={()=>setCourtFilter(ct)} th={th}>{ct==="all"?"Todas":ct}</Pill>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <KpiCard icon="Jug" label="Jugadores" value={totalPl} kpiFrom={th.kpiEm} th={th}/>
              <KpiCard icon="HISTORIAL" label="Slots ocupados" value={occupied+"/"+slotsDay.length} kpiFrom={th.kpiSk} th={th}/>
              <KpiCard icon="Ent" label="Canchas enteras" value={fullCts} kpiFrom={th.kpiVi} th={th}/>
              <KpiCard icon="$" label="Facturacion hoy" value={fmt(billDay.total)} sub="tap para detalles" kpiFrom={th.kpiAm} onClick={()=>setBilling(true)} th={th}/>
            </div>
            <div className={cx(th.card,"overflow-hidden")}>
              <div className={cx("flex items-center justify-between px-6 py-4 border-b",th.div)}>
                <div>
                  <h2 className={cx("font-semibold",th.p)}>Slots del da</h2>
                  <p className={cx("text-xs mt-0.5",th.s)}>
                    {new Date(selDate+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
                    {selDate===tod()&&<span className="ml-2 text-emerald-500 font-medium">? Hoy</span>}
                  </p>
                </div>
                <Btn variant="ghost" size="sm" onClick={()=>{setSDate(selDate);setSHours([]);setSlotModal(true);}}>+ Agregar slots</Btn>
              </div>
              {slotsDay.length===0?(
                <div className="py-16 text-center">
                  <p className="text-4xl mb-3">?</p>
                  <p className={cx("text-sm font-medium",th.s)}>Sin slots este da</p>
                  <button onClick={()=>{setSDate(selDate);setSlotModal(true);}} className="mt-3 text-emerald-500 text-xs hover:underline font-medium">Agregar horarios ?</button>
                </div>
              ):(
                <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={cx("border-b",th.div)}>
                        {["Hora","Cancha","Jugadores","Estado","Pago","Factura","Acciones"].map(h=>(
                          <th key={h} className={cx("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider first:pl-6 last:pr-6 last:text-right",th.s)}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{slotsDay.map((slot,i)=><SlotRow key={i} slot={slot} i={i}/>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CANCHAS */}
        {tab==="courts"&&(
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cx("text-2xl font-bold tracking-tight",th.p)}>Canchas</h1>
                <p className={cx("text-sm mt-0.5",th.s)}>Precio fijo {fmt(PRECIO_CANCHA)} ? {courts.length} canchas</p>
              </div>
              <Btn variant="primary" onClick={()=>{setEditCourt(null);setCForm({nombre_cancha:"",deporte:"Futbol",tipo_superficie:"Cesped Sinttico"});setCourtModal(true);}}>+ Nueva cancha</Btn>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              {[{l:"Cancha entera",v:fmt(PRECIO_CANCHA),s:"dueo recibe"},{l:"Por jugador",v:fmt(PRECIO_CANCHA/MAX_PLAYERS),s:"si se llena"},{l:"Pts. individual",v:PTS_INDIVIDUAL+" pts",s:"por lugar"},{l:"Pts. entera",v:PTS_ENTERA+" pts",s:"cancha completa"}].map(i=>(
                <div key={i.l} className={cx(th.card,"p-4")}>
                  <p className={cx("text-[11px] uppercase tracking-wide font-semibold",th.s)}>{i.l}</p>
                  <p className={cx("font-bold text-lg mt-0.5",th.p)}>{i.v}</p>
                  <p className={cx("text-xs",th.s)}>{i.s}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
              {courts.map(c=>{
                const slots=Object.values(c.availableSlots||{});
                const future=slots.filter(s=>s.date>=tod()).length;
                const players=slots.reduce((a,s)=>a+(s.playersJoined||0),0);
                return (
                  <div key={c.id} className={cx(th.card,"p-5 transition-all")}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className={cx("font-semibold",th.p)}>{c.nombre_cancha}</p>
                        <p className="text-emerald-500 text-xs font-medium mt-0.5">{c.deporte} ? {c.tipo_superficie}</p>
                      </div>
                      <Tag c="amber" th={th}>{PTS_INDIVIDUAL} pts</Tag>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[{v:future,l:"slots",cl:th.p},{v:players,l:"jugadores",cl:dark?"text-sky-400":"text-sky-600"},{v:fmt(PRECIO_CANCHA),l:"precio",cl:cx(dark?"text-amber-400":"text-amber-600","text-xs")}].map(m=>(
                        <div key={m.l} className={cx(dark?"bg-white/5":"bg-slate-50","rounded-xl py-2.5 text-center")}>
                          <p className={cx("font-bold",m.cl)}>{m.v}</p>
                          <p className={cx("text-[10px] mt-0.5",th.s)}>{m.l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>{setEditCourt(c.id);setCForm({nombre_cancha:c.nombre_cancha,deporte:c.deporte,tipo_superficie:c.tipo_superficie});setCourtModal(true);}}
                        className={cx("flex-1 py-2 text-xs font-semibold rounded-xl transition", dark?"bg-white/5 hover:bg-white/10 text-slate-300":"bg-slate-100 hover:bg-slate-200 text-slate-600")}>EDITAR Editar</button>
                      <button onClick={()=>{setSCourtId(c.id);setSDate(tod());setSHours([]);setSlotModal(true);}}
                        className={cx("flex-1 py-2 text-xs font-semibold rounded-xl ring-1 transition",dark?"text-emerald-400 bg-emerald-500/10 ring-emerald-500/20":"text-emerald-600 bg-emerald-50 ring-emerald-200")}>+ Slots</button>
                      <button onClick={()=>setHistory({court:c,date:tod()})}
                        className={cx("px-2.5 py-1 text-xs font-semibold rounded-xl ring-1 transition",dark?"text-sky-400 bg-sky-500/10 ring-sky-500/20":"text-sky-600 bg-sky-50 ring-sky-200")}>?</button>
                      <Btn variant="danger" size="sm" onClick={()=>delCourt(c.id)}>X</Btn>
                    </div>
                  </div>
                );
              })}
              {!courts.length&&(
                <div className="col-span-3 py-20 text-center">
                  <p className="text-5xl mb-3">CANCHA</p>
                  <p className={cx("font-medium mb-4",th.s)}>Sin canchas todava</p>
                  <Btn variant="primary" onClick={()=>setCourtModal(true)}>Crear primera cancha</Btn>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HORARIOS */}
        {tab==="slots"&&(
          <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cx("text-2xl font-bold tracking-tight",th.p)}>Horarios</h1>
                <p className={cx("text-sm mt-0.5",th.s)}>Slots disponibles por cancha</p>
              </div>
              <Btn variant="primary" onClick={()=>{setSDate(tod());setSHours([]);setSlotModal(true);}}>+ Agregar slots</Btn>
            </div>
            <div className={cx("flex gap-1.5 p-1 rounded-2xl w-fit",th.pill)}>
              {courtTypes.map(ct=><Pill key={ct} active={courtFilter===ct} onClick={()=>setCourtFilter(ct)} th={th}>{ct==="all"?"Todas":ct}</Pill>)}
            </div>
            {filteredCourts.map(c=>{
              const slots=Object.entries(c.availableSlots||{}).map(([key,s])=>({key,...s})).filter(s=>s.date>=tod()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
              const grouped=slots.reduce((acc,s)=>{(acc[s.date]||(acc[s.date]=[])).push(s);return acc;},{});
              return (
                <div key={c.id} className={cx(th.card,"p-5")}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={cx("font-semibold",th.p)}>{c.nombre_cancha}</h3>
                      <p className={cx("text-xs",th.s)}>{slots.length} slots proximos</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setHistory({court:c,date:tod()})}
                        className={cx("px-3 py-1.5 text-xs font-semibold rounded-xl ring-1 transition",dark?"text-sky-400 bg-sky-500/10 ring-sky-500/20":"text-sky-600 bg-sky-50 ring-sky-200")}>HISTORIAL Historial</button>
                      <Btn variant="ghost" size="sm" onClick={()=>{setSCourtId(c.id);setSDate(tod());setSHours([]);setSlotModal(true);}}>+ Agregar</Btn>
                    </div>
                  </div>
                  {!Object.keys(grouped).length?<p className={cx("text-sm",th.s)}>Sin slots proximos.</p>:(
                    Object.entries(grouped).map(([date,ds])=>(
                      <div key={date} className="mb-4">
                        <p className={cx("text-[11px] font-semibold uppercase tracking-wider mb-2",th.s)}>
                          {new Date(date+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
                          {date===tod()&&<span className="ml-2 text-emerald-500">? Hoy</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ds.map(s=>{
                            const st=slotStatus(s);
                            return (
                              <button key={s.key} onClick={()=>openDetail({...s,courtId:c.id,courtName:c.nombre_cancha})}
                                className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ring-1",
                                  s.blocked?(dark?"bg-rose-500/8 ring-rose-500/20 text-rose-400":"bg-rose-50 ring-rose-200 text-rose-600"):
                                  s.bookingType==="full"?(dark?"bg-violet-500/10 ring-violet-500/20 text-violet-400":"bg-violet-50 ring-violet-200 text-violet-600"):
                                  (s.playersJoined||0)>0?(dark?"bg-emerald-500/10 ring-emerald-500/20 text-emerald-400":"bg-emerald-50 ring-emerald-200 text-emerald-600"):
                                  cx(dark?"bg-white/5 ring-white/8":"bg-slate-50 ring-slate-200",th.s)
                                )}>
                                <div className={cx("w-1.5 h-1.5 rounded-full",st.dot)}/>{s.time}
                                {(s.playersJoined||0)>0&&!s.blocked&&<span className="bg-emerald-500 text-black px-1.5 py-0.5 rounded-full text-[10px] font-bold">{s.playersJoined}/{MAX_PLAYERS}</span>}
                                {!(s.playersJoined||0)&&!s.blocked&&<span onClick={e=>{e.stopPropagation();delSlot(c.id,s.key,false);}} className="text-rose-500 font-black ml-0.5">X</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* BUSCADOR */}
        {tab==="search"&&(
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-4xl mx-auto">
            <div>
              <h1 className={cx("text-2xl font-bold tracking-tight",th.p)}>Buscador Global</h1>
              <p className={cx("text-sm mt-0.5",th.s)}>Canchas, slots activos, usuarios</p>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">BUSCAR</div>
              <input value={gSearch} onChange={e=>setGSearch(e.target.value)}
                placeholder="Buscar cancha, hora, apodo de usuario?"
                className={cx("w-full border rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none transition focus:border-emerald-400",th.inp)}/>
              {gLoading&&<div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"/>}
            </div>
            {gSearch.length>=2&&(
              <div className="space-y-6">
                {gResults.courts.length>0&&(
                  <div>
                    <p className={cx("text-[11px] font-semibold uppercase tracking-wider mb-3",th.s)}>CANCHA Canchas ({gResults.courts.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {gResults.courts.map(c=>(
                        <button key={c.id} onClick={()=>setTab("courts")} className={cx(th.card,"p-4 text-left transition hover:brightness-95 w-full")}>
                          <p className={cx("font-semibold",th.p)}>{c.nombre_cancha}</p>
                          <p className="text-emerald-500 text-xs mt-0.5">{c.deporte} ? {c.tipo_superficie}</p>
                          <div className="flex gap-3 mt-2 text-xs">
                            <span className={th.s}>{Object.keys(c.availableSlots||{}).length} slots</span>
                            <span className={th.s}>{Object.values(c.availableSlots||{}).reduce((a,s)=>a+(s.playersJoined||0),0)} jugadores</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {gResults.slots.length>0&&(
                  <div>
                    <p className={cx("text-[11px] font-semibold uppercase tracking-wider mb-3",th.s)}>FUTBOL Slots con jugadores ({gResults.slots.length})</p>
                    <div className={cx(th.card,"overflow-hidden")}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cx("border-b",th.div)}>
                            {["Fecha","Hora","Cancha","Jugadores","Estado"].map(h=>(
                              <th key={h} className={cx("px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider",th.s)}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gResults.slots.map((slot,i)=>{
                            const st=slotStatus(slot);
                            return (
                              <tr key={i} className={cx("border-b cursor-pointer",th.div,th.rh)} onClick={()=>openDetail(slot)}>
                                <td className={cx("px-4 py-2.5 text-xs",th.s)}>{slot.date}</td>
                                <td className={cx("px-4 py-2.5 font-bold",th.p)}>{slot.time}</td>
                                <td className={cx("px-4 py-2.5 text-xs",th.s)}>{slot.courtName}</td>
                                <td className="px-4 py-2.5 text-xs text-emerald-500 font-semibold">{slot.playersJoined}/{MAX_PLAYERS}</td>
                                <td className="px-4 py-2.5"><Tag c={st.c} th={th}>{st.label}</Tag></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {gResults.users.length>0&&(
                  <div>
                    <p className={cx("text-[11px] font-semibold uppercase tracking-wider mb-3",th.s)}>USUARIO Usuarios ({gResults.users.length})</p>
                    <div className="space-y-2">
                      {gResults.users.map(u=>(
                        <div key={u.uid} className={cx(th.card,"p-4 flex items-center gap-3")}>
                          <img src={u.photoURL||"https://ui-avatars.com/api/?name="+u.username+"&background=151523&color=34d399"} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt=""/>
                          <div className="flex-1 min-w-0">
                            <p className={cx("font-semibold",th.p)}>{u.username}</p>
                            <p className={cx("text-xs",th.s)}>{u.deporte||"?"} ? {u.zona||"?"} ? {u.nivel||"?"}</p>
                          </div>
                          <div className="text-right">
                            <p className={cx("text-xs font-semibold",dark?"text-emerald-400":"text-emerald-600")}>{u.hoursPlayedFutbol||0} hs</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!gResults.courts.length&&!gResults.slots.length&&!gResults.users.length&&!gLoading&&(
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">BUSCAR</p>
                    <p className={cx("text-sm font-medium",th.s)}>Sin resultados para "{gSearch}"</p>
                  </div>
                )}
              </div>
            )}
            {gSearch.length<2&&(
              <div className={cx("text-center py-16",th.s)}>
                <p className="text-5xl mb-3">BUSCAR</p>
                <p className="text-sm font-medium">Escribi al menos 2 caracteres</p>
              </div>
            )}
          </div>
        )}

        {/* PERFIL */}
        {tab==="profile"&&(
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cx("text-2xl font-bold tracking-tight",th.p)}>Mi Complejo</h1>
                <p className={cx("text-sm mt-0.5",th.s)}>Informacin pblica visible por los jugadores</p>
              </div>
              <Btn variant="primary" disabled={savingP} onClick={saveProfile}>{savingP?"Guardando?":"Guardar cambios"}</Btn>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={cx(th.card,"p-5 space-y-4")}>
                <TInput label="Nombre" value={profForm.name} onChange={e=>setProfForm(p=>({...p,name:e.target.value}))} placeholder="Ej: La Bostanera" th={th}/>
                <TInput label="Direccion" value={profForm.address} onChange={e=>setProfForm(p=>({...p,address:e.target.value}))} placeholder="Ej: Brandsen 805" th={th}/>
                <TInput label="Zona / Barrio" value={profForm.zone} onChange={e=>setProfForm(p=>({...p,zone:e.target.value}))} placeholder="Ej: La Boca" th={th}/>
                <div>
                  <label className={cx("block text-[11px] font-semibold uppercase tracking-wider mb-1.5",th.s)}>Descripcion</label>
                  <textarea value={profForm.descripcion} onChange={e=>setProfForm(p=>({...p,descripcion:e.target.value}))}
                    rows={4} placeholder="Describe tu complejo..."
                    className={cx("w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition resize-none focus:border-emerald-400",th.inp)}/>
                </div>
              </div>
              <div className={cx(th.card,"p-5")}>
                <p className={cx("text-xs font-semibold uppercase tracking-wider mb-3",th.s)}>Vista previa</p>
                <div className={cx("rounded-2xl overflow-hidden h-40 mb-4",dark?"bg-white/5":"bg-slate-100")}>
                  <img src={complexData?.image||"https://placehold.co/600x300/e2e8f0/64748btext=Complejo"} className="w-full h-full object-cover" alt=""/>
                </div>
                <p className={cx("font-bold text-lg leading-tight",th.p)}>{profForm.name||complexData?.name}</p>
                <p className="text-emerald-500 text-xs font-medium mt-1">UBICACION {profForm.zone} ? {profForm.address}</p>
                <p className={cx("text-xs mt-2 line-clamp-2",th.s)}>{profForm.descripcion}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {courts.map(c=><span key={c.id} className={cx("text-[11px] px-2 py-0.5 rounded-lg font-medium ring-1",dark?"bg-emerald-500/8 text-emerald-400 ring-emerald-500/15":"bg-emerald-50 text-emerald-600 ring-emerald-200")}>{c.nombre_cancha}</span>)}
                </div>
                <div className={cx("mt-4 pt-4 border-t",th.div)}>
                  <p className={cx("text-[11px] font-medium",th.s)}>Precio fijo {fmt(PRECIO_CANCHA)}/turno.</p>
                  <a href="mailto:soporte@canchapp.com" className="text-[11px] text-emerald-500 hover:underline mt-0.5 block">Contactar soporte ?</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALES */}

      {/* Historial de cancha */}
      <Modal open={!!history} onClose={()=>setHistory(null)} size="lg" th={th}>
        {history&&(<>
          <MH title={"HISTORIAL "+history.court.nombre_cancha} sub="Historial por da" onClose={()=>setHistory(null)} th={th}/>
          <div className="p-6 space-y-4">
            <TInput label="Fecha" type="date" value={history.date} onChange={e=>setHistory(p=>({...p,date:e.target.value}))} th={th}/>
            <p className={cx("text-[11px] font-semibold uppercase tracking-wider",th.s)}>
              {histData.length} slots ? {new Date(history.date+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </p>
            {histData.length===0?(
              <div className="text-center py-10"><p className="text-4xl mb-2">?</p><p className={cx("text-sm",th.s)}>Sin slots este da</p></div>
            ):(
              <div className="space-y-2">
                {histData.map(slot=>{
                  const st=slotStatus(slot);
                  const invoice=slot.bookingType==="full"?PRECIO_CANCHA:(slot.playersJoined||0)*(PRECIO_CANCHA/MAX_PLAYERS);
                  const hasPl=(slot.playersJoined||0)>0;
                  return (
                    <div key={slot.key} className={cx(dark?"bg-white/4 ring-1 ring-white/6":"bg-slate-50 ring-1 ring-slate-200","rounded-2xl p-4")}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={cx("font-black text-lg",th.p)}>{slot.time} hs</span>
                          <div className="flex items-center gap-1.5">
                            <div className={cx("w-1.5 h-1.5 rounded-full",st.dot)}/><Tag c={st.c} th={th}>{st.label}</Tag>
                          </div>
                          <PayTag status={slot.paymentStatus||(hasPl?"inperson":null)} th={th} dark={dark}/>
                        </div>
                        <span className={cx("font-bold text-sm",dark?"text-amber-400":"text-amber-600")}>{fmt(invoice)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        <span className={th.s}>USUARIO {slot.playersJoined||0}/{MAX_PLAYERS} jugadores</span>
                        {slot.bookingType==="full"&&<span className={dark?"text-violet-400":"text-violet-600"}>CANCHA Entera</span>}
                        {slot.blocked&&<span className="text-rose-500">BLOQUEAR Bloqueado</span>}
                      </div>
                      {(Object.keys(slot.players||{}).length>0||Object.keys(slot.guests||{}).length>0)&&(
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {Object.keys(slot.players||{}).map(uid=>(
                            <span key={uid} className={cx("text-[10px] px-2 py-0.5 rounded-full ring-1",dark?"bg-emerald-500/10 text-emerald-400 ring-emerald-500/20":"bg-emerald-50 text-emerald-600 ring-emerald-200")}>{uid.substring(0,8)}?</span>
                          ))}
                          {Object.entries(slot.guests||{}).map(([gid,g])=>(
                            <span key={gid} className={cx("text-[10px] px-2 py-0.5 rounded-full ring-1",dark?"bg-slate-500/10 text-slate-400 ring-slate-500/20":"bg-slate-100 text-slate-600 ring-slate-200")}>USUARIO {g.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Resumen */}
                <div className={cx("rounded-2xl p-4",dark?"bg-emerald-500/10 ring-1 ring-emerald-500/20":"bg-emerald-50 ring-1 ring-emerald-200")}>
                  <p className={cx("text-xs font-semibold mb-2",dark?"text-emerald-400":"text-emerald-700")}>Resumen del da</p>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    {[
                      {v:histData.reduce((a,s)=>a+(s.playersJoined||0),0),l:"jugadores"},
                      {v:histData.filter(s=>(s.playersJoined||0)>0).length+"/"+histData.length,l:"slots ocupados"},
                      {v:fmt(histData.reduce((a,s)=>a+(s.bookingType==="full"?PRECIO_CANCHA:(s.playersJoined||0)*(PRECIO_CANCHA/MAX_PLAYERS)),0)),l:"facturado"},
                    ].map(m=>(
                      <div key={m.l}>
                        <p className={cx("font-black text-base",th.p)}>{m.v}</p>
                        <p className={th.s}>{m.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>)}
      </Modal>

      {/* Facturacion */}
      <Modal open={billing} onClose={()=>setBilling(false)} size="lg" th={th}>
        <MH title="Facturacion" sub="Ingresos del complejo" onClose={()=>setBilling(false)} th={th}/>
        <div className="p-6 space-y-4">
          <div className={cx("flex gap-1.5 p-1 rounded-2xl",th.pill)}>
            {[{k:"day",l:"Hoy"},{k:"fortnight",l:"15 das"},{k:"month",l:"Mes"}].map(t=>(
              <Pill key={t.k} active={billPeriod===t.k} onClick={()=>setBillPeriod(t.k)} th={th}>{t.l}</Pill>
            ))}
          </div>
          {(()=>{
            const days=billPeriod==="day"?1:billPeriod==="fortnight"?15:30;
            const b=calcBill(days);
            return (
              <div className="space-y-3">
                <div className={cx(dark?"bg-emerald-500/10 ring-1 ring-emerald-500/15":"bg-emerald-50 ring-1 ring-emerald-200","rounded-2xl p-5 text-center")}>
                  <p className={cx("text-[11px] uppercase tracking-wider font-semibold mb-1",th.s)}>Total facturado</p>
                  <p className={cx("text-4xl font-black",th.p)}>{fmt(b.total)}</p>
                  <p className={cx("text-xs mt-1",th.s)}>{billPeriod==="day"?"Hoy":billPeriod==="fortnight"?"ultimos 15 das":"ultimo mes"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={cx(dark?"bg-violet-500/8 ring-1 ring-violet-500/15":"bg-violet-50 ring-1 ring-violet-200","rounded-2xl p-4")}>
                    <p className={cx("text-[11px] font-semibold",th.s)}>Canchas enterass</p>
                    <p className={cx("font-black text-3xl mt-1",dark?"text-violet-400":"text-violet-600")}>{b.ent}</p>
                    <p className={cx("text-xs mt-0.5",th.s)}>{fmt(b.ingrEnt)}</p>
                  </div>
                  <div className={cx(dark?"bg-sky-500/8 ring-1 ring-sky-500/15":"bg-sky-50 ring-1 ring-sky-200","rounded-2xl p-4")}>
                    <p className={cx("text-[11px] font-semibold",th.s)}>Jugadores individuales</p>
                    <p className={cx("font-black text-3xl mt-1",dark?"text-sky-400":"text-sky-600")}>{b.ind}</p>
                    <p className={cx("text-xs mt-0.5",th.s)}>{fmt(b.ingrInd)}</p>
                  </div>
                </div>
                <div className={cx(th.card,"p-4 text-xs space-y-2")}>
                  <p className={cx("font-semibold mb-2",th.m)}>Desglose por turno</p>
                  {[{l:"Cancha entera (100 pts)",v:fmt(PRECIO_CANCHA)+" para vos"},{l:"10 individuales (10 pts c/u)",v:fmt(PRECIO_CANCHA)+" para vos"},{l:"Comisin CanchAPP ("+COMISION_PCT*100+"%)",v:fmt(PRECIO_CANCHA*COMISION_PCT)+" por turno",muted:true}].map(r=>(
                    <div key={r.l} className={cx("flex justify-between",r.muted?th.s:th.m)}>
                      <span>{r.l}</span><span className="font-semibold">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* Estado de pago */}
      <Modal open={!!payModal} onClose={()=>setPayModal(null)} size="sm" th={th}>
        {payModal&&(<>
          <MH title="Estado de pago" sub={payModal.time+" hs ? "+payModal.courtName} onClose={()=>setPayModal(null)} th={th}/>
          <div className="p-6 space-y-3">
            {Object.entries(PAY_STATUS).map(([key,val])=>(
              <button key={key} onClick={()=>setPayStatus(payModal,key)}
                className={cx("w-full flex items-center gap-3 p-3.5 rounded-2xl ring-1 transition-all text-left",
                  payModal.paymentStatus===key
                    ?(dark?cx(PAY_DARK[key],"ring-2"):cx(PAY_LIGHT[key],"ring-2"))
                    :(dark?"bg-white/3 ring-white/6 hover:bg-white/8":"bg-slate-50 ring-slate-200 hover:bg-slate-100")
                )}>
                <span className={cx("w-3 h-3 rounded-full flex-shrink-0",val.dot)}/>
                <p className={cx("font-semibold text-sm",payModal.paymentStatus===key?(dark?PAY_DARK[key].split(" ")[1]:PAY_LIGHT[key].split(" ")[1]):th.p)}>{val.label}</p>
                {payModal.paymentStatus===key&&<span className="ml-auto text-emerald-500 font-bold">OK</span>}
              </button>
            ))}
          </div>
        </>)}
      </Modal>

      {/* Detalle slot */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} th={th}>
        {detail&&(<>
          <MH title={detail.time+" hs"} sub={detail.courtName+" ? "+detail.date} onClose={()=>setDetail(null)} th={th}/>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                {l:"Jugadores",v:(detail.playersJoined||0)+"/10",cl:th.p},
                {l:"Facturado",v:fmt(detail.bookingType==="full"?PRECIO_CANCHA:(detail.playersJoined||0)*(PRECIO_CANCHA/MAX_PLAYERS)),cl:dark?"text-amber-400":"text-amber-600"},
                {l:"Tipo",v:detail.blocked?"Bloqueado":detail.bookingType==="full"?"Entera":"Abierto",cl:th.m},
              ].map(m=>(
                <div key={m.l} className={cx(dark?"bg-white/5 ring-1 ring-white/8":"bg-slate-50 ring-1 ring-slate-200","rounded-2xl p-3 text-center")}>
                  <p className={cx("font-bold",m.cl)}>{m.v}</p>
                  <p className={cx("text-[10px] mt-0.5",th.s)}>{m.l}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <PayTag status={detail.paymentStatus||"inperson"} th={th} dark={dark}/>
              <button onClick={()=>{setPayModal(detail);setDetail(null);}} className={cx("text-xs hover:underline font-medium",th.s)}>Cambiar ?</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!detail.blocked&&detail.bookingType!=="full"&&(
                <button onClick={()=>{setAddModal(detail);setDetail(null);setAddTab("registered");}}
                  className={cx("flex-1 py-2 text-xs font-semibold rounded-xl ring-1 transition",dark?"text-emerald-400 bg-emerald-500/10 ring-emerald-500/20":"text-emerald-600 bg-emerald-50 ring-emerald-200")}>+ Jugador</button>
              )}
              {!detail.blocked&&detail.bookingType!=="full"&&(
                <button onClick={()=>markFull(detail)}
                  className={cx("flex-1 py-2 text-xs font-semibold rounded-xl ring-1 transition",dark?"text-violet-400 bg-violet-500/10 ring-violet-500/20":"text-violet-600 bg-violet-50 ring-violet-200")}>? Entera</button>
              )}
              <button onClick={()=>toggleBlock(detail)}
                className={cx("flex-1 py-2 text-xs font-semibold rounded-xl ring-1 transition",
                  detail.blocked?(dark?"text-emerald-400 bg-emerald-500/10 ring-emerald-500/20":"text-emerald-600 bg-emerald-50 ring-emerald-200")
                                :(dark?"text-rose-400 bg-rose-500/10 ring-rose-500/20":"text-rose-600 bg-rose-50 ring-rose-200")
                )}>{detail.blocked?"DESBLOQUEAR Desbloquear":"BLOQUEAR Bloquear"}</button>
            </div>
            <div>
              <p className={cx("text-[11px] font-semibold uppercase tracking-wider mb-2",th.s)}>Jugadores ({detPl.length}/10)</p>
              {loadPl?(
                <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/></div>
              ):!detPl.length?(
                <p className={cx("text-sm text-center py-6",th.s)}>Sin jugadores.</p>
              ):(
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {detPl.map((p,i)=>(
                    <div key={i} className={cx(dark?"bg-white/4 ring-1 ring-white/6":"bg-slate-50 ring-1 ring-slate-200","rounded-xl px-3 py-2.5 flex items-center gap-3")}>
                      {p.type==="guest"?
                        <div className={cx("w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0",dark?"bg-slate-700":"bg-slate-200")}>USUARIO</div>:
                        <img src={p.photoURL||"https://ui-avatars.com/api/?name="+p.username+"&background=151523&color=34d399"} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt=""/>
                      }
                      <div className="flex-1 min-w-0">
                        <p className={cx("font-semibold text-sm truncate",th.p)}>{p.username}</p>
                        <p className={cx("text-xs",th.s)}>{p.type==="guest"?"Invitado ? "+(p.invBy||""):(p.hoursPlayedFutbol||0)+" hs"}</p>
                      </div>
                      <button onClick={()=>cancelPlayer(detail,p.uid,p.type==="guest")} className="text-rose-500 hover:text-rose-600 text-xs font-semibold flex-shrink-0 transition">Cancelar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>)}
      </Modal>

      {/* Agregar jugador */}
      <Modal open={!!addModal} onClose={()=>setAddModal(null)} th={th}>
        {addModal&&(<>
          <MH title="Agregar jugador" sub={addModal.time+" hs ? "+addModal.courtName+" ? "+(addModal.playersJoined||0)+"/10"} onClose={()=>setAddModal(null)} th={th}/>
          <div className="p-6 space-y-4">
            <div className={cx("flex gap-1.5 p-1 rounded-2xl",th.pill)}>
              {[{k:"registered",l:"USUARIO Registrado"},{k:"guest",l:"? Invitado"}].map(t=>(
                <Pill key={t.k} active={addTab===t.k} onClick={()=>setAddTab(t.k)} th={th}>{t.l}</Pill>
              ))}
            </div>
            {addTab==="registered"&&(
              <div className="space-y-3">
                <div className="relative">
                  <TInput value={pSearch} onChange={e=>setPSearch(e.target.value)} placeholder="Buscar por apodo?" th={th}/>
                  {pLoading&&<div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"/>}
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {pResults.map(p=>(
                    <button key={p.uid} onClick={()=>addRegistered(p.uid,p.username)}
                      className={cx("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition text-left ring-1",dark?"bg-white/4 hover:bg-white/8 ring-white/6":"bg-slate-50 hover:bg-slate-100 ring-slate-200")}>
                      <img src={p.photoURL||"https://ui-avatars.com/api/?name="+p.username+"&background=151523&color=34d399"} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt=""/>
                      <div className="flex-1 min-w-0">
                        <p className={cx("font-semibold text-sm",th.p)}>{p.username}</p>
                        <p className={cx("text-xs",th.s)}>{p.hoursPlayedFutbol||0} hs jugadas</p>
                      </div>
                      <span className="text-emerald-500 text-xs font-semibold">+ Agregar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {addTab==="guest"&&(
              <div className="space-y-3">
                <TInput value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder='Nombre (ej: "El Flaco")' th={th}/>
                <Btn variant="primary" className="w-full" disabled={!guestName.trim()} onClick={addGuest}>Agregar invitado</Btn>
              </div>
            )}
          </div>
        </>)}
      </Modal>

      {/* Nueva/editar cancha */}
      <Modal open={courtModal} onClose={()=>setCourtModal(false)} th={th}>
        <MH title={editCourt?"Editar cancha":"Nueva cancha"} onClose={()=>setCourtModal(false)} th={th}/>
        <div className="p-6 space-y-4">
          <TInput label="Nombre" value={cForm.nombre_cancha} onChange={e=>setCForm(p=>({...p,nombre_cancha:e.target.value}))} placeholder="Ej: Futbol 5 - La Central" th={th}/>
          <div className="grid grid-cols-2 gap-3">
            <TSelect label="Deporte" value={cForm.deporte} onChange={e=>setCForm(p=>({...p,deporte:e.target.value}))} th={th}>
              {["Futbol","Padel","Tenis","Basquet"].map(d=><option key={d}>{d}</option>)}
            </TSelect>
            <TSelect label="Superficie" value={cForm.tipo_superficie} onChange={e=>setCForm(p=>({...p,tipo_superficie:e.target.value}))} th={th}>
              {["Cesped Sintetico","Cemento","Parquet","Tierra"].map(s=><option key={s}>{s}</option>)}
            </TSelect>
          </div>
          <div className={cx("rounded-xl px-4 py-3 text-xs",dark?"bg-sky-500/8 ring-1 ring-sky-500/15 text-sky-400":"bg-sky-50 ring-1 ring-sky-200 text-sky-600")}>
            Precio {fmt(PRECIO_CANCHA)}/turno - {PTS_INDIVIDUAL} pts individual - {PTS_ENTERA} pts entera
          </div>
          <div className="flex gap-3">
            <Btn variant="ghost" className="flex-1" onClick={()=>setCourtModal(false)}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1" onClick={saveCourt}>{editCourt?"Guardar":"Crear cancha"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Agregar slots */}
      <Modal open={slotModal} onClose={()=>setSlotModal(false)} th={th}>
        <MH title="Agregar horarios" onClose={()=>setSlotModal(false)} th={th}/>
        <div className="p-6 space-y-4">
          <TSelect label="Cancha" value={sCourtId} onChange={e=>setSCourtId(e.target.value)} th={th}>
            <option value="">Selecciona una cancha</option>
            {courts.map(c=><option key={c.id} value={c.id}>{c.nombre_cancha}</option>)}
          </TSelect>
          <TInput label="Fecha" type="date" value={sDate} onChange={e=>setSDate(e.target.value)} th={th}/>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={cx("text-[11px] font-semibold uppercase tracking-wider",th.s)}>Horarios</label>
              <div className="flex gap-3 text-xs">
                <button onClick={()=>setSHours(Array.from({length:15},(_,i)=>(i+8).toString().padStart(2,"0")+":00"))} className="text-emerald-500 font-medium hover:underline">Todos</button>
                <button onClick={()=>setSHours([])} className={cx("hover:underline",th.s)}>Limpiar</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({length:15},(_,i)=>{
                const h=(i+8).toString().padStart(2,"0")+":00";
                const sel=sHours.includes(h);
                return (
                  <button key={h} onClick={()=>setSHours(p=>sel?p.filter(x=>x!==h):[...p,h])}
                    className={cx("px-3 py-1.5 rounded-xl text-xs font-semibold transition ring-1",
                      sel?"bg-emerald-500 text-black ring-emerald-500 shadow-sm"
                         :cx(dark?"bg-white/4 ring-white/8":"bg-slate-50 ring-slate-200",th.s)
                    )}>{h}</button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <Btn variant="ghost" className="flex-1" onClick={()=>setSlotModal(false)}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1" disabled={!sCourtId||!sDate||!sHours.length} onClick={addSlots}>
              {sHours.length?"Agregar "+sHours.length+" slots":"Agregar"}
            </Btn>
          </div>
        </div>
      </Modal>

      <Toast show={toast.show} message={toast.message} type={toast.type} th={th}/>
    </div>
  );
}
