import { Shell } from '../../components/Shell';
import { adminFetch } from '../../lib/api';
import { ART_SLOTS, type AppImageRow } from '../../lib/constants';
import { requireAdminToken } from '../../lib/auth';
import { ImageSlot } from './ImageSlot';

export const dynamic = 'force-dynamic';

export default async function ImagesPage() {
  await requireAdminToken();
  const { images } = await adminFetch<{ images: AppImageRow[] }>('/images');
  const byKey = new Map(images.map(i => [i.key, i]));

  // These <img> tags load in the browser, so they cannot use the server's
  // loopback API_BASE_URL. The API is same-origin in production, and in dev
  // it is wherever PUBLIC_API_BASE_URL points.
  const publicBase = process.env.PUBLIC_API_BASE_URL ?? '/api';

  return (
    <Shell
      active="/images"
      title="App Images"
      subtitle="Replace the artwork shown inside the dairy app. Changes reach phones on the next app launch.">
      <div className="slots">
        {ART_SLOTS.map(slot => (
          <ImageSlot
            key={slot.key}
            slot={slot}
            current={byKey.get(slot.key)}
            publicBase={publicBase}
          />
        ))}
      </div>

      <div className="panel panel-note">
        <h2>Before you upload</h2>
        <ul>
          <li>JPG, PNG or WebP, up to 3MB. Larger files are rejected.</li>
          <li>
            Keep roughly the shape listed for each slot. A very different shape gets cropped to
            fit.
          </li>
          <li>
            Use pictures you own or that are licensed for commercial use. The built-in ones are
            royalty-free.
          </li>
        </ul>
      </div>
    </Shell>
  );
}
