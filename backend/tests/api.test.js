/**
 * End-to-end API test against the running backend + real MongoDB.
 *   node apitest.js
 */
const API = 'http://localhost:4000/api';

let pass = 0;
const failures = [];

function chk(name, want, got) {
  const w = JSON.stringify(want);
  const g = JSON.stringify(got);
  if (w === g) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    failures.push(`${name} (want=${w} got=${g})`);
    console.log(`  FAIL ${name} (want=${w} got=${g})`);
  }
}

// Exactly 10 digits starting 6-9. Padding matters: a short random draw used
// to yield a 9-digit number and fail validation at random.
const randMobile = () =>
  String(6 + Math.floor(Math.random() * 4)) +
  String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || '';
  return {
    status: res.status,
    buf,
    json: type.includes('json') ? JSON.parse(buf.toString()) : null,
  };
}

(async () => {
  const M1 = randMobile();
  const M2 = randMobile();

  console.log('[1] Registration');
  const r1 = await call('POST', '/register', {
    body: { ownerName: 'Ramesh Patil', mobile: M1, dairyName: 'Shree Dairy', deviceId: 'device-aaaaaaaa' },
  });
  const T1 = r1.json?.data?.token;
  chk('register returns 201', 201, r1.status);
  chk('register returns token', true, typeof T1 === 'string' && T1.length > 20);
  chk('rates default to zero', 0, r1.json?.data?.dairy?.rateSettings?.buffalo?.rate);

  const r2 = await call('POST', '/register', {
    body: { ownerName: 'Suresh Jadhav', mobile: M2, dairyName: 'Gokul Dairy', deviceId: 'device-bbbbbbbb' },
  });
  const T2 = r2.json?.data?.token;

  console.log('[2] Validation');
  chk(
    'bad mobile rejected',
    'validation_error',
    (await call('POST', '/register', {
      body: { ownerName: 'X', mobile: '12345', dairyName: 'Y', deviceId: 'device-cccccccc' },
    })).json?.error?.code,
  );
  chk(
    '+91 prefix normalized',
    201,
    (await call('POST', '/register', {
      body: { ownerName: 'Norm Test', mobile: '+91 ' + randMobile(), dairyName: 'Norm Dairy', deviceId: 'device-nnnnnnnn' },
    })).status,
  );
  chk(
    'duplicate mobile rejected',
    'mobile_exists',
    (await call('POST', '/register', {
      body: { ownerName: 'Dup', mobile: M1, dairyName: 'Dup Dairy', deviceId: 'device-dddddddd' },
    })).json?.error?.code,
  );

  console.log('[3] Auth');
  chk('no token -> 401', 'unauthorized', (await call('GET', '/dashboard')).json?.error?.code);
  chk('bad token -> 401', 'unauthorized', (await call('GET', '/dashboard', { token: 'garbage' })).json?.error?.code);
  chk('session restore works', M1, (await call('GET', '/me', { token: T1 })).json?.data?.dairy?.mobile);

  console.log('[4] Rate gate');
  chk(
    'entry blocked before rate set',
    'rate_not_set',
    (await call('POST', '/milk', {
      token: T1,
      body: { shift: 'morning', milkType: 'buffalo', quantityLitres: 10, fatPercentage: 5 },
    })).json?.error?.code,
  );

  console.log('[5] Rates');
  await call('PUT', '/rates', {
    token: T1,
    body: { buffalo: { rateMode: 'perFatPoint', rate: 9 }, cow: { rateMode: 'perLitre', rate: 60 } },
  });
  const rates = (await call('GET', '/rates', { token: T1 })).json?.data;
  chk('buffalo rate saved', 9, rates?.buffalo?.rate);
  chk('buffalo mode saved', 'perFatPoint', rates?.buffalo?.rateMode);
  chk('cow mode independent', 'perLitre', rates?.cow?.rateMode);
  chk('cow rate independent', 60, rates?.cow?.rate);

  console.log('[6] Milk entries + server-side math');
  const e1 = await call('POST', '/milk', {
    token: T1,
    body: { shift: 'morning', milkType: 'buffalo', quantityLitres: 10, fatPercentage: 5 },
  });
  chk('perFatPoint 10x5x9 = 450', 450, e1.json?.data?.totalAmount);
  chk('entry snapshots rate', 9, e1.json?.data?.appliedRate);

  const e2 = await call('POST', '/milk', {
    token: T1,
    body: { shift: 'evening', milkType: 'cow', quantityLitres: 10, fatPercentage: 4 },
  });
  chk('perLitre 10x60 = 600 (fat ignored)', 600, e2.json?.data?.totalAmount);

  const e3 = await call('POST', '/milk', {
    token: T1,
    body: {
      shift: 'morning', milkType: 'buffalo', quantityLitres: 10, fatPercentage: 5,
      totalAmount: 99999, appliedRate: 99999, dairyId: '000000000000000000000000',
    },
  });
  chk('client-sent amount ignored', 450, e3.json?.data?.totalAmount);
  chk('client-sent rate ignored', 9, e3.json?.data?.appliedRate);

  chk('zero qty rejected', 'validation_error',
    (await call('POST', '/milk', { token: T1, body: { shift: 'morning', milkType: 'buffalo', quantityLitres: 0, fatPercentage: 5 } })).json?.error?.code);
  chk('negative qty rejected', 'validation_error',
    (await call('POST', '/milk', { token: T1, body: { shift: 'morning', milkType: 'buffalo', quantityLitres: -5, fatPercentage: 5 } })).json?.error?.code);
  chk('fat out of range rejected', 'validation_error',
    (await call('POST', '/milk', { token: T1, body: { shift: 'morning', milkType: 'buffalo', quantityLitres: 5, fatPercentage: 99 } })).json?.error?.code);
  chk('bad shift rejected', 'validation_error',
    (await call('POST', '/milk', { token: T1, body: { shift: 'midnight', milkType: 'buffalo', quantityLitres: 5, fatPercentage: 5 } })).json?.error?.code);
  chk('future date rejected', 'future_date',
    (await call('POST', '/milk', { token: T1, body: { entryDate: '2099-01-01', shift: 'morning', milkType: 'buffalo', quantityLitres: 5, fatPercentage: 5 } })).json?.error?.code);

  console.log('[7] Dashboard totals from DB');
  const d = (await call('GET', '/dashboard', { token: T1 })).json?.data;
  chk('today litres = 30', 30, d?.today?.overall?.litres);
  chk('today amount = 1500', 1500, d?.today?.overall?.amount);
  chk('morning litres = 20', 20, d?.today?.morning?.litres);
  chk('evening litres = 10', 10, d?.today?.evening?.litres);
  chk('buffalo amount = 900', 900, d?.today?.buffalo?.amount);
  chk('cow amount = 600', 600, d?.today?.cow?.amount);
  chk('recent entries present', 3, d?.recentEntries?.length);

  console.log('[8] CROSS-DAIRY ISOLATION');
  chk('dairy2 sees 0 entries', 0, (await call('GET', '/milk', { token: T2 })).json?.data?.total);
  chk('dairy2 dashboard empty', 0, (await call('GET', '/dashboard', { token: T2 })).json?.data?.today?.overall?.litres);
  chk('dairy1 sees own 3', 3, (await call('GET', '/milk', { token: T1 })).json?.data?.total);
  chk('dairy2 rates untouched', 0, (await call('GET', '/rates', { token: T2 })).json?.data?.buffalo?.rate);

  console.log('[9] Rate change must not rewrite history');
  await call('PUT', '/rates', { token: T1, body: { buffalo: { rateMode: 'perFatPoint', rate: 20 } } });
  const hist = (await call('GET', '/milk?milkType=buffalo', { token: T1 })).json?.data?.items?.[0];
  chk('old entry keeps rate 9', 9, hist?.appliedRate);
  chk('old amount still 450', 450, hist?.totalAmount);
  chk('new rate is live', 20, (await call('GET', '/rates', { token: T1 })).json?.data?.buffalo?.rate);

  console.log('[10] Filters + pagination');
  chk('shift filter', 1, (await call('GET', '/milk?shift=evening', { token: T1 })).json?.data?.total);
  chk('type filter', 2, (await call('GET', '/milk?milkType=buffalo', { token: T1 })).json?.data?.total);
  chk('pagination limit', 1, (await call('GET', '/milk?limit=1&page=1', { token: T1 })).json?.data?.items?.length);
  chk('totalPages computed', 3, (await call('GET', '/milk?limit=1', { token: T1 })).json?.data?.totalPages);

  console.log('[11] Reports');
  const rep = (await call('GET', '/reports', { token: T1 })).json?.data;
  chk('report totals match', 1500, rep?.overall?.amount);
  chk('daily breakdown present', 1, rep?.daily?.length);
  chk('reversed range rejected', 'bad_range',
    (await call('GET', '/reports?from=2026-10-10&to=2026-10-01', { token: T1 })).json?.error?.code);

  console.log('[12] Admin');
  chk('admin bad creds', 'unauthorized',
    (await call('POST', '/admin/login', { body: { email: 'admin@vtgmilksetu.local', password: 'wrongpassword' } })).json?.error?.code);
  chk('dairy token rejected on admin', 'unauthorized',
    (await call('GET', '/admin/dashboard', { token: T1 })).json?.error?.code);
  chk('admin route needs auth', 'unauthorized',
    (await call('GET', '/admin/dairies')).json?.error?.code);

  console.log('[13] Report filters must narrow the summary');
  // Regression: /reports used to ignore shift/milkType, so the on-screen
  // totals disagreed with the (correctly filtered) PDF.
  const mornRep = (await call('GET', '/reports?shift=morning', { token: T1 })).json?.data;
  const eveRep = (await call('GET', '/reports?shift=evening', { token: T1 })).json?.data;
  const cowRep = (await call('GET', '/reports?milkType=cow', { token: T1 })).json?.data;
  const noneRep = (await call('GET', '/reports?shift=morning&milkType=cow', { token: T1 })).json?.data;
  chk('shift=morning narrows amount', 900, mornRep?.overall?.amount);
  chk('shift=evening narrows amount', 600, eveRep?.overall?.amount);
  chk('milkType=cow narrows amount', 600, cowRep?.overall?.amount);
  chk('impossible combo yields zero', 0, noneRep?.overall?.amount);
  chk('filtered summary != unfiltered', true, mornRep?.overall?.amount !== rep?.overall?.amount);

  console.log('[14] Entry-level detail (used by the Reports screen)');
  const detail = (await call('GET', '/milk?limit=100', { token: T1 })).json?.data;
  chk('detail rows returned', 3, detail?.items?.length);
  chk('row exposes fat', 'number', typeof detail?.items?.[0]?.fatPercentage);
  chk('row exposes appliedRate', 'number', typeof detail?.items?.[0]?.appliedRate);
  chk('row exposes rateMode', 'string', typeof detail?.items?.[0]?.rateMode);

  console.log('[15] PDF');
  const pdf = await call('GET', '/reports/pdf', { token: T1 });
  chk('pdf magic bytes', '%PDF', pdf.buf.subarray(0, 4).toString());
  chk('pdf non-trivial size', true, pdf.buf.length > 2000);
  chk('pdf needs auth', 'unauthorized', (await call('GET', '/reports/pdf')).json?.error?.code);
  require('fs').writeFileSync(process.argv[2] || 'report.pdf', pdf.buf);

  console.log(`\nRESULT: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
})().catch(e => {
  console.error('HARNESS ERROR:', e);
  process.exit(1);
});
