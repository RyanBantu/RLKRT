import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { brand, menuLabels, navLinks } from '../content';
import { nav } from '../store';

export function SiteHeader() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape or a tap outside closes the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={`site-header${home ? '' : ' site-header--solid'}${open ? ' is-open' : ''}`}
    >
      <Link
        to="/"
        className="site-logo"
        aria-label={`${brand.name} home`}
        onClick={(e) => {
          if (home) {
            e.preventDefault();
            nav.toChapter(0);
          }
          setOpen(false);
        }}
      >
        <img src={brand.logo} alt={brand.logoAlt} width={1932} height={534} />
      </Link>
      <button
        ref={toggleRef}
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? menuLabels.close : menuLabels.open}
        onClick={() => setOpen((o) => !o)}
      >
        <i />
        <i />
        <i />
      </button>
      <nav id="site-nav" className="site-nav" aria-label="Main">
        <NavLink to="/" end>{navLinks.camera}</NavLink>
        <NavLink to="/netlynx">{navLinks.netlynx}</NavLink>
        <NavLink to="/team">{navLinks.team}</NavLink>
      </nav>
    </header>
  );
}
