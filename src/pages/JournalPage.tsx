import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { journalPostsSorted } from "@/data/journal";

const TITLE = "Journal | Garam Masala Dating";
const DESC =
  "Essays on South Asian dating, the live show, and what we\u2019ve learned from watching hundreds of blind dates unfold on stage.";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function JournalPage() {
  usePageMeta(TITLE, DESC);

  return (
    <>
      <style>{`
        @keyframes journalFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "journalFadeIn 0.5s ease-out both",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "40px" }}>
            <p
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "11px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#C9A84C",
                marginBottom: "12px",
              }}
            >
              Journal
            </p>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "32px",
                fontWeight: 700,
                color: "var(--text-ivory)",
                lineHeight: 1.15,
                marginBottom: "14px",
              }}
            >
              Garam Mas<em style={{ fontStyle: "italic", color: "var(--gold-accent)" }}>ala</em>{" "}
              Dating
            </h1>
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "17px",
                color: "rgba(245, 237, 228, 0.6)",
                lineHeight: 1.55,
              }}
            >
              Essays on desi dating, the live show, and what we\u2019ve learned
              from watching it all unfold on stage.
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "48px",
              height: "1px",
              background: "rgba(201, 168, 76, 0.3)",
              marginBottom: "36px",
            }}
          />

          {/* Post list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {journalPostsSorted.map((post, i) => (
              <Link
                key={post.slug}
                to={`/journal/${post.slug}`}
                style={{
                  display: "block",
                  padding: "24px 20px",
                  borderRadius: "12px",
                  border: "1px solid rgba(245, 237, 228, 0.07)",
                  background: "rgba(255, 255, 255, 0.02)",
                  textDecoration: "none",
                  animation: `journalFadeIn 0.5s ease-out ${0.1 + i * 0.08}s both`,
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(201, 168, 76, 0.7)",
                    marginBottom: "10px",
                  }}
                >
                  {formatDate(post.datePublished)}
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--text-ivory)",
                    lineHeight: 1.25,
                    marginBottom: "10px",
                  }}
                >
                  {post.title}
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "15px",
                    color: "rgba(245, 237, 228, 0.55)",
                    lineHeight: 1.6,
                    marginBottom: "16px",
                    margin: 0,
                  }}
                >
                  {post.excerpt}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "14px",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#C9A84C",
                  }}
                >
                  Read
                  <ArrowRight size={13} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
