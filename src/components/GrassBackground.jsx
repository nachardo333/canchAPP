// src/components/GrassBackground.jsx
// Fondo de cesped animado - particulas verdes que se mueven como pasto con viento
// Uso: <GrassBackground /> como primer hijo de cualquier contenedor position:relative

import { useEffect, useRef } from "react";

export default function GrassBackground({ style = {} }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const stateRef  = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // -- Config --
    const BLADE_COUNT   = 380;   // cantidad de briznas
    const WIND_SPEED    = 0.0008; // que tan rapido cambia el viento
    const WIND_STRENGTH = 28;    // cuanto se doblan las briznas
    const GLOW_CHANCE   = 0.18;  // % de briznas con glow

    function resize() {
      canvas.width  = canvas.offsetWidth  || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
      init(canvas.width, canvas.height);
    }

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    function init(w, h) {
      // Colores de cesped — varias tonalidades de verde muy oscuro
      const greenPalette = [
        { r: 20,  g: 80,  b: 30  },  // verde bosque
        { r: 16,  g: 100, b: 35  },  // verde medio
        { r: 10,  g: 60,  b: 20  },  // verde muy oscuro
        { r: 34,  g: 130, b: 50  },  // verde vivo (pocos)
        { r: 8,   g: 45,  b: 15  },  // casi negro verdoso
      ];

      const blades = Array.from({ length: BLADE_COUNT }, () => {
        const col = greenPalette[Math.floor(Math.random() * greenPalette.length)];
        const height = randBetween(18, 55);
        const hasGlow = Math.random() < GLOW_CHANCE;
        return {
          x:          randBetween(0, w),
          y:          randBetween(h * 0.3, h + 10),  // mas densas abajo
          height,
          width:      randBetween(1.2, 2.8),
          phase:      randBetween(0, Math.PI * 2),    // fase individual de oscilacion
          speed:      randBetween(0.4, 1.3),          // velocidad de oscilacion propia
          col,
          alpha:      randBetween(0.15, hasGlow ? 0.7 : 0.45),
          hasGlow,
          glowSize:   randBetween(4, 10),
          segments:   Math.floor(randBetween(2, 4)),  // segmentos de la curva
        };
      });

      stateRef.current = { blades, wind: 0, windTarget: 0, t: 0 };
    }

    let then = performance.now();

    function draw(now) {
      const dt = Math.min((now - then) / 16.67, 3); // delta normalizado a 60fps
      then = now;

      const w = canvas.width;
      const h = canvas.height;
      const s = stateRef.current;
      if (!s) return;

      s.t += dt;

      // Viento: cambia suavemente con ruido
      s.windTarget = Math.sin(s.t * WIND_SPEED * 60) * WIND_STRENGTH
                   + Math.sin(s.t * WIND_SPEED * 37) * (WIND_STRENGTH * 0.4)
                   + Math.sin(s.t * WIND_SPEED * 19) * (WIND_STRENGTH * 0.15);
      s.wind += (s.windTarget - s.wind) * 0.015 * dt;

      // Fondo
      ctx.clearRect(0, 0, w, h);

      // Gradiente de fondo: negro arriba, verde muy oscuro abajo
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    "#05020c");
      bg.addColorStop(0.55, "#060f08");
      bg.addColorStop(1,    "#071209");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Ordenar por Y para que las mas bajas se dibujen encima (profundidad)
      s.blades.sort((a, b) => a.y - b.y);

      // Dibujar cada brizna
      s.blades.forEach(blade => {
        const osc = Math.sin(s.t * blade.speed * 0.06 + blade.phase);

        // Cuanto se dobla esta brizna: viento global + oscilacion propia
        const bend = s.wind * (blade.height / 45) + osc * 4;

        ctx.save();

        // Glow opcional
        if (blade.hasGlow) {
          ctx.shadowColor = `rgba(34,197,94,0.35)`;
          ctx.shadowBlur  = blade.glowSize;
        }

        // Dibujar brizna como curva bezier
        // La base esta fija, la punta se dobla con el viento
        const tipX = blade.x + bend;
        const tipY = blade.y - blade.height;

        // Control point (un poco mas alla de la mitad)
        const cp1X = blade.x + bend * 0.35;
        const cp1Y = blade.y - blade.height * 0.5;
        const cp2X = blade.x + bend * 0.7;
        const cp2Y = blade.y - blade.height * 0.75;

        ctx.globalAlpha = blade.alpha;

        // Gradiente a lo largo de la brizna: base mas oscura, punta mas clara
        const grad = ctx.createLinearGradient(blade.x, blade.y, tipX, tipY);
        const { r, g, b } = blade.col;
        grad.addColorStop(0,   `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.3, `rgba(${r},${g},${b},0.6)`);
        grad.addColorStop(1,   `rgba(${Math.min(r+20,255)},${Math.min(g+40,255)},${Math.min(b+20,255)},0.9)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth   = blade.width;
        ctx.lineCap     = "round";

        ctx.beginPath();
        ctx.moveTo(blade.x, blade.y);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, tipX, tipY);
        ctx.stroke();

        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    resize();
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:  "fixed",
        inset:     0,
        width:     "100%",
        height:    "100%",
        display:   "block",
        zIndex:    0,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
