import { useMouseParallax } from "../../hooks/useMouseParallax";
import styles from "./Hero.module.css";

export function Hero() {
  const parallaxRef = useMouseParallax(18);

  return (
    <section className={styles.hero}>
      <div ref={parallaxRef} className={styles.imageWrap}>
        <picture className={styles.image}>
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.avif" type="image/avif" />
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.webp" type="image/webp" />
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.jpeg" type="image/jpeg" />
          <source srcSet="/images/hero.avif" type="image/avif" />
          <source srcSet="/images/hero.webp" type="image/webp" />
          <img
            src="/images/hero.jpeg"
            alt=""
            className={styles.image}
            fetchPriority="high"
            width={1920}
            height={815}
            decoding="async"
          />
        </picture>
      </div>
      <div className={styles.vignette} />
      <div className={styles.grid}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`v-${i}`} className={styles.gridLineV} style={{ left: `${(i + 1) * 12.5}%` }} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`h-${i}`} className={styles.gridLineH} style={{ top: `${(i + 1) * 16.66}%` }} />
        ))}
      </div>
    </section>
  );
}
