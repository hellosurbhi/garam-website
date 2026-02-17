import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Nav.module.css";

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/garammasaladating" },
  { label: "TikTok", href: "https://tiktok.com/@garammasaladating" },
  { label: "YouTube", href: "#" },
];

export function Nav() {
  const [followOpen, setFollowOpen] = useState(false);
  const followRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (followRef.current && !followRef.current.contains(e.target as Node)) {
        setFollowOpen(false);
      }
    }
    if (followOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [followOpen]);

  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <span className={styles.brand}>Garam Masala</span>
        <span className={styles.season}>Season 2026</span>
      </div>
      <div className={styles.right}>
        <div className={styles.followWrap} ref={followRef}>
          <button
            className={styles.btnOutline}
            onClick={() => setFollowOpen((o) => !o)}
            aria-expanded={followOpen}
          >
            Follow
          </button>
          {followOpen && (
            <div className={styles.dropdown}>
              {SOCIALS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href !== "#" ? "_blank" : undefined}
                  rel={href !== "#" ? "noopener noreferrer" : undefined}
                  className={styles.dropItem}
                  onClick={() => setFollowOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        <Link to="/apply" className={styles.btnSolid}>
          Apply
        </Link>
      </div>
    </nav>
  );
}
