import { redirect } from 'next/navigation';
import { Shell, ErrorPanel, Pager, EmptyRow } from '../../components/Shell';
import {
  adminFetch, AdminApiError,
  type ReferralSettings, type ReferralLeader, type Paginated,
} from '../../lib/api';
import { markRewardPaid } from '../../lib/referrals';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  let settings: ReferralSettings;
  let leaders: Paginated<ReferralLeader>;
  try {
    [settings, leaders] = await Promise.all([
      adminFetch<ReferralSettings>('/admin/referrals/settings'),
      adminFetch<Paginated<ReferralLeader>>(`/admin/referrals?page=${page}&limit=20`),
    ]);
  } catch (e) {
    const err = e as AdminApiError;
    if (err.status === 401 || err.status === 403) redirect('/login');
    return (
      <Shell active="/referrals" title="Refer & Earn">
        <ErrorPanel message={err.message} />
      </Shell>
    );
  }

  return (
    <Shell
      active="/referrals"
      title="Refer & Earn"
      subtitle="Terms, milestones and rewards — changes go live in the app immediately">
      <SettingsForm settings={settings} />

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Top Referrers</h2>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Dairy</th>
                <th>Mobile</th>
                <th>Code</th>
                <th>Referrals</th>
                <th>Rewards</th>
              </tr>
            </thead>
            <tbody>
              {leaders.items.length === 0 ? (
                <EmptyRow colSpan={6} message="No referrals yet." />
              ) : (
                leaders.items.map(l => (
                  <tr key={l.id}>
                    <td className="strong">{l.ownerName}</td>
                    <td>{l.dairyName}</td>
                    <td>{l.mobile}</td>
                    <td>{l.referralCode ?? '—'}</td>
                    <td className="strong">{l.referralCount}</td>
                    <td>
                      <RewardCells leader={l} milestones={settings.milestones} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pager
          page={leaders.page}
          totalPages={leaders.totalPages}
          total={leaders.total}
          basePath="/referrals"
          query={{}}
        />
      </div>
    </Shell>
  );
}

/**
 * Per-milestone payout state for one referrer.
 *
 * Only milestones they have actually reached are shown — an unreachable one
 * is noise, and the API rejects marking it anyway.
 */
function RewardCells({
  leader,
  milestones,
}: {
  leader: ReferralLeader;
  milestones: ReferralSettings['milestones'];
}) {
  const reached = milestones
    .filter(m => leader.referralCount >= m.referrals)
    .sort((a, b) => a.referrals - b.referrals);

  if (reached.length === 0) return <span className="muted">—</span>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {reached.map(m =>
        leader.rewardsClaimed.includes(m.id) ? (
          <span key={m.id} className="badge active" title={m.reward}>
            {m.id} paid
          </span>
        ) : (
          <form key={m.id} action={markRewardPaid}>
            <input type="hidden" name="dairyId" value={leader.id} />
            <input type="hidden" name="milestoneId" value={m.id} />
            <button className="btn" type="submit" title={`Mark “${m.reward}” as paid`}>
              Mark {m.id} paid
            </button>
          </form>
        ),
      )}
    </div>
  );
}
