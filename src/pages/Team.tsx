import { useEffect } from 'react';
import { team } from '../content';

export default function Team() {
  useEffect(() => {
    const prev = document.title;
    document.title = team.docTitle;
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main className="team">
      <div className="camo-band camo-band--top" aria-hidden="true" />
      <div className="team-inner">
        <p className="team-eyebrow">{team.eyebrow}</p>
        <h1>{team.headline}</h1>
        <p className="team-intro">{team.intro}</p>
        <ul className="team-grid">
          {team.members.map((m, i) => (
            <li key={m.name} className="team-card">
              <div className="team-mark" aria-hidden="true">
                <span>{m.name[0]}</span>
              </div>
              <p className="team-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
              <h2>{m.name}</h2>
              <p className="team-role">{m.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
