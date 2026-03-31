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
    if (window.matchMedia("(pointer: coarse)").matches) return;

    function animate() {
      const dx = Math.abs(offset.current.x - target.current.x);
      const dy = Math.abs(offset.current.y - target.current.y);

      if (dx < 0.1 && dy < 0.1) {
        rafId.current = 0;
        return;
      }

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

      if (!rafId.current) {
        rafId.current = requestAnimationFrame(animate);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [intensity]);

  return elementRef;
}
