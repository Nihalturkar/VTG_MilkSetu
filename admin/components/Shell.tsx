import Link from 'next/link';
import { logout } from '../lib/auth';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/dairies', label: 'Registered Dairies' },
  { href: '/milk', label: 'Milk Records' },
];

/** Sidebar layout. A desktop sidebar is allowed in the admin panel. */
export function Shell({
  active,
  title,
  subtitle,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="brand">VTG MilkSetu</div>
          <div className="brand-sub">Admin Panel</div>
        </div>
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className={`nav-link${active === l.href ? ' active' : ''}`}>
            {l.label}
          </Link>
        ))}
        <div className="sidebar-foot">
          <form action={logout}>
            <button type="submit" className="btn ghost">Log out</button>
          </form>
        </div>
      </aside>

      <main className="main">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  basePath,
  query = {},
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const link = (p: number) => {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v && qs.set(k, v));
    qs.set('page', String(p));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <div className="pager">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      {page > 1 && <Link href={link(page - 1)} className="btn">Previous</Link>}
      <span>Page {page} of {totalPages}</span>
      {page < totalPages && <Link href={link(page + 1)} className="btn">Next</Link>}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="panel">
      <div className="state">
        <div className="state-title">Could not load data</div>
        <div>{message}</div>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="state">{message}</div>
      </td>
    </tr>
  );
}
