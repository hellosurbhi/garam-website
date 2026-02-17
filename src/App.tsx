import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Nav } from "./components/Nav/Nav";
import { Hero } from "./components/Hero/Hero";
import { CenterBox } from "./components/CenterBox/CenterBox";
import { GrainOverlay } from "./components/GrainOverlay/GrainOverlay";
import { ScrollIndicator } from "./components/ScrollIndicator/ScrollIndicator";
import LinksPage from "./pages/LinksPage";
import ApplyPage from "./pages/ApplyPage";
import AdminPage from "./pages/AdminPage";

function LandingPage() {
  return (
    <>
      <Hero />
      <Nav />
      <CenterBox />
      <GrainOverlay />
      <ScrollIndicator />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
