import { redirect } from 'next/navigation';
import { Shell, ErrorPanel, Pager, EmptyRow } from '../../components/Shell';
import { adminFetch, AdminApiError, type AdminDairy, type Paginated } from '../../lib/api';

export const dynamic = 'force-dynamic';

const rateLabel = (r: { rateMode: string; rate: number }) =>
  r.rate > 0 ? `₹${r.rate}/${r.rateMode === 'perLitre' ? 'L' : 'fat'}` : '—';

export default async function DairiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search ?? '';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  let data: Paginated<AdminDairy>;
  try {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) qs.set('search', search);
    data = await adminFetch<Paginated<AdminDairy>>(`/admin/dairies?${qs}`);
  } catch (e) {
    const err = e as AdminApiError;
    if (err.status === 401 || err.status === 403) redirect('/login');
    return (
      <Shell active="/dairies" title="Registered Dairies">
        <ErrorPanel message={err.message} />
      </Shell>
    );
  }

  return (
    <Shell active="/dairies" title="Registered Dairies" subtitle="All dairy accounts on the platform">
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Dairies</h2>
          {/* GET form keeps the search term in the URL, so it survives reloads. */}
          <form method="GET" style={{ display: 'flex', gap: 8 }}>
            <input
              type="search"
              name="search"
              placeholder="Search name, owner, mobile"
              defaultValue={search}
              style={{ minWidth: 230 }}
            />
            <button className="btn" type="submit">Search</button>
          </form>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dairy Name</th>
                <th>Owner</th>
                <th>Mobile</th>
                <th>Buffalo Rate</th>
                <th>Cow Rate</th>
                <th>Registered</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <EmptyRow colSpan={7} message={search ? `No dairies match “${search}”.` : 'No dairies registered yet.'} />
              ) : (
                data.items.map(d => (
                  <tr key={d.id}>
                    <td className="strong">{d.dairyName}</td>
                    <td>{d.ownerName}</td>
                    <td>{d.mobile}</td>
                    <td>{rateLabel(d.rateSettings.buffalo)}</td>
                    <td>{rateLabel(d.rateSettings.cow)}</td>
                    <td>{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <span className={`badge ${d.status}`}>
                        {d.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pager
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          basePath="/dairies"
          query={{ search }}
        />
      </div>
    </Shell>
  );
}
