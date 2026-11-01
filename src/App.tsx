import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import Home from './pages/Home';
import Team from './pages/Team';
import { SiteFooter } from './ui/SiteFooter';
import { SiteHeader } from './ui/SiteHeader';

const NetLynx = lazy(() => import('./netlynx/NetLynxPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  const section = pathname.split('/')[1];
  // Only when switching pages, not when /netlynx/:zip changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/netlynx" element={<Suspense fallback={<main className="nl" />}><NetLynx /></Suspense>} />
        <Route path="/netlynx/:zip" element={<Suspense fallback={<main className="nl" />}><NetLynx /></Suspense>} />
        <Route path="/team" element={<Team />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <SiteFooter />
    </>
  );
}
