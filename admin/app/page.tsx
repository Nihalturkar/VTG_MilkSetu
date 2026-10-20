import { redirect } from 'next/navigation';
import { Shell, ErrorPanel } from '../components/Shell';
import { adminFetch, AdminApiError, money, type AdminStats } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let stats: AdminStats;
  try {
    stats = await adminFetch<AdminStats>('/admin/dashboard');
  } catch (e) {
    const err = e as AdminApiError;
    // An expired or missing admin token means re-authenticate.
    if (err.status === 401 || err.status === 403) redirect('/login');
    return (
      <Shell active="/" title="Dashboard">
        <ErrorPanel message={err.message} />
      </Shell>
    );
  }

  const cards = [
    { label: 'Total Dairies', value: String(stats.totalDairies) },
    { label: 'Active Dairies', value: String(stats.activeDairies) },
    { label: "Today's Milk", value: `${stats.today.litres} L` },
    { label: "Today's Amount", value: money(stats.today.amount), accent: true },
  ];

  return (
    <Shell active="/" title="Dashboard" subtitle={`Figures for ${stats.date}`}>
      <div className="cards">
        {cards.map(c => (
          <div className="card" key={c.label}>
            <div className="card-label">{c.label}</div>
            <div className={`card-value${c.accent ? ' accent' : ''}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="cards">
        <div className="card">
          <div className="card-label">Entries Today</div>
          <div className="card-value">{stats.today.entries}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Entries (all time)</div>
          <div className="card-value">{stats.totalEntries}</div>
        </div>
      </div>
    </Shell>
  );
}
