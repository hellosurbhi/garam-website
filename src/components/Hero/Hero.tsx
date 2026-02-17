import { useMouseParallax } from "../../hooks/useMouseParallax";
import heroImage from "../../assets/hero.jpeg";
import styles from "./Hero.module.css";

export function Hero() {
  const parallaxRef = useMouseParallax(18);

  return (
    <section className={styles.hero}>
      <div ref={parallaxRef} className={styles.imageWrap}>
        <img src={heroImage} alt="" className={styles.image} />
      </div>
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
