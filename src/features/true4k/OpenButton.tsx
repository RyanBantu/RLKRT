import './true4k.css';
import { trueFourK } from '../../content';
import { openTrue4k } from './control';

/** The "True 4K?" pill with a 3 × 3 pixel-grid icon. */
export function TrueFourKButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      className={`tk-open ${className}`.trim()}
      aria-haspopup="dialog"
      aria-label={trueFourK.openLabel}
      onClick={(e) => openTrue4k(e.currentTarget)}
    >
      <svg className="tk-open-icon" viewBox="0 0 12 12" aria-hidden>
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={c * 4 + 0.5} y={r * 4 + 0.5} width={3} height={3} rx={0.4} opacity={(r + c) % 2 ? 0.45 : 1} />),
        )}
      </svg>
      {trueFourK.open}
    </button>
  );
}
