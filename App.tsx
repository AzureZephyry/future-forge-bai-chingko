import { useEffect } from "react";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { WorkspaceProvider, useWorkspace } from "./state/WorkspaceContext";
import { CommerceProvider, useCommerce } from "./state/CommerceContext";
import { ThemeProvider, ThemeToggle } from "./state/ThemeContext";
import { Dashboard, Opportunity, Report, Simulator } from "./routes/WorkspacePages";
import { Documents } from "./routes/Documents";
import { Features, Landing, Pricing } from "./routes/Marketing";
import { PlanIndicator, PlanManagement } from "./components/PlanControls";
import { Icon } from "./components/Icon";
import { DEMO_NOTICE } from "./lib/subscription.ts";
import { DISCLAIMER } from "./lib/readiness.ts";

function Brand() { return <Link className="brand" to="/" aria-label="BidBridge home"><span className="brand__mark" aria-hidden="true">B</span><span className="brand__name">BidBridge<span className="brand-dot">.</span></span></Link>; }
function RouteFocus() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hash) { try { document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid fragment: keep page available. */ } }
      else { window.scrollTo(0, 0); const heading = document.querySelector("main h1"); if (heading instanceof HTMLElement) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);
  return null;
}
function CommerceNotice() {
  const c = useCommerce();
  return c.error ? <p className="error" role="alert">{c.error} <button className="text-button" onClick={() => { void c.refresh(); }}>Retry local storage</button></p> : c.snapshot?.warning ? <p className="notice" role="alert">{c.snapshot.warning}</p> : null;
}
function MarketingLayout() {
  return <div className="commercial marketing-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="marketing-header marketing-container"><Brand /><nav aria-label="Public navigation"><NavLink to="/features">Features</NavLink><NavLink to="/pricing">Pricing</NavLink><Link to="/app">Workspace</Link></nav><div className="header-actions"><ThemeToggle /><Link className="primary-button" to="/app">Start Free <Icon name="arrow" /></Link></div></header><main id="main-content"><CommerceNotice /><Outlet /></main><footer className="marketing-footer marketing-container"><div><Brand /><p>Know Before You Bid.<br />Preparation made clearer for smaller suppliers.</p></div><nav aria-label="Footer navigation"><Link to="/features">Features</Link><Link to="/pricing">Pricing</Link><Link to="/app">Open workspace</Link><a href="/legacy">Legacy assessment</a></nav><p className="footer-disclaimer">Team Bai-chingko · FUTURE FORGE<br />{DEMO_NOTICE}</p></footer></div>;
}
const navigation = [["/app", "dashboard", "Overview"], ["/app/opportunity", "opportunity", "Opportunity"], ["/app/documents", "documents", "Documents"], ["/app/simulator", "simulator", "Gap-to-Go"], ["/app/report", "report", "Decision brief"], ["/app/plan", "plan", "Plan & usage"]] as const;
function ApplicationLayout() {
  const w = useWorkspace(), navigate = useNavigate();
  return <div className="commercial workspace-app app-shell"><a className="skip-link" href="#main-content">Skip to content</a><aside className="app-sidebar"><Brand /><p className="sidebar-caption">YOUR PREPARATION SPACE</p><nav aria-label="Application navigation">{navigation.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === "/app"}><Icon name={icon} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-plan"><PlanIndicator /><Link className="text-link" to="/pricing">Explore plans →</Link><p className="hint">Local demo · No payment</p></div><Link className="sidebar-back" to="/">← Back to website</Link></aside>
    <div className="app-main"><header className="app-header topbar"><div className="header-workspace"><span className="eyebrow">Know Before You Bid.</span><strong>{w.workspace?.title || "Your first opportunity"}</strong><span className="save-state" role="status">{w.scenario ? "Scenario not saved. Baseline: " : ""}{w.saveState}</span></div><div className="header-actions"><ThemeToggle /><button className="secondary-button" type="button" disabled={!!w.scenario} onClick={() => { w.setCreating(true); w.setError(""); navigate("/app/opportunity"); }}>New opportunity</button><button className="primary-button" type="button" disabled={!!w.scenario} onClick={() => { w.loadDemo(); navigate("/app/opportunity"); }}>Load fictional demo</button></div></header>
      <main className="app-content" id="main-content"><CommerceNotice />{w.error && <p className="error" role="alert">{w.error}</p>}{!w.workspace && w.initial.state !== "loaded" && w.initial.state !== "empty" && <p className="notice">{w.initial.message}</p>}{w.scenario && <div className="scenario-ribbon"><strong>Hypothetical scenario active</strong><span>Procurement edits affect your copy. Documents and plan usage remain real local actions.</span><Link to="/app/simulator">Compare / apply / discard →</Link></div>}<Outlet /></main>
      <footer className="app-footer"><p>{DISCLAIMER}</p><p>{DEMO_NOTICE}</p></footer>
    </div>
  </div>;
}
function NotFound() { return <section className="empty not-found"><p className="eyebrow">Page not found</p><h1>Let's get you back to preparation.</h1><p>Your saved workspace is still available.</p><Link className="primary-button" to="/app">Open workspace</Link></section>; }
export default function App() {
  return <BrowserRouter><ThemeProvider><CommerceProvider><WorkspaceProvider><RouteFocus /><Routes>
    <Route element={<MarketingLayout />}><Route index element={<Landing />} /><Route path="features" element={<Features />} /><Route path="pricing" element={<Pricing />} /></Route>
    <Route path="app" element={<ApplicationLayout />}><Route index element={<Dashboard />} /><Route path="opportunity" element={<Opportunity />} /><Route path="documents" element={<Documents />} /><Route path="simulator" element={<Simulator />} /><Route path="report" element={<Report />} /><Route path="plan" element={<PlanManagement />} /><Route path="*" element={<NotFound />} /></Route>
    <Route element={<MarketingLayout />}><Route path="*" element={<NotFound />} /></Route>
  </Routes></WorkspaceProvider></CommerceProvider></ThemeProvider></BrowserRouter>;
}
