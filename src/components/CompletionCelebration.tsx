import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
  opacity: number;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#0088a8', '#00b8d9', '#f97316'];
const PARTICLE_COUNT = 120;

function createParticle(id: number): Particle {
  const angle = (Math.random() * Math.PI * 2);
  const speed = 4 + Math.random() * 8;
  return {
    id,
    x: 40 + Math.random() * 20, // launch from center-ish (%)
    y: 50,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 6 - Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    shape: Math.random() > 0.4 ? 'rect' : 'circle',
    opacity: 1,
  };
}

interface Props {
  projectId: string;
  onDone: () => void;
}

export default function CompletionCelebration({ projectId, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bannerVisible, setBannerVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const key = `celebration_shown_${projectId}`;
    if (sessionStorage.getItem(key)) { onDone(); return; }
    sessionStorage.setItem(key, '1');

    const initial = Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i));
    particlesRef.current = initial;
    setParticles(initial);
    setVisible(true);

    // Stagger the banner in
    const bannerTimer = setTimeout(() => setBannerVisible(true), 100);

    startTimeRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / 3000, 1);

      particlesRef.current = particlesRef.current.map((p) => ({
        ...p,
        x: p.x + p.vx * 0.4,
        y: p.y + p.vy * 0.4,
        vy: p.vy + 0.35, // gravity
        vx: p.vx * 0.98, // drag
        rotation: p.rotation + p.rotationSpeed,
        opacity: progress < 0.6 ? 1 : 1 - ((progress - 0.6) / 0.4),
      }));

      setParticles([...particlesRef.current]);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setVisible(false);
        setBannerVisible(false);
        setTimeout(onDone, 400);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(bannerTimer);
    };
  }, [projectId]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Confetti canvas */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.shape === 'rect' ? p.size : p.size * 0.8,
            height: p.shape === 'rect' ? p.size * 0.45 : p.size * 0.8,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '1px',
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.opacity,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Center banner */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-auto"
        onClick={onDone}
      >
        <div
          className={`
            bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950
            border border-gray-100 dark:border-gray-800
            px-10 py-8 flex flex-col items-center gap-3 text-center max-w-xs mx-4
            transition-all duration-500
            ${bannerVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
          `}
        >
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mb-1">
            <Trophy className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Project Complete!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Every milestone reached. Outstanding work.
          </p>
          <button
            onClick={onDone}
            className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
