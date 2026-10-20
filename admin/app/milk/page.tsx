import { redirect } from 'next/navigation';
import { Shell, ErrorPanel, Pager, EmptyRow } from '../../components/Shell';
import {
  adminFetch, AdminApiError, money, SHIFT_LABEL, TYPE_LABEL,
  type AdminMilkRow, type Paginated,
} from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function MilkPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shift?: string; milkType?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { from = '', to = '', shift = '', milkType = '' } = sp;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  let data: Paginated<AdminMilkRow>;
  try {
    const qs = new URLSearchParams({ page: String(page), limit: '25' });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (shift) qs.set('shift', shift);
    if (milkType) qs.set('milkType', milkType);
    data = await adminFetch<Paginated<AdminMilkRow>>(`/admin/milk?${qs}`);
  } catch (e) {
    const err = e as AdminApiError;
    if (err.status === 401 || err.status === 403) redirect('/login');
    return (
      <Shell active="/milk" title="Milk Records">
        <ErrorPanel message={err.message} />
      </Shell>
    );
  }

  const pageTotal = data.items.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <Shell active="/milk" title="Milk Records" subtitle="Collection entries across all dairies">
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Entries</h2>
          <form method="GET" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="date" name="from" defaultValue={from} aria-label="From date" />
            <input type="date" name="to" defaultValue={to} aria-label="To date" />
            <select name="shift" defaultValue={shift} aria-label="Shift">
              <option value="">All shifts</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
            <select name="milkType" defaultValue={milkType} aria-label="Milk type">
              <option value="">All types</option>
              <option value="buffalo">Buffalo</option>
              <option value="cow">Cow</option>
            </select>
            <button className="btn" type="submit">Filter</button>
          </form>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dairy</th>
                <th>Date</th>
                <th>Shift</th>
                <th>Type</th>
                <th className="num">Qty (L)</th>
                <th className="num">Fat %</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <EmptyRow colSpan={8} message="No milk records match these filters." />
              ) : (
                data.items.map(r => (
                  <tr key={r.id}>
                    <td className="strong">{r.dairy?.dairyName ?? '—'}</td>
                    <td>{r.entryDate}</td>
                    <td>{SHIFT_LABEL[r.shift]}</td>
                    <td>{TYPE_LABEL[r.milkType]}</td>
                    <td className="num">{r.quantityLitres.toFixed(2)}</td>
                    <td className="num">{r.fatPercentage.toFixed(1)}</td>
                    <td className="num">
                      ₹{r.appliedRate}/{r.rateMode === 'perLitre' ? 'L' : 'fat'}
                    </td>
                    <td className="num accent">{money(r.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.items.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={7} className="strong">Page total</td>
                  <td className="num accent">{money(pageTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pager
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          basePath="/milk"
          query={{ from, to, shift, milkType }}
        />
      </div>
    </Shell>
  );
}
