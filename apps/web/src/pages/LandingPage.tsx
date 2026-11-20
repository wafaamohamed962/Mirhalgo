import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { ScrollToTop } from '../components/layout/ScrollToTop';
import { usePageMeta } from '../lib/usePageMeta';
import { About } from '../sections/About';
import { Contact } from '../sections/Contact';
import { Hero } from '../sections/Hero';
import { Services } from '../sections/Services';

/** `/`: Hero → About → Services → Contact → Footer (spec 3). */
export default function LandingPage() {
  usePageMeta('home');
  const { hash } = useLocation();

  // The page is lazy-loaded, so the browser can't jump to /#contact by itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Navbar />
        <main id="main" tabIndex={-1}>
          <Hero />
          <About />
          <Services />
          <Contact />
        </main>
        <Footer />
        <ScrollToTop />
      </MotionConfig>
    </LazyMotion>
  );
}
