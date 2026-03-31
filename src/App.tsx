import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav/Nav";
import { Hero } from "./components/Hero/Hero";
import { CenterBox } from "./components/CenterBox/CenterBox";
import { GrainOverlay } from "./components/GrainOverlay/GrainOverlay";
import { ScrollIndicator } from "./components/ScrollIndicator/ScrollIndicator";
import { OrganizationSchema } from "./components/OrganizationSchema";
import { BreadcrumbSchema } from "./components/BreadcrumbSchema";
import { EventsSchema } from "./components/EventsSchema";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const LinksPage = lazy(() => import("./pages/LinksPage"));
const ApplyPage = lazy(() => import("./pages/ApplyPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ContestantPrepPage = lazy(() => import("./pages/ContestantPrepPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
const CitiesIndexPage = lazy(() => import("./pages/CitiesIndexPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const JournalPostPage = lazy(() => import("./pages/JournalPostPage"));
const TipsPage = lazy(() => import("./pages/TipsPage"));
const TipPostPage = lazy(() => import("./pages/TipPostPage"));

function SubpageOverlay() {
  const { pathname } = useLocation();
  if (pathname === "/" || pathname === "/admin") return null;
  const DARK = "rgba(13, 10, 8, 0.88)";
  const overlayBg: Record<string, string> = {
    "/links": DARK,
    "/apply": "rgba(13, 10, 8, 0.75)",
    "/contestant-prep": DARK,
    "/faq": DARK,
    "/cities": DARK,
    "/journal": DARK,
    "/south-asian-dating-tips": DARK,
  };
  const background =
    overlayBg[pathname] ??
    (pathname.startsWith("/cities/") ||
    pathname.startsWith("/journal/") ||
    pathname.startsWith("/south-asian-dating-tips/")
      ? DARK
      : "rgba(255, 248, 240, 0.50)");
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background,
      }}
    />
  );
}

function LandingPage() {
  return (
    <>
      <Nav />
      <CenterBox />
      <ScrollIndicator />
      <EventsSchema />
    </>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "3rem", marginBottom: "16px" }}>🌶️</p>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "12px",
          }}
        >
          Page not found
        </h1>
        <a
          href="/"
          style={{ color: "var(--crimson)", fontSize: "15px", fontWeight: 500 }}
        >
          ← Back to home
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Hero />
      <GrainOverlay />
      <SubpageOverlay />
      <OrganizationSchema />
      <BreadcrumbSchema />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/links" element={<LinksPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/contestant-prep" element={<ContestantPrepPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/cities" element={<CitiesIndexPage />} />
          <Route path="/cities/:city" element={<CityPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/journal/:slug" element={<JournalPostPage />} />
          <Route path="/south-asian-dating-tips" element={<TipsPage />} />
          <Route path="/south-asian-dating-tips/:slug" element={<TipPostPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
