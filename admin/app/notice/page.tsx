import { Shell } from '../../components/Shell';
import { adminFetch } from '../../lib/api';
import type { NoticeSettings } from '../../lib/constants';
import { requireAdminToken } from '../../lib/auth';
import { NoticeForm } from './NoticeForm';

export const dynamic = 'force-dynamic';

export default async function NoticePage() {
  await requireAdminToken();
  const settings = await adminFetch<NoticeSettings>('/admin/notice');

  return (
    <Shell
      active="/notice"
      title="Weekly Summary Popup"
      subtitle="A once-a-week payout summary shown inside the dairy app.">
      <div className="panel">
        <NoticeForm settings={settings} />
      </div>

      <div className="panel panel-note">
        <h2>How it works</h2>
        <ul>
          <li>
            Each dairy sees <strong>its own</strong> totals — morning and evening litres, and the
            amount due. Nobody sees another dairy&apos;s figures.
          </li>
          <li>
            The popup appears once on the chosen day. Dismissing it keeps it closed until the next
            week.
          </li>
          <li>
            Totals come from saved milk entries, so they match the reports screen exactly.
          </li>
        </ul>
      </div>
    </Shell>
  );
}
