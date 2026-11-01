import { Link, NavLink, useLocation } from 'react-router';
import { brand, navLinks } from '../content';
import { nav } from '../store';

export function SiteHeader() {
  const home = useLocation().pathname === '/';
  return (
    <header className={`site-header${home ? '' : ' site-header--solid'}`}>
      <Link
        to="/"
        className="site-logo"
        aria-label={`${brand.name} home`}
        onClick={(e) => {
          if (home) {
            e.preventDefault();
            nav.toChapter(0);
          }
        }}
      >
        <img src={brand.logo} alt={brand.logoAlt} width={1932} height={534} />
      </Link>
      <nav className="site-nav" aria-label="Main">
        <NavLink to="/" end>{navLinks.camera}</NavLink>
        <NavLink to="/netlynx">{navLinks.netlynx}</NavLink>
        <NavLink to="/team">{navLinks.team}</NavLink>
      </nav>
    </header>
  );
}
