'use client';
import { createSpinProfile, spinProgress, chooseWeightedByRarity, samplePoolByRarity } from '@/lib/case-mechanics';
import { actresses, type Actress } from '@/lib/actresses';
import { copy, actressName, actressSubtitle, type Language } from '@/lib/i18n';
import { useGlobalSpinCount } from '@/hooks/use-global-spin-count';
import { CaseAudio } from '@/lib/case-audio';
import { flushSync } from 'react-dom';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Volume2, VolumeX, Sparkles, Star, Clapperboard } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const colors = ['#4B69FF', '#8847FF', '#EB4B4B', '#CAAB05'];
const REEL_STEP = 300;
const REEL_TILE_WIDTH = 280;
const FOCUS_DIAMETER_MAX = 480;
const POOL_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200] as const;
const POOL_STORAGE_KEY = 'toinayxemgi-pool-size';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** CS2-style focus: sharp + scaled in the ring; Gaussian blur outside. */
function applyFocusStyles(viewport: HTMLElement, trackTranslateX: number) {
  const viewCenterX = viewport.clientWidth / 2;
  const diameter = Math.min(FOCUS_DIAMETER_MAX, viewport.clientWidth * 0.9);
  const outerR = diameter / 2;
  const innerR = outerR * 0.45;
  const cards = viewport.querySelectorAll<HTMLElement>('.reel-track > .item-card');
  cards.forEach((card) => {
    const slot = Number(card.dataset.slotId);
    if (!Number.isFinite(slot)) return;
    const cardCenterX = slot * REEL_STEP + REEL_TILE_WIDTH / 2 + trackTranslateX;
    const dist = Math.abs(cardCenterX - viewCenterX);
    const t = smoothstep(outerR, innerR, dist);
    const scale = 1 + 0.2 * t;
    const blurPx = (1 - t) * 14;
    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'center center';
    card.style.filter = blurPx < 0.15 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;
    card.style.opacity = String(0.75 + 0.25 * t);
    card.style.zIndex = String(Math.round(t * 20));
  });
}

function ActressImage({
  actress,
  language,
  mystery = false,
}: {
  actress: Actress;
  language: Language;
  mystery?: boolean;
}) {
  if (mystery) {
    return (
      <div role="img" aria-label={copy[language].mysteryAlt} className="item-image rare-art">
        <img src={`${basePath}/rare.png`} alt={copy[language].mystery} loading="lazy" />
      </div>
    );
  }
  return (
    <div role="img" aria-label={actressName(actress, language)} className="item-image">
      <img src={`${basePath}/${actress.image_file}`} alt={actressName(actress, language)} loading="lazy" />
    </div>
  );
}

const Card = memo(function Card({
  actress,
  language,
  small = false,
  slot,
}: {
  actress: Actress;
  language: Language;
  small?: boolean;
  slot?: number;
}) {
  const t = copy[language];
  const onReel = slot !== undefined;
  const mystery = onReel && actress.rarity === 3;
  return (
    <div
      className={`item-card ${small ? 'small' : ''} ${mystery ? 'mystery-card' : ''}`}
      data-slot-id={slot}
      data-actress-id={actress.index}
      style={
        {
          '--rarity': colors[actress.rarity],
          ...(onReel ? { position: 'absolute', left: slot * REEL_STEP } : {}),
        } as React.CSSProperties
      }
    >
      <span className="tier">{t.tiers[actress.rarity]}</span>
      <ActressImage actress={actress} language={language} mystery={mystery} />
      <div className="card-copy">
        <strong>{mystery ? t.mystery : actressName(actress, language)}</strong>
        <span>{actressSubtitle(actress, language)}</span>
      </div>
    </div>
  );
});

export default function Home() {
  const { count: globalSpins, enabled: counterEnabled, recordSpin } = useGlobalSpinCount();
  const [language, setLanguage] = useState<Language>('vi');
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [poolSize, setPoolSize] = useState<number>(200);
  const [poolNonce, setPoolNonce] = useState(0);
  const [sound, setSound] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Actress | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reel, setReel] = useState(() => actresses.slice(0, 12).map((actress, id) => ({ actress, id })));
  const [moving, setMoving] = useState(false);
  const busy = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (tool: unknown, options: unknown) => void };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: 'list_actress_items',
          description: 'Read all actress options with video counts and debut years.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true },
          execute: (input: unknown) => {
            if (!input || typeof input !== 'object' || Object.keys(input).length) {
              throw new Error('Expected an empty object');
            }
            return actresses.map(({ name, videos, debut, href }) => ({ name, videos, debut, href }));
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {}
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    let selected: Language = 'vi';
    try {
      const saved = localStorage.getItem('truanayangi-language');
      selected = saved === 'en' || saved === 'vi' ? saved : 'vi';
    } catch {}
    setLanguage(selected);
    document.documentElement.lang = selected;
    document.title = selected === 'en' ? 'What to watch tonight' : 'Tối nay xem gì';
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(POOL_STORAGE_KEY));
      if (POOL_OPTIONS.includes(saved as (typeof POOL_OPTIONS)[number])) setPoolSize(saved);
    } catch {}
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    document.documentElement.lang = next;
    document.title = next === 'en' ? 'What to watch tonight' : 'Tối nay xem gì';
    try {
      localStorage.setItem('truanayangi-language', next);
    } catch {}
  };

  const changePoolSize = (next: number) => {
    if (spinning || busy.current) return;
    setPoolSize(next);
    setPoolNonce((n) => n + 1);
    try {
      localStorage.setItem(POOL_STORAGE_KEY, String(next));
    } catch {}
  };

  useEffect(() => {
    let live = true;
    const key = 'truanayangi-github-stars';
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Number.isInteger(cached.count) && Date.now() - cached.savedAt < 900_000) {
        setGithubStars(cached.count);
        return;
      }
    } catch {}
    fetch('https://api.github.com/repos/nagisanzenin/truanayangi')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: unknown) => {
        if (!data || typeof data !== 'object' || !('stargazers_count' in data) || !Number.isInteger(data.stargazers_count)) {
          return;
        }
        const count = data.stargazers_count as number;
        if (!live) return;
        setGithubStars(count);
        try {
          localStorage.setItem(key, JSON.stringify({ count, savedAt: Date.now() }));
        } catch {}
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const eligible = useMemo(
    () => samplePoolByRarity(actresses, poolSize),
    [poolSize, poolNonce],
  );

  const audio = useRef<CaseAudio | null>(null);
  useEffect(() => {
    const engine = new CaseAudio(basePath);
    audio.current = engine;
    engine.preload();
    const hide = () => {
      if (document.hidden) engine.pause();
      else engine.recover();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      engine.dispose();
      audio.current = null;
    };
  }, []);

  const [visibleStart, setVisibleStart] = useState(0);
  const t = copy[language];
  const inventoryCards = useMemo(
    () =>
      [...eligible]
        .sort(
          (a, b) =>
            a.rarity - b.rarity ||
            b.videos - a.videos ||
            actressName(a, language).localeCompare(actressName(b, language), language),
        )
        .map((actress) => <Card actress={actress} language={language} small key={actress.index} />),
    [eligible, language],
  );

  const track = useRef<HTMLDivElement>(null);
  const position = useRef(-400);
  const frame = useRef(0);

  useEffect(() => {
    if (spinning || busy.current) return;
    setReel(eligible.slice(0, Math.min(12, eligible.length)).map((actress, id) => ({ actress, id })));
    setVisibleStart(0);
    position.current = -400;
    if (track.current) track.current.style.transform = 'translate3d(-400px,0,0)';
  }, [eligible, spinning]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!viewport.current) return;
    applyFocusStyles(viewport.current, position.current);
  }, [reel, visibleStart, moving]);

  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      applyFocusStyles(node, position.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function open() {
    if (busy.current || !eligible.length || !track.current || !viewport.current) return;
    audio.current?.unlock();
    busy.current = true;
    const winner = chooseWeightedByRarity(eligible);
    const spinId = crypto.randomUUID();
    const step = REEL_STEP;
    const tileWidth = REEL_TILE_WIDTH;
    const width = viewport.current.clientWidth;
    const start = position.current;
    const center = Math.floor((width / 2 - start) / step);
    const profile = createSpinProfile();
    const target = center + profile.tiles;
    // Land with the winning card centered on the selector (not random in-tile offset).
    const end = width / 2 - tileWidth * 0.5 - target * step;
    const rightEdge = Math.ceil((width - start) / step) + 1;
    const items = reel.filter((item) => item.id >= center - Math.ceil(width / step) - 2 && item.id <= rightEdge);
    const last = Math.max(...items.map((item) => item.id));
    const recent: Actress[] = [];
    for (let id = last + 1; id <= target + 4; id++) {
      const alternatives = eligible.filter((actress) => !recent.includes(actress));
      const actress = id === target ? winner : chooseWeightedByRarity(alternatives.length ? alternatives : eligible);
      items.push({ id, actress });
      recent.push(actress);
      if (recent.length > 8) recent.shift();
    }
    flushSync(() => {
      setReel(items);
      setSpinning(true);
      setMoving(true);
      setResult(null);
    });
    applyFocusStyles(viewport.current, position.current);
    audio.current?.play('csgo_ui_crate_open');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = 6000;
    const started = performance.now();
    let renderedStart = visibleStart;
    let lastCell = Math.floor((start - width / 2) / step);
    const animate = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / duration));
      const next = start + (end - start) * spinProgress(progress, profile.friction);
      position.current = next;
      const firstVisible = Math.max(0, Math.floor(-next / step));
      if (firstVisible - renderedStart >= 4 || firstVisible < renderedStart) {
        renderedStart = Math.max(0, firstVisible - 2);
        setVisibleStart(renderedStart);
      }
      if (track.current) track.current.style.transform = `translate3d(${next}px,0,0)`;
      if (viewport.current) applyFocusStyles(viewport.current, next);
      const cell = Math.floor((next - width / 2) / step);
      if (cell !== lastCell) {
        audio.current?.play('csgo_ui_crate_item_scroll');
        lastCell = cell;
      }
      if (progress < 1) {
        frame.current = requestAnimationFrame(animate);
        return;
      }
      void recordSpin(spinId);
      busy.current = false;
      setSpinning(false);
      setMoving(false);
      setResult(winner);
      setRevealed(true);
      if (viewport.current) applyFocusStyles(viewport.current, next);
      audio.current?.play(
        (['item_reveal3_rare', 'item_reveal4_mythical', 'item_reveal5_legendary', 'item_reveal6_ancient'] as const)[
          winner.rarity
        ],
      );
    };
    frame.current = requestAnimationFrame(animate);
  }

  return (
    <div className="site-shell">
      <header>
        <a href={`${basePath}/`} className="brand">
          <span className="brand-icon">
            <Clapperboard size={21} />
          </span>
          toinayxemgi
          <span className="brand-dot">.</span>
        </a>
        <div className="header-actions">
          <button className="language-button" onClick={() => changeLanguage(language === 'vi' ? 'en' : 'vi')} aria-label={t.language}>
            {language === 'vi' ? 'EN' : 'VI'}
          </button>
          <button
            className="sound-button"
            onClick={() => {
              audio.current?.setMuted(sound);
              setSound(!sound);
            }}
            aria-label={sound ? t.turnSoundOff : t.turnSoundOn}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{sound ? t.soundOn : t.soundOff}</span>
          </button>
          <a
            className="github-button"
            href="https://github.com/nagisanzenin/truanayangi"
            target="_blank"
            rel="noreferrer"
            aria-label={`${t.github}, ${githubStars ?? t.starsPending} stars`}
          >
            <svg className="github-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49v-1.91c-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.89v2.8c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
              />
            </svg>
            <span className="github-label">GitHub</span>
            <span className="github-stars">
              <Star size={13} fill="currentColor" />
              {githubStars === null ? '—' : new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US').format(githubStars)}
            </span>
          </a>
        </div>
      </header>
      <main>
        <div className="intro">
          <h1>{t.title}</h1>
        </div>
        {counterEnabled && (
          <p className="global-counter" title={t.counterTitle}>
            {t.counterPrefix}{' '}
            <strong>{globalSpins === null ? '—' : new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US').format(globalSpins)}</strong>{' '}
            {t.counterSuffix}
          </p>
        )}
        <section className="case-panel" aria-label={t.caseLabel}>
          <div className={`reel-window ${moving ? 'is-spinning' : ''} `} ref={viewport}>
            <div className="reel-focus-ring" aria-hidden="true" />
            <div className="selector-line" />
            <div className="reel-track" ref={track}>
              {reel
                .filter(({ id }) => id >= visibleStart && id < visibleStart + 12)
                .map(({ actress, id }) => (
                  <Card key={id} actress={actress} language={language} slot={id} />
                ))}
            </div>
            <div className="reel-fade left" />
            <div className="reel-fade right" />
          </div>
        </section>
        <div className="control-bar">
          <div className="pool-control">
            <label htmlFor="pool-size">{t.poolLabel}</label>
            <select
              id="pool-size"
              value={poolSize}
              disabled={spinning}
              onChange={(e) => changePoolSize(Number(e.target.value))}
            >
              {POOL_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="open-wrap">
            <button className="open-button" disabled={spinning || !eligible.length} onClick={open}>
              {spinning ? <AudioLines size={22} /> : <Sparkles size={21} />} {spinning ? t.opening : result ? t.openAgain : t.open}{' '}
              <span>↗</span>
            </button>
          </div>
        </div>
        <Dialog open={revealed} onOpenChange={setRevealed}>
          <DialogContent className="winner-dialog" showCloseButton={false}>
            {result && (
              <>
                <span className="winner-label">{t.newItem}</span>
                <DialogTitle className="winner-title">{actressName(result, language)}</DialogTitle>
                <DialogDescription className="winner-description">{actressSubtitle(result, language)}</DialogDescription>
                <div className="winner-art" style={{ '--rarity': colors[result.rarity] } as React.CSSProperties}>
                  <ActressImage actress={result} language={language} />
                </div>
                <div className="winner-actions">
                  <a className="find-button" href={result.href} target="_blank" rel="noreferrer">
                    {t.find} <ArrowUpRight size={16} />
                  </a>
                  <button onClick={() => setRevealed(false)}>{t.continue}</button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <section className="inventory">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t.whatsInside}</span>
              <h2>
                {t.items} <span>{eligible.length.toString().padStart(2, '0')}</span>
              </h2>
            </div>
            <div className="rarity-legend">
              {t.tiers.map((tier, i) => (
                <span key={tier}>
                  <i style={{ background: colors[i] }} />
                  {tier}
                </span>
              ))}
            </div>
          </div>
          <div className="inventory-grid">{inventoryCards}</div>
        </section>

        <footer>
          <span>toinayxemgi.</span>
          <span className="footer-credits">
            <span>
              {t.footer}{' '}
              <a href="https://github.com/sourcesounds/csgo" target="_blank" rel="noreferrer">
                SourceSounds
              </a>
            </span>
            <span>
              {t.inspiredBy}{' '}
              <a href="https://github.com/nagisanzenin" target="_blank" rel="noreferrer">
                https://github.com/nagisanzenin
              </a>
            </span>
          </span>
        </footer>
      </main>
    </div>
  );
}
