// src/components/SplashScreen.jsx
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = [
  { char: "C", type: "canch" },
  { char: "a", type: "canch" },
  { char: "n", type: "canch" },
  { char: "c", type: "canch" },
  { char: "h", type: "canch" },
  { char: "A", type: "app"   },
  { char: "P", type: "app"   },
  { char: "P", type: "app"   },
];

// Posiciones de scatter - cada letra arranca en un lugar distinto
const SCATTER = [
  { x: -260, y: -160, rot: -25, scale: 0.35 },
  { x:  200, y: -200, rot:  20, scale: 0.4  },
  { x: -140, y: -280, rot:  15, scale: 0.35 },
  { x:  300, y: -140, rot: -30, scale: 0.4  },
  { x: -220, y:  200, rot:  22, scale: 0.35 },
  { x:  240, y:  180, rot: -18, scale: 0.4  },
  { x: -180, y:  260, rot:  28, scale: 0.35 },
  { x:  280, y:  150, rot: -22, scale: 0.4  },
];

const LETTER_INTERVAL = 210; // ms entre cada letra
const HOLD_AFTER      = 900; // ms de pausa antes del fade
const TOTAL_MS        = LETTERS.length * LETTER_INTERVAL + HOLD_AFTER;

export default function SplashScreen({ onDone }) {
  const [assembled, setAssembled] = useState([]); // indices de letras ya ensambladas
  const [showTagline, setShowTagline] = useState(false);
  const [showDivider, setShowDivider] = useState(false);
  const [exit, setExit] = useState(false);
  const [ballIdx, setBallIdx] = useState(-1); // que letra esta viajando la pelota
  const timers = useRef([]);

  useEffect(() => {
    // Pequeno delay inicial
    const kickoff = setTimeout(() => {
      // Ensamblar una letra cada LETTER_INTERVAL ms
      for (let i = 0; i < LETTERS.length; i++) {
        const t = setTimeout(() => {
          setBallIdx(i);
          setTimeout(() => {
            setAssembled(prev => [...prev, i]);
          }, 110); // pelota llega 110ms despues -> letra cae
        }, i * LETTER_INTERVAL);
        timers.current.push(t);
      }

      // Tagline y divider
      const afterAll = LETTERS.length * LETTER_INTERVAL + 100;
      const t1 = setTimeout(() => setShowDivider(true), afterAll);
      const t2 = setTimeout(() => setShowTagline(true), afterAll + 200);
      timers.current.push(t1, t2);

      // Fade out
      const t3 = setTimeout(() => {
        setExit(true);
        setTimeout(() => onDone?.(), 550);
      }, TOTAL_MS);
      timers.current.push(t3);
    }, 250);

    timers.current.push(kickoff);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const progress = (assembled.length / LETTERS.length) * 100;

  return (
    <AnimatePresence>
      {!exit && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg,#05020c 0%,#060f0a 55%,#030308 100%)",
            fontFamily: "'Poppins',sans-serif",
            overflow: "hidden",
          }}
        >
          {/* -- Glow radial -- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 55% 38% at 50% 50%, rgba(34,197,94,0.13) 0%, transparent 70%)",
            }}
          />

          {/* -- Particulas -- */}
          <Particles />

          {/* -- Contenedor logo -- */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

            {/* -- Pelota volando -- */}
            <BallFlying ballIdx={ballIdx} assembled={assembled} />

            {/* -- Letras -- */}
            <div style={{ display: "flex", alignItems: "flex-end", lineHeight: 1, position: "relative" }}>
              {/* CANCH */}
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {LETTERS.slice(0, 5).map((l, i) => (
                  <AnimatedLetter
                    key={i}
                    char={l.char}
                    type={l.type}
                    scatter={SCATTER[i]}
                    assembled={assembled.includes(i)}
                    justAssembled={assembled[assembled.length - 1] === i}
                  />
                ))}
              </div>
              {/* APP */}
              <div style={{ display: "flex", alignItems: "flex-end", marginLeft: 6 }}>
                {LETTERS.slice(5).map((l, i) => {
                  const gi = 5 + i;
                  return (
                    <AnimatedLetter
                      key={gi}
                      char={l.char}
                      type={l.type}
                      scatter={SCATTER[gi]}
                      assembled={assembled.includes(gi)}
                      justAssembled={assembled[assembled.length - 1] === gi}
                    />
                  );
                })}
              </div>
            </div>

            {/* -- Divider -- */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={showDivider ? { width: 300, opacity: 1 } : {}}
              transition={{ duration: 0.5, ease: [0.34, 1.2, 0.64, 1] }}
              style={{
                height: 2,
                background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
                borderRadius: 2,
              }}
            />

            {/* -- Tagline -- */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={showTagline ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45 }}
              style={{
                fontSize: 11, letterSpacing: "0.28em", color: "rgba(34,197,94,0.65)",
                textTransform: "uppercase", fontWeight: 600, margin: 0,
              }}
            >
              Tu cancha, tu momento
            </motion.p>

            {/* -- Progress bar -- */}
            <div style={{
              width: 150, height: 2, borderRadius: 2,
              background: "rgba(255,255,255,0.05)", overflow: "hidden", marginTop: 4,
            }}>
              <motion.div
                animate={{ width: progress + "%" }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{
                  height: "100%", background: "linear-gradient(90deg,#16a34a,#22c55e)",
                  borderRadius: 2, boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// -- Letra que vuela desde su posicion de scatter hacia su lugar ---------------
function AnimatedLetter({ char, type, scatter, assembled, justAssembled }) {
  const isApp   = type === "app";
  const fontSize = isApp ? "clamp(56px,11vw,92px)" : "clamp(68px,13.5vw,112px)";

  return (
    <motion.span
      initial={{
        x: scatter.x, y: scatter.y,
        rotate: scatter.rot, scale: scatter.scale,
        opacity: 0,
      }}
      animate={assembled
        ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
        : { x: scatter.x, y: scatter.y, rotate: scatter.rot, scale: scatter.scale, opacity: 0.15 }
      }
      transition={{
        type: "spring",
        damping: 11,
        stiffness: 220,
        mass: 0.9,
      }}
      style={{
        display: "inline-block",
        fontFamily: "'Bebas Neue','Impact',sans-serif",
        fontSize,
        lineHeight: 1,
        color: isApp ? "#22c55e" : "#ffffff",
        textShadow: isApp
          ? "0 0 35px rgba(34,197,94,0.65), 0 0 70px rgba(34,197,94,0.25)"
          : "0 3px 24px rgba(0,0,0,0.5)",
        userSelect: "none",
      }}
    >
      {/* Flash de impacto al ensamblar */}
      {justAssembled && <ImpactFlash />}
      {char}
    </motion.span>
  );
}

// -- Flash verde puntual cuando la letra aterriza -----------------------------
function ImpactFlash() {
  return (
    <motion.span
      initial={{ opacity: 0.9, scale: 0.4 }}
      animate={{ opacity: 0, scale: 2.2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        position: "absolute",
        inset: "auto 50% 0 50%",
        width: 80, height: 24,
        marginLeft: -40,
        borderRadius: "50%",
        background: "radial-gradient(ellipse,rgba(34,197,94,0.7) 0%,transparent 70%)",
        pointerEvents: "none",
        filter: "blur(2px)",
      }}
    />
  );
}

// -- Pelota que vuela entre letras ---------------------------------------------
// Usamos positions fijas en X basadas en el indice (% del ancho)
function BallFlying({ ballIdx, assembled }) {
  const visible = ballIdx >= 0 && ballIdx < LETTERS.length;

  // Mapeamos cada letra a un X aproximado (en px, centrado en 0)
  // 8 letras distribuidas en ~360px de logo (de -180 a +180)
  const positions = [-200, -140, -80, -20, 40, 110, 165, 215];
  // Y: arriba del logo (sube un poco en el centro para dar arco)
  const arcY = [
    -20, -40, -55, -45, -25,   // CANCH - arco suave
    -15, -30, -20,              // APP - mas plano
  ];

  const x = visible ? positions[ballIdx] : -280;
  const y = visible ? arcY[ballIdx] : 0;

  return (
    <motion.div
      animate={{ x, y, opacity: visible ? 1 : 0 }}
      transition={{
        x: { duration: 0.13, ease: "easeInOut" },
        y: { duration: 0.13, ease: "easeInOut" },
        opacity: { duration: 0.15 },
      }}
      style={{
        position: "absolute",
        top: "50%", left: "50%",
        marginLeft: -22, marginTop: -22,
        zIndex: 10, pointerEvents: "none",
        filter: "drop-shadow(0 0 14px rgba(34,197,94,0.9))",
      }}
    >
      <BallSVG />
    </motion.div>
  );
}

// -- SVG de la pelota (rotando siempre) ---------------------------------------
function BallSVG() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.45, ease: "linear", repeat: Infinity }}
      style={{ width: 44, height: 44 }}
    >
      <svg viewBox="0 0 100 100" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bGrad" cx="37%" cy="33%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.97"/>
            <stop offset="100%" stopColor="#d1d1d1"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#bGrad)" stroke="#cccccc" strokeWidth="1.5"/>
        <g fill="#111111" opacity="0.88">
          <polygon points="50,26 63,35 59,51 41,51 37,35"/>
          <polygon points="28,18 40,18 37,35 22,38 18,24"/>
          <polygon points="72,18 82,24 78,38 63,35 60,18"/>
          <polygon points="18,64 22,38 37,51 33,66 16,70"/>
          <polygon points="82,64 84,70 67,66 63,51 78,38"/>
          <polygon points="33,66 41,51 59,51 67,66 50,76"/>
        </g>
        <ellipse cx="37" cy="33" rx="9" ry="6" fill="white" opacity="0.38" transform="rotate(-20,37,33)"/>
      </svg>
    </motion.div>
  );
}

// -- Particulas flotantes de fondo ---------------------------------------------
function Particles() {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.8,
    delay: Math.random() * 3,
    dur: Math.random() * 3 + 2.5,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {dots.map(d => (
        <motion.div
          key={d.id}
          style={{
            position: "absolute",
            left: d.x + "%", top: d.y + "%",
            width: d.size, height: d.size,
            borderRadius: "50%",
            background: "#22c55e",
          }}
          animate={{ opacity: [0, 0.55, 0], y: [0, -35, -70] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
