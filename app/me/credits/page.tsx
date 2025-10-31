'use client';

import { useEffect, useState } from 'react';

type LedgerItem = { delta: number; reason: string; createdAt?: string };

export default function MyCreditsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/me/credits');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (aborted) return;
        setBalance(data.balance ?? 0);
        setLedger(Array.isArray(data.ledger) ? data.ledger : []);
      } catch (e: any) {
        if (!aborted) setError(e?.message || '加载失败');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  return (
    <main>
      <h1>我的积分</h1>
      {loading && <p>加载中…</p>}
      {error && <p>出错：{error}</p>}
      {!loading && !error && (
        <section>
          <p>余额：{balance}</p>
          <h2>流水</h2>
          {ledger.length === 0 && <p>暂无流水</p>}
          {ledger.length > 0 && (
            <ul>
              {ledger.map((l, idx) => (
                <li key={idx}>
                  {l.reason} {l.delta > 0 ? `+${l.delta}` : l.delta}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

