import heroImage from "@/assets/hero.jpeg";
import heroMobileImage from "@/assets/hero-mobile.jpeg";

export function SubpageBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <picture style={{ width: "100%", height: "100%", display: "block" }}>
        <source media="(max-width: 768px)" srcSet={heroMobileImage} />
        <img
          src={heroImage}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 35%",
            display: "block",
          }}
        />
      </picture>
      {/* Cream wash — lets the photo breathe through without competing with text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255, 248, 240, 0.65)",
        }}
      />
    </div>
  );
}
