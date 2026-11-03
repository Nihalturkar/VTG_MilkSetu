'use client';

import { useActionState, useState } from 'react';
import { saveReferralSettings } from '../../lib/referrals';
import type { SettingsState } from '../../lib/referralTypes';
import type { ReferralSettings, ReferralMilestone } from '../../lib/api';

type Row = ReferralMilestone & { key: string };

const blankRow = (): Row => ({
  key: Math.random().toString(36).slice(2),
  id: '',
  referrals: 1,
  reward: '',
  rewardAmount: 0,
});

export function SettingsForm({ settings }: { settings: ReferralSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveReferralSettings,
    {},
  );

  // Rows are local state so adding/removing one doesn't need a round trip.
  // `key` is separate from `id` because `id` is the admin-editable slug.
  const [rows, setRows] = useState<Row[]>(
    settings.milestones.map(m => ({ ...m, key: m.id })),
  );

  const patch = (key: string, field: keyof ReferralMilestone, value: string) =>
    setRows(rs =>
      rs.map(r =>
        r.key === key
          ? { ...r, [field]: field === 'referrals' || field === 'rewardAmount' ? Number(value) || 0 : value }
          : r,
      ),
    );

  return (
    <form action={action} className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Program Settings</h2>
        {settings.updatedAt && (
          <span className="muted">
            Last saved {new Date(settings.updatedAt).toLocaleString('en-IN')}
          </span>
        )}
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        {state.error && <ErrorText message={state.error} />}
        {state.ok && !state.error && (
          <p style={{ color: '#15803d', fontWeight: 600, margin: 0 }}>Settings saved.</p>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
          <span className="strong">Program is live</span>
          <span className="muted">
            — when off, the app shows the page but refuses new codes
          </span>
        </label>

        <Field
          label="Share message"
          hint="Sent when a user taps “दोस्तों को भेजें”. Use {code} where the code should appear."
          name="shareMessage"
          defaultValue={settings.shareMessage}
          placeholder="VTG MilkSetu पर जुड़ें और मेरा कोड {code} डालें।"
        />

        <div style={{ display: 'grid', gap: 6 }}>
          <label className="strong" htmlFor="terms">Terms &amp; conditions</label>
          <span className="muted">Shown verbatim in the app. Plain text, written in Hindi.</span>
          <textarea
            id="terms"
            name="terms"
            defaultValue={settings.terms}
            rows={7}
            maxLength={4000}
            placeholder={'1. रेफरल तभी गिना जाएगा जब नई डेयरी रजिस्टर करे।\n2. इनाम एडमिन की पुष्टि के बाद मिलेगा।'}
          />
        </div>

        {/* Milestones */}
        <div style={{ display: 'grid', gap: 8 }}>
          <label className="strong">Milestones</label>
          <span className="muted">
            ID is a short permanent slug (e.g. <code>bronze</code>) — paid rewards are tracked
            by it, so renaming an ID makes already-paid rewards look unpaid.
          </span>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>ID</th>
                  <th style={{ width: 110 }}>Referrals</th>
                  <th>Reward shown to user</th>
                  <th style={{ width: 120 }}>Amount (₹)</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>
                      No milestones. Users still get a code and a referral count.
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.key}>
                      <td>
                        <input
                          name="ms_id"
                          value={r.id}
                          onChange={e => patch(r.key, 'id', e.target.value)}
                          placeholder="bronze"
                          maxLength={40}
                        />
                      </td>
                      <td>
                        <input
                          name="ms_referrals"
                          type="number"
                          min={1}
                          max={10000}
                          value={r.referrals}
                          onChange={e => patch(r.key, 'referrals', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          name="ms_reward"
                          value={r.reward}
                          onChange={e => patch(r.key, 'reward', e.target.value)}
                          placeholder="₹100 रिचार्ज"
                          maxLength={120}
                        />
                      </td>
                      <td>
                        <input
                          name="ms_amount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.rewardAmount}
                          onChange={e => patch(r.key, 'rewardAmount', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn"
            style={{ justifySelf: 'start' }}
            onClick={() => setRows(rs => [...rs, blankRow()])}>
            + Add milestone
          </button>
        </div>

        <button className="btn primary" type="submit" disabled={pending} style={{ justifySelf: 'start' }}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, hint, name, defaultValue, placeholder,
}: {
  label: string; hint: string; name: string; defaultValue: string; placeholder: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label className="strong" htmlFor={name}>{label}</label>
      <span className="muted">{hint}</span>
      <input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} maxLength={500} />
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p style={{ color: '#b91c1c', fontWeight: 600, margin: 0 }}>{message}</p>;
}
