import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { LAST, nav, reducedMotion, scroll } from '../store';

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scrolling + a ScrollTrigger that maps the pinned stage to chapter space. */
export function useSmoothScroll(stageId: string) {
  useEffect(() => {
    let lenis: Lenis | null = null;
    const raf = (time: number) => lenis?.raf(time * 1000);
    if (!reducedMotion) {
      lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const st = ScrollTrigger.create({
      trigger: `#${stageId}`,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scroll.progress = self.progress;
        scroll.t = self.progress * LAST;
      },
    });

    nav.toChapter = (k: number) => {
      const y = st.start + (st.end - st.start) * (k / LAST);
      if (lenis) lenis.scrollTo(y, { duration: 1.6 });
      else window.scrollTo({ top: y });
    };
    nav.toPosition = (t: number) => {
      const y = st.start + (st.end - st.start) * (Math.min(LAST, Math.max(0, t)) / LAST);
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo({ top: y });
    };

    nav.lock = (on: boolean) => {
      if (on) lenis?.stop();
      else lenis?.start();
      document.documentElement.classList.toggle('scroll-locked', on);
    };

    return () => {
      nav.lock(false);
      nav.lock = () => {};
      st.kill();
      gsap.ticker.remove(raf);
      lenis?.destroy();
    };
  }, [stageId]);
}
