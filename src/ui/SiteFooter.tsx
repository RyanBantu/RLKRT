import { brand, footer } from '../content';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="camo-band camo-band--footer" aria-hidden />
      <img src={brand.logo} alt={brand.logoAlt} width={1932} height={534} />
      <p className="footer-line">{footer.line}</p>
      <p className="footer-note">© {new Date().getFullYear()} {brand.name} · {footer.note}</p>
    </footer>
  );
}
