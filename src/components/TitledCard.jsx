// src/components/TiltedCard.jsx
// CSS inline — sin archivo separado para evitar problemas de path
import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const springValues = { damping: 30, stiffness: 100, mass: 2 };

const styles = `
  .tilted-card-figure {
    position: relative;
    width: 100%;
    height: 100%;
    perspective: 800px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .tilted-card-inner {
    position: relative;
    transform-style: preserve-3d;
  }
  .tilted-card-img {
    position: absolute;
    top: 0; left: 0;
    object-fit: cover;
    border-radius: 15px;
    will-change: transform;
    transform: translateZ(0);
  }
  .tilted-card-overlay {
    position: absolute;
    top: 0; left: 0;
    z-index: 2;
    will-change: transform;
    transform: translateZ(30px);
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }
  .tilted-card-caption {
    pointer-events: none;
    position: absolute;
    left: 0; top: 0;
    border-radius: 4px;
    background-color: #fff;
    padding: 4px 10px;
    font-size: 10px;
    color: #2d2d2d;
    opacity: 0;
    z-index: 3;
  }
`;

export default function TiltedCard({
  imageSrc,
  altText = 'Tilted card image',
  captionText = '',
  containerHeight = '300px',
  containerWidth = '100%',
  imageHeight = '300px',
  imageWidth = '300px',
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  showMobileWarning = false,
  showTooltip = false,
  overlayContent = null,
  displayOverlayContent = false,
}) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0);
  const rotateFigcaption = useSpring(0, { stiffness: 350, damping: 30, mass: 1 });
  const [lastY, setLastY] = useState(0);

  function handleMouse(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
    rotateFigcaption.set(-(offsetY - lastY) * 0.6);
    setLastY(offsetY);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
    opacity.set(1);
  }

  function handleMouseLeave() {
    opacity.set(0);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    rotateFigcaption.set(0);
  }

  return (
    <>
      <style>{styles}</style>
      <figure
        ref={ref}
        className="tilted-card-figure"
        style={{ height: containerHeight, width: containerWidth }}
        onMouseMove={handleMouse}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className="tilted-card-inner"
          style={{ width: imageWidth, height: imageHeight, rotateX, rotateY, scale }}
        >
          <motion.img
            src={imageSrc}
            alt={altText}
            className="tilted-card-img"
            style={{ width: imageWidth, height: imageHeight }}
            onError={(e) => { e.target.src = "https://placehold.co/400x300/0a1a0f/34d399?text=Cancha"; }}
          />
          {displayOverlayContent && overlayContent && (
            <div className="tilted-card-overlay">{overlayContent}</div>
          )}
        </motion.div>
        {showTooltip && (
          <motion.figcaption
            className="tilted-card-caption"
            style={{ x, y, opacity, rotate: rotateFigcaption }}
          >
            {captionText}
          </motion.figcaption>
        )}
      </figure>
    </>
  );
}
