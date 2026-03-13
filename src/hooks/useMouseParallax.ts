import { useEffect, useRef } from "react";

interface ParallaxOffset {
  x: number;
  y: number;
}

function lerp(start: number, end: number, factor: number) {
  return start + (end - start) * factor;
}

export function useMouseParallax(intensity: number = 20) {
  const offset = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const target = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function animate() {
      offset.current.x = lerp(offset.current.x, target.current.x, 0.08);
      offset.current.y = lerp(offset.current.y, target.current.y, 0.08);

      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0) scale(1.05)`;
      }

      rafId.current = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normalizedX = (e.clientX - centerX) / centerX;
      const normalizedY = (e.clientY - centerY) / centerY;

      target.current.x = -normalizedX * intensity;
      target.current.y = -normalizedY * intensity;
    }

    window.addEventListener("mousemove", handleMouseMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, [intensity]);

  return elementRef;
}
