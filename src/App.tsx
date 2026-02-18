import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav/Nav";
import { Hero } from "./components/Hero/Hero";
import { CenterBox } from "./components/CenterBox/CenterBox";
import { GrainOverlay } from "./components/GrainOverlay/GrainOverlay";
import { ScrollIndicator } from "./components/ScrollIndicator/ScrollIndicator";
import LinksPage from "./pages/LinksPage";
import ApplyPage from "./pages/ApplyPage";
import AdminPage from "./pages/AdminPage";

function SubpageOverlay() {
  const { pathname } = useLocation();
  if (pathname === "/" || pathname === "/admin") return null;
  const overlayBg: Record<string, string> = {
    "/links": "rgba(13, 10, 8, 0.88)",
    "/apply": "rgba(13, 10, 8, 0.75)",
  };
  const background = overlayBg[pathname] ?? "rgba(255, 248, 240, 0.50)";
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
