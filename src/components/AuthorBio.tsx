export function AuthorBio() {
  return (
    <div
      style={{
        marginTop: "48px",
        paddingTop: "24px",
        borderTop: "1px solid rgba(245, 237, 228, 0.06)",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
      }}
    >
      <img
        src="/og-image.jpg"
        alt="Garam Masala Dating logo"
        width={48}
        height={48}
        style={{
          borderRadius: "50%",
          border: "1px solid rgba(201, 168, 76, 0.25)",
          flexShrink: 0,
          background: "rgba(13, 10, 8, 0.4)",
        }}
      />
      <div>
        <p
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--text-ivory)",
            margin: "0 0 6px",
          }}
        >
          Garam Masala Dating
        </p>
        <p
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "15px",
            color: "rgba(245, 237, 228, 0.6)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Garam Masala Dating is a live comedy dating show and South Asian singles
          mixer hosted weekly in NYC and monthly in Jersey City, NJ. The show was
          created by Surbhi and Wyatt Feegrado.
        </p>
      </div>
    </div>
  );
}
