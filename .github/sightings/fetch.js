/* Recent waterfowl sightings from eBird (Cornell Lab of Ornithology) for every state the map carries.
   Runs once a day in GitHub Actions (.github/workflows/sightings.yml) and writes data/<state>/sightings.json.

   - Public eBird hotspots only. Personal locations (someone's yard) are never asked for, and any that
     slip through are dropped.
   - The API key comes from the EBIRD repository secret (passed in as EBIRD_API_KEY). It goes in the
     request header and nowhere else — never into a file or the log.
   - eBird API terms: non-commercial use, credit eBird.org with a link, keep the load light. So: one
     request at a time, a pause between them, once a day.
   - A state whose fetch is incomplete keeps yesterday's file rather than shipping a partial one. */
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data');
const API = process.env.EBIRD_API_BASE || 'https://api.ebird.org/v2';
const KEY = process.env.EBIRD_API_KEY || '';
const BACK = 14;                                     // days of reports kept (eBird allows up to 30)
const PAUSE_MS = +(process.env.EBIRD_PAUSE_MS || 400);
const SPECIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'species.json'), 'utf8')).species;

const sleep = ms => new Promise(r => setTimeout(r, ms));
class KeyRefused extends Error {}

async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'X-eBirdApiToken': KEY, 'User-Agent': 'Flightline/1.0 (+https://vikqazi.github.io/granite-flyway/)' },
                               signal: AbortSignal.timeout(30000) });
    } catch (e) {
      if (attempt >= 4) throw new Error('no response (' + ((e.cause && e.cause.code) || e.name) + ')');
      await sleep(3000 * attempt * attempt); continue;
    }
    if (res.status === 401 || res.status === 403) throw new KeyRefused('eBird refused the API key (HTTP ' + res.status + '). Check the EBIRD repository secret.');
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(6000 * attempt * attempt); continue; }
    throw new Error('HTTP ' + res.status);
  }
}

/* rows from every species -> compact tables: species, dates, locations, then [loc, species, date, count] */
function build(region, results) {
  const locs = new Map(), best = new Map();
  for (const { sp, rows } of results) {
    if (!Array.isArray(rows)) throw new Error(sp.code + ': unexpected reply');
    for (const r of rows) {
      if (r.locationPrivate || r.obsValid === false) continue;        // personal locations, rejected records
      if (!r.locId || !r.obsDt || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
      if (!locs.has(r.locId)) locs.set(r.locId, [r.locId, String(r.locName || r.locId), +r.lat.toFixed(5), +r.lng.toFixed(5)]);
      const o = { loc: r.locId, sp: sp.code, d: r.obsDt.slice(0, 10), n: Number.isFinite(r.howMany) ? r.howMany : null };
      const k = o.loc + '|' + o.sp, prev = best.get(k);
      if (!prev || o.d > prev.d) best.set(k, o);                       // eBird sends one per place already; keep the newest if not
    }
  }
  const spList = SPECIES.filter(s => [...best.values()].some(o => o.sp === s.code));
  const spIx = new Map(spList.map((s, i) => [s.code, i]));
  const locList = [...locs.values()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const locIx = new Map(locList.map((l, i) => [l[0], i]));
  const dates = [...new Set([...best.values()].map(o => o.d))].sort().reverse();
  const dIx = new Map(dates.map((d, i) => [d, i]));
  const obs = [...best.values()].map(o => [locIx.get(o.loc), spIx.get(o.sp), dIx.get(o.d), o.n])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    source: 'eBird.org — Cornell Lab of Ornithology. Reports at public eBird hotspots; personal locations left out.',
    region, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), back: BACK,
    species: spList.map(s => s.noSeason ? [s.code, s.name, s.group, 1] : [s.code, s.name, s.group]),
    dates, locs: locList, obs
  };
}

(async () => {
  if (!KEY) {
    console.log('The EBIRD repository secret is not set, so there is nothing to fetch. Add it to turn the sightings layer on.');
    return;
  }
  const states = fs.readdirSync(DATA).filter(d => /^[a-z]{2}$/.test(d) && fs.existsSync(path.join(DATA, d, 'zones.json'))).sort();
  let failed = 0;
  for (const st of states) {
    const region = 'US-' + st.toUpperCase(), results = [], errors = [];
    for (const sp of SPECIES) {
      try { results.push({ sp, rows: await getJSON(`${API}/data/obs/${region}/recent/${sp.code}?back=${BACK}&hotspot=true`) }); }
      catch (e) { if (e instanceof KeyRefused) throw e; errors.push(sp.code + ' ' + e.message); }
      await sleep(PAUSE_MS);
    }
    let out = null;
    try { if (!errors.length) out = build(region, results); } catch (e) { errors.push(e.message); }
    if (errors.length) { failed++; console.log(`${region}: ${errors.length} request(s) failed, so yesterday's file stays — ${errors.join('; ')}`); continue; }
    if (!out.obs.length) { failed++; console.log(`${region}: eBird returned no reports at all, which is not plausible, so yesterday's file stays.`); continue; }
    fs.writeFileSync(path.join(DATA, st, 'sightings.json'), JSON.stringify(out) + '\n');
    console.log(`${region}: ${out.locs.length} hotspots, ${out.obs.length} reports, ${out.species.length} species, ${out.dates[out.dates.length - 1]} to ${out.dates[0]}`);
  }
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
