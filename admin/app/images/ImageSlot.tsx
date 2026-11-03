'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { kb, type AppImageRow } from '../../lib/constants';
import { uploadImage, resetImage, type ImageFormState } from './actions';

const initial: ImageFormState = {};

function UploadButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={disabled || pending}>
      {pending ? 'Uploading…' : 'Upload'}
    </button>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-link" disabled={pending}>
      {pending ? 'Resetting…' : 'Reset to default'}
    </button>
  );
}

export function ImageSlot({
  slot,
  current,
  publicBase,
}: {
  slot: { key: string; label: string; hint: string };
  current?: AppImageRow;
  publicBase: string;
}) {
  const [upState, upAction] = useActionState(uploadImage, initial);
  const [resetState, resetAction] = useActionState(resetImage, initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const error = upState.error ?? resetState.error;
  // Cache-bust on version so a replaced image shows immediately.
  const liveSrc = current ? `${publicBase}/images/${slot.key}?v=${current.version}` : null;

  return (
    <div className="slot">
      <div className="slot-art">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" />
        ) : liveSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={liveSrc} alt={slot.label} />
        ) : (
          <div className="slot-empty">Using the app&apos;s built-in image</div>
        )}
      </div>

      <div className="slot-body">
        <div className="slot-head">
          <h3>{slot.label}</h3>
          {current ? (
            <span className="pill pill-on">Custom · v{current.version}</span>
          ) : (
            <span className="pill">Default</span>
          )}
        </div>
        <p className="slot-hint">{slot.hint}</p>
        {current && <p className="slot-meta">{kb(current.bytes)} · {current.contentType}</p>}

        {error && <p className="slot-error">{error}</p>}

        <form action={upAction} className="slot-form">
          <input type="hidden" name="key" value={slot.key} />
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e => {
              const f = e.target.files?.[0];
              setPicked(f ? f.name : null);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <UploadButton disabled={!picked} />
        </form>

        {current && (
          <form action={resetAction}>
            <input type="hidden" name="key" value={slot.key} />
            <ResetButton />
          </form>
        )}
      </div>
    </div>
  );
}
