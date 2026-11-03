'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { WEEKDAY_LABELS, type NoticeSettings } from '../../lib/constants';
import { saveNotice, type NoticeFormState } from './actions';

const initial: NoticeFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  );
}

/** How many days the chosen window spans, both ends inclusive. */
function spanDays(startDay: number, endDay: number) {
  return (((endDay - startDay + 7) % 7) || 6) + 1;
}

export function NoticeForm({ settings }: { settings: NoticeSettings }) {
  const [state, formAction] = useActionState(saveNotice, initial);
  const [startDay, setStartDay] = useState(settings.startDay);
  const [endDay, setEndDay] = useState(settings.endDay);
  const [enabled, setEnabled] = useState(settings.enabled);

  const days = spanDays(startDay, endDay);

  return (
    <form action={formAction} className="notice-form">
      {state.error && (
        <div className="login-error" role="alert">
          <span>{state.error}</span>
        </div>
      )}
      {state.saved && !state.error && (
        <div className="notice-ok" role="status">
          Saved. Dairies will see this on {WEEKDAY_LABELS[startDay]}.
        </div>
      )}

      <label className="notice-toggle">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
        <span>
          <strong>Show the weekly summary popup</strong>
          <small>Turn this off to stop the popup without losing these settings.</small>
        </span>
      </label>

      <div className="notice-days">
        <div className="field">
          <label htmlFor="startDay">Popup shows on</label>
          <select
            id="startDay"
            name="startDay"
            value={startDay}
            onChange={e => setStartDay(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="endDay">Week counted up to</label>
          <select
            id="endDay"
            name="endDay"
            value={endDay}
            onChange={e => setEndDay(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="notice-preview">
        On <strong>{WEEKDAY_LABELS[startDay]}</strong>, each dairy sees its totals for{' '}
        <strong>{WEEKDAY_LABELS[startDay]}</strong> through{' '}
        <strong>{WEEKDAY_LABELS[endDay]}</strong> — {days} days, including both ends.
      </p>

      <div className="field">
        <label htmlFor="title">Popup heading</label>
        <input
          id="title"
          name="title"
          defaultValue={settings.title}
          maxLength={80}
          placeholder="इस हफ़्ते का हिसाब"
        />
      </div>

      <div className="field">
        <label htmlFor="message">Message (optional)</label>
        <input
          id="message"
          name="message"
          defaultValue={settings.message}
          maxLength={300}
          placeholder="गुरुवार को भुगतान मिलेगा"
        />
        <small className="field-hint">
          Shown above the totals. Dairies read Hindi, so write it in Hindi.
        </small>
      </div>

      <SaveButton />
    </form>
  );
}
