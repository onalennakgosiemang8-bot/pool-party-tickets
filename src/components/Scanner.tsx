'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminBar } from './AdminBar';

type ScanResult = {
  result: 'valid' | 'already' | 'invalid' | 'unpaid' | 'cancelled';
  message: string;
  guestName?: string;
  ticketNumber?: string;
  status?: string;
  checkedInAt?: string | null;
};

const TONE: Record<ScanResult['result'], { mark: string; ring: string; text: string; label: string }> = {
  valid: { mark: '✓', ring: 'border-aqua/60 bg-aqua/10', text: 'text-aqua', label: 'VALID TICKET' },
  already: { mark: '⚠', ring: 'border-gold/60 bg-gold/10', text: 'text-gold', label: 'ALREADY CHECKED IN' },
  unpaid: { mark: '✕', ring: 'border-gold/60 bg-gold/10', text: 'text-gold', label: 'NOT PAID' },
  cancelled: { mark: '✕', ring: 'border-gold/60 bg-gold/10', text: 'text-gold', label: 'CANCELLED' },
  invalid: { mark: '✕', ring: 'border-red-400/60 bg-red-500/10', text: 'text-red-300', label: 'INVALID TICKET' },
};

export function Scanner({ adminName }: { adminName: string }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [log, setLog] = useState<{ name: string; ticket: string; at: string }[]>([]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastPayload = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  const submit = useCallback(async (payload: string) => {
    const now = Date.now();
    // Ignore the same code re-read by the camera within three seconds.
    if (payload === lastPayload.current.value && now - lastPayload.current.at < 3000) return;
    lastPayload.current = { value: payload, at: now };

    try {
      const res = await fetch('/api/admin/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const data = (await res.json()) as ScanResult;
      setResult(data);

      if (navigator.vibrate) navigator.vibrate(data.result === 'valid' ? 60 : [40, 60, 40]);
      if (data.result === 'valid' && data.guestName && data.ticketNumber) {
        setLog((l) =>
          [
            {
              name: data.guestName!,
              ticket: data.ticketNumber!,
              at: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
            },
            ...l,
          ].slice(0, 20),
        );
      }
    } catch {
      setResult({ result: 'invalid', message: 'No connection — check signal and scan again.' });
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const instance = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = instance as unknown as { stop: () => Promise<void>; clear: () => void };
      await instance.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decoded: string) => void submit(decoded),
        () => {
          /* per-frame decode misses are normal */
        },
      );
      setScanning(true);
    } catch (error) {
      setCameraError(
        'The camera would not start. Allow camera access for this site, or type the ticket code in below.',
      );
      console.error(error);
    }
  }, [submit]);

  useEffect(() => () => void stop(), [stop]);

  const tone = result ? TONE[result.result] : null;

  return (
    <div className="min-h-dvh">
      <AdminBar adminName={adminName} active="check-in" />

      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="font-display text-2xl text-foam">Gate check-in</h1>
        <p className="mt-1 text-sm text-foam/55">
          Point the camera at the guest&rsquo;s QR code. Each ticket scans in once.
        </p>

        <div className="glass mt-5 overflow-hidden rounded-2xl">
          <div id="qr-reader" className="min-h-[280px] w-full bg-abyss/60 [&_video]:w-full" />
          <div className="flex gap-3 p-4">
            {scanning ? (
              <button
                onClick={() => void stop()}
                className="w-full rounded-full border border-foam/25 px-5 py-3 text-sm font-semibold text-foam/85"
              >
                Stop camera
              </button>
            ) : (
              <button
                onClick={() => void start()}
                className="w-full rounded-full bg-gold px-5 py-3 text-sm font-extrabold text-abyss shadow-gold"
              >
                Start camera
              </button>
            )}
          </div>
        </div>

        {cameraError && (
          <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-goldlite">
            {cameraError}
          </p>
        )}

        {result && tone && (
          <section
            className={`mt-5 rounded-2xl border p-6 text-center ${tone.ring}`}
            aria-live="assertive"
          >
            <p className={`font-display text-5xl leading-none ${tone.text}`}>{tone.mark}</p>
            <p className={`mt-3 text-sm font-extrabold tracking-[0.18em] ${tone.text}`}>
              {tone.label}
            </p>

            {result.guestName && (
              <>
                <p className="mt-4 font-display text-2xl text-foam">{result.guestName}</p>
                <p className="text-sm text-gold">#{result.ticketNumber}</p>
              </>
            )}

            <p className="mt-3 text-sm text-foam/65">{result.message}</p>

            {result.checkedInAt && (
              <p className="mt-1 text-xs text-foam/45">
                Checked in at{' '}
                {new Date(result.checkedInAt).toLocaleTimeString('en-ZA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}

            <button
              onClick={() => setResult(null)}
              className="mt-5 rounded-full border border-foam/25 px-6 py-2.5 text-sm font-semibold text-foam/85"
            >
              Next guest
            </button>
          </section>
        )}

        <details className="glass mt-5 rounded-2xl p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foam/80">
            Type a code instead
          </summary>
          <div className="mt-3 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="PSWP1.PARKS-0001…"
              className="w-full rounded-xl border border-foam/15 bg-abyss/50 px-4 py-3 text-sm text-foam placeholder:text-foam/30 outline-none focus:border-aqua/60"
            />
            <button
              onClick={() => {
                if (manual.trim()) void submit(manual.trim());
                setManual('');
              }}
              className="shrink-0 rounded-xl bg-gold px-5 text-sm font-extrabold text-abyss"
            >
              Check
            </button>
          </div>
          <p className="mt-2 text-xs text-foam/45">
            The full code is printed under the QR on the PDF pass.
          </p>
        </details>

        {log.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foam/70">Checked in this session</h2>
            <ul className="mt-3 divide-y divide-foam/10 rounded-2xl border border-foam/10">
              {log.map((entry, i) => (
                <li key={`${entry.ticket}-${i}`} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-foam">{entry.name}</span>
                  <span className="text-foam/45">
                    #{entry.ticket} · {entry.at}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
