import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const FAQ_TITLE = "FAQ \u2013 Garam Masala Dating | Live Comedy Dating Show NYC";
const FAQ_DESC =
  "Everything you need to know about Garam Masala Dating \u2014 tickets, how the show works, who can apply, what to expect, and how to get on stage.";

const FAQS = [
  {
    q: "What is Garam Masala Dating?",
    a: "Garam Masala Dating is a live comedy dating show and singles mixer in NYC. Every week, real singles go on blind dates on stage in front of a 250-person audience. It\u2019s part comedy show, part actual matchmaking \u2014 and it\u2019s more fun than any app you\u2019ve ever been on.",
  },
  {
    q: "Do I have to be South Asian to come?",
    a: "No. The show is open to everyone. Our audience and contestants are a mix of South Asian, desi diaspora, and anyone who loves a good night out. If you like comedy, dating culture, and meeting new people, you\u2019ll fit right in.",
  },
  {
    q: "How do I get tickets?",
    a: 'Tickets are available on Eventbrite. Search \u201CGaram Masala Dating\u201D or go to our tickets page. General admission gets you in the door and access to the mixer before and after the show.',
  },
  {
    q: "How do I apply to be a contestant?",
    a: "Fill out the application on our website. We cast contestants based on personality, chemistry potential, and your answers \u2014 not looks. Being genuinely funny, honest, or a little chaotic helps.",
  },
  {
    q: "What actually happens at the show?",
    a: "Contestants are introduced to the audience, then paired for a live blind date on stage. The hosts ask questions, the audience reacts, and the dates decide how it ends. After the show, everyone mixes at the venue. It\u2019s a real night out, not a cringe exercise.",
  },
  {
    q: "Is it scripted or staged?",
    a: "Nothing is scripted. The dates are real, the reactions are real, and the awkwardness is definitely real. We only coach contestants on timing and mic basics.",
  },
  {
    q: "What should I wear?",
    a: "Dress like you\u2019re going on a real date. Bold colors, fun fits, something you feel good in. This is not a night for business casual.",
  },
  {
    q: "Can I come solo?",
    a: "Yes \u2014 most people do. The mixer format means you\u2019ll meet people before the show even starts.",
  },
  {
    q: "How often does the show run?",
    a: "We run weekly shows in NYC. Check the events page for upcoming dates and cities.",
  },
  {
    q: "I want to collaborate, sponsor, or book the show for a private event. Who do I contact?",
    a: "Use the collaboration form on our website. We do private events, brand partnerships, and media features.",
  },
];

const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

export default function FaqPage() {
  usePageMeta(FAQ_TITLE, FAQ_DESC, FAQ_JSONLD);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <style>{`
        @keyframes faqFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "faqFadeIn 0.5s ease-out both",
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
              FAQ
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
              Everything you need to know before you show up.
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

          {/* FAQ items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {FAQS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid",
                    borderColor: isOpen
                      ? "rgba(201, 168, 76, 0.25)"
                      : "rgba(245, 237, 228, 0.07)",
                    background: isOpen
                      ? "rgba(201, 168, 76, 0.05)"
                      : "rgba(255, 255, 255, 0.02)",
                    overflow: "hidden",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {/* Question row */}
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      padding: "18px 20px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    aria-expanded={isOpen}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-cormorant)",
                        fontSize: "17px",
                        fontWeight: 600,
                        color: isOpen ? "var(--text-ivory)" : "rgba(245, 237, 228, 0.85)",
                        lineHeight: 1.4,
                        transition: "color 0.15s",
                      }}
                    >
                      {item.q}
                    </span>
                    <ChevronDown
                      size={16}
                      style={{
                        color: "#C9A84C",
                        flexShrink: 0,
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>

                  {/* Answer — always in DOM for SEO, hidden visually when closed */}
                  <div
                    style={{
                      display: isOpen ? "block" : "none",
                      padding: "0 20px 20px",
                    }}
                    aria-hidden={!isOpen}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-cormorant)",
                        fontSize: "16px",
                        color: "rgba(245, 237, 228, 0.7)",
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: "56px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(245, 237, 228, 0.06)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "15px",
                fontStyle: "italic",
                color: "rgba(245, 237, 228, 0.25)",
              }}
            >
              Still have questions? Reach out at{" "}
              <a
                href="mailto:contact@garammasaladating.com"
                style={{ color: "#C9A84C", textDecoration: "none" }}
              >
                contact@garammasaladating.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
