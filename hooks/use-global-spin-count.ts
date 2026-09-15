'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_COUNTER_API_URL || '';
const sampleWeight = 8;
const readSampleOneIn = 32;
const staticAnchor = { count: 81_221, savedAt: Date.parse('2026-09-09T10:36:55Z') };
const initialRatePerSecond = 16;
const decayTimeMs = 36 * 60 * 60 * 1000 / Math.LN2;
const storageKey = 'truanayangi-counter-anchor-v2';

function sampled(oneIn: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] < Math.floor(0x1_0000_0000 / oneIn);
}

function project(anchor: { count: number; savedAt: number }, now = Date.now()) {
  const from = Math.max(0, anchor.savedAt - staticAnchor.savedAt);
  const to = Math.max(from, now - staticAnchor.savedAt);
  const additional = initialRatePerSecond * decayTimeMs / 1000 *
    (Math.exp(-from / decayTimeMs) - Math.exp(-to / decayTimeMs));
  return Math.round(anchor.count + additional);
}

export function useGlobalSpinCount() {
  const [count, setCount] = useState<number | null>(null);
  const alive = useRef(true);
  const anchor = useRef(staticAnchor);
  const accept = useCallback((data: { count?: unknown }) => {
    if (alive.current && typeof data.count === 'number' && Number.isSafeInteger(data.count) && data.count >= 0) {
      const value = data.count;
      anchor.current = { count: value, savedAt: Date.now() };
      try { localStorage.setItem(storageKey, JSON.stringify(anchor.current)); } catch {}
      setCount(previous => Math.max(previous ?? 0, value));
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!apiUrl) return () => { alive.current = false; };
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (cached && Number.isSafeInteger(cached.count) && Number.isFinite(cached.savedAt) && cached.savedAt >= staticAnchor.savedAt) anchor.current = cached;
    } catch {}
    setCount(project(anchor.current));
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
        if (response.ok) accept(await response.json());
      } catch { /* A counter outage must not interrupt opening a case. */ }
    };
    if (sampled(readSampleOneIn)) void refresh();
    const updateProjection = () => { if (!document.hidden) setCount(previous => Math.max(previous ?? 0, project(anchor.current))); };
    const interval = setInterval(updateProjection, 10_000);
    document.addEventListener('visibilitychange', updateProjection);
    return () => { alive.current = false; clearInterval(interval); document.removeEventListener('visibilitychange', updateProjection); };
  }, [accept]);

  const recordSpin = useCallback(async (id: string) => {
    if (!apiUrl) return;
    setCount(previous => (previous ?? project(anchor.current)) + 1);
    if (!sampled(sampleWeight)) return;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ id, weight: sampleWeight }), keepalive: true, signal: AbortSignal.timeout(4000),
      });
      if (response.ok) accept(await response.json());
    } catch { /* A counter outage must not interrupt opening a case. */ }
  }, [accept]);
  return { count, enabled: Boolean(apiUrl), recordSpin };
}
