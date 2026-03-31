import { useParams, Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getTipBySlug } from "@/data/tips";
import type { TipPost } from "@/data/tips";

function buildArticleJsonLd(post: TipPost): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: {
      "@type": "Organization",
      name: post.author,
      url: "https://garammasaladating.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Garam Masala Dating",
      url: "https://garammasaladating.com",
    },
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function TipNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-ivory)",
            marginBottom: "12px",
          }}
        >
          Post not found
        </h1>
        <Link
          to="/south-asian-dating-tips"
          style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 500, textDecoration: "none" }}
        >
          &larr; Back to tips
        </Link>
      </div>
    </div>
  );
}

export default function TipPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = getTipBySlug(slug ?? "");

  const jsonLd = post ? buildArticleJsonLd(post) : undefined;
  const title = post
    ? `${post.title} | Garam Masala Dating`
    : "Post Not Found | Garam Masala Dating";
  const description = post?.metaDescription ?? "";

  usePageMeta(title, description, jsonLd);

  if (!post) return <TipNotFound />;

  return (
    <>
      <style>{`
        @keyframes tipPostFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "tipPostFadeIn 0.5s ease-out both",
        }}
      >
        <div
          style={{
            maxWidth: "620px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
          {/* Back link */}
          <Link
            to="/south-asian-dating-tips"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "rgba(245, 237, 228, 0.35)",
              textDecoration: "none",
              marginBottom: "36px",
            }}
          >
            &larr; Dating Tips
          </Link>

          {/* Article header */}
          <header style={{ marginBottom: "40px" }}>
            <p
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "rgba(201, 168, 76, 0.7)",
                marginBottom: "16px",
              }}
            >
              {formatDate(post.datePublished)} &mdash; {post.author}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "clamp(26px, 5vw, 36px)",
                fontWeight: 700,
                color: "var(--text-ivory)",
                lineHeight: 1.15,
              }}
            >
              {post.title}
            </h1>
          </header>

          {/* Divider */}
          <div
            style={{
              width: "48px",
              height: "1px",
              background: "rgba(201, 168, 76, 0.3)",
              marginBottom: "40px",
            }}
          />

          {/* Article body — Answer-First format */}
          <article style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Lead paragraph: bolded summary for AEO scraping */}
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "19px",
                fontWeight: 700,
                color: "var(--text-ivory)",
                lineHeight: 1.7,
                margin: 0,
                paddingBottom: "12px",
                borderBottom: "1px solid rgba(201, 168, 76, 0.15)",
              }}
            >
              {post.body[0].text}
            </p>

            {post.body.slice(1).map((block, i) => {
              if (block.type === "h3") {
                return (
                  <h3
                    key={i}
                    style={{
                      fontFamily: "var(--font-playfair)",
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "var(--text-ivory)",
                      lineHeight: 1.3,
                      marginTop: i === 0 ? 0 : "12px",
                    }}
                  >
                    {block.text}
                  </h3>
                );
              }
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "18px",
                    color: "rgba(245, 237, 228, 0.78)",
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {block.text}
                </p>
              );
            })}
          </article>

          {/* Footer */}
          <div
            style={{
              marginTop: "64px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(245, 237, 228, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <Link
              to="/south-asian-dating-tips"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                color: "rgba(245, 237, 228, 0.35)",
                textDecoration: "none",
              }}
            >
              &larr; All tips
            </Link>
            <Link
              to="/apply"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                fontWeight: 500,
                color: "#C9A84C",
                textDecoration: "none",
              }}
            >
              Apply to be on the show &rarr;
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
