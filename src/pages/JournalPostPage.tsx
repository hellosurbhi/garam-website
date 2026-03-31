import { useParams, Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getPostBySlug } from "@/data/journal";
import { AuthorBio } from "@/components/AuthorBio";

function buildArticleJsonLd(post: NonNullable<ReturnType<typeof getPostBySlug>>): string {
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
      logo: {
        "@type": "ImageObject",
        url: "https://garammasaladating.com/og-image.jpg",
      },
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

function PostNotFound() {
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
        <p style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🌶️</p>
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
          to="/journal"
          style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 500, textDecoration: "none" }}
        >
          ← Back to journal
        </Link>
      </div>
    </div>
  );
}

export default function JournalPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = getPostBySlug(slug ?? "");

  const jsonLd = post ? buildArticleJsonLd(post) : undefined;
  const title = post ? `${post.title} | Garam Masala Dating` : "Post Not Found | Garam Masala Dating";
  const description = post?.metaDescription ?? "";

  usePageMeta(title, description, jsonLd);

  if (!post) return <PostNotFound />;

  return (
    <>
      <style>{`
        @keyframes postFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "postFadeIn 0.5s ease-out both",
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
            to="/journal"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "rgba(245, 237, 228, 0.35)",
              textDecoration: "none",
              marginBottom: "36px",
            }}
          >
            ← Journal
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

          {/* Article body */}
          <article style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {post.body.map((block, i) => {
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

          {/* Author bio */}
          <AuthorBio />

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
              to="/journal"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                color: "rgba(245, 237, 228, 0.35)",
                textDecoration: "none",
              }}
            >
              ← All posts
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
              Apply to be on the show →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
