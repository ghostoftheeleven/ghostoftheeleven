// Генерирует SVG для профиля: бейджи, статистику, языки, карточки проектов и бегущую строку.
// Запускается из GitHub Actions (см. .github/workflows/snake.yml), результат кладётся в dist/.
import { mkdir, writeFile } from "node:fs/promises";

const USER = process.env.GH_USER || "ghostoftheeleven";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT_DIR || "dist";
const SHOWCASE = [
  "ghostoftheeleven/mpei-next",
  "team-ph4r0s/dementia-panel",
  "Johnny-Wickky/arca",
];

const FONT = "'Segoe UI','SF Pro Display',Inter,system-ui,-apple-system,Arial,sans-serif";
const MONO = "'JetBrains Mono','Cascadia Code','SF Mono',Consolas,monospace";
const LANG_COLORS = {
  Kotlin: "#A97BFF", TypeScript: "#3178C6", Rust: "#DEA584", JavaScript: "#F1E05A",
  Python: "#3572A5", Java: "#B07219", Go: "#00ADD8", "C++": "#F34B7D", C: "#8a8a8a",
  Shell: "#89E051", Dockerfile: "#384D54", HTML: "#E34C26", CSS: "#563D7C", Swift: "#F05138",
  Dart: "#00B4AB", PowerShell: "#5391FE", "C#": "#178600",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "profile-readme-generator",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function paginate(path) {
  const all = [];
  for (let page = 1; page < 10; page++) {
    const chunk = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    all.push(...chunk);
    if (chunk.length < 100) break;
  }
  return all;
}

async function contributions() {
  if (!TOKEN) return null;
  try {
    const data = await api("/graphql", {
      method: "POST",
      body: JSON.stringify({
        query: `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{totalContributions}}}}`,
        variables: { u: USER },
      }),
    });
    return data.data.user.contributionsCollection.contributionCalendar.totalContributions;
  } catch {
    return null;
  }
}

const write = (name, svg) => writeFile(`${OUT}/${name}`, svg.trim() + "\n");

/* ---------- бейджи ---------- */
function badge({ label, value, color, icon }) {
  const labelText = label.toUpperCase();
  const valueText = String(value);
  const lw = 44 + labelText.length * 8.6;
  const vw = 28 + valueText.length * 9.4;
  const w = Math.round(lw + vw);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28" viewBox="0 0 ${w} 28" fill="none">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="c"><rect width="${w}" height="28" rx="6"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="${lw}" height="28" fill="#1a2040"/>
    <rect x="${lw}" width="${vw}" height="28" fill="${color}"/>
    <rect x="-40" width="40" height="28" fill="url(#sheen)" transform="skewX(-20)">
      <animate attributeName="x" values="-60;${w + 40};${w + 40}" keyTimes="0;0.4;1" dur="5s" repeatCount="indefinite"/>
    </rect>
  </g>
  <text x="14" y="18.5" font-family="${FONT}" font-size="13" fill="#fff">${icon}</text>
  <text x="34" y="18" font-family="${MONO}" font-size="11.5" font-weight="700" letter-spacing="1" fill="#fff">${esc(labelText)}</text>
  <text x="${lw + vw / 2}" y="18" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="800" fill="#0b0f1e">${esc(valueText)}</text>
</svg>`;
}

/* ---------- карточка статистики ---------- */
function statsCard(items) {
  const tileW = 200;
  const W = tileW * items.length;
  const C = 2 * Math.PI * 38;
  const tiles = items
    .map((it, i) => {
      const cx = i * tileW + tileW / 2;
      const ratio = Math.max(0.06, Math.min(1, it.value / it.target));
      const off = (C * (1 - ratio)).toFixed(1);
      return `
  <g>
    <circle cx="${cx}" cy="82" r="38" stroke="#ffffff" stroke-opacity="0.07" stroke-width="7"/>
    <circle cx="${cx}" cy="82" r="38" stroke="url(#ring${i})" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" transform="rotate(-90 ${cx} 82)">
      <animate attributeName="stroke-dashoffset" from="${C.toFixed(1)}" to="${off}" dur="1.8s" begin="${i * 0.2}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>
    </circle>
    <circle cx="${cx}" cy="82" r="48" stroke="${it.color}" stroke-opacity="0.35" stroke-width="1">
      <animate attributeName="r" values="46;52;46" dur="3.2s" begin="${i * 0.4}s" repeatCount="indefinite"/>
      <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3.2s" begin="${i * 0.4}s" repeatCount="indefinite"/>
    </circle>
    <text x="${cx}" y="90" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="800" fill="#fff">${esc(fmt(it.value))}</text>
    <text x="${cx}" y="152" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="700" letter-spacing="1.5" fill="#9aa4c7">${esc(it.label.toUpperCase())}</text>
  </g>`;
    })
    .join("");
  const grads = items
    .map(
      (it, i) => `
    <linearGradient id="ring${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${it.color}"/><stop offset="1" stop-color="#5eead4"/>
    </linearGradient>`
    )
    .join("");
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="190" viewBox="0 0 ${W} 190" fill="none">
  <defs>${grads}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1226"/><stop offset="1" stop-color="#12112a"/></linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="189" rx="20" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.1"/>
  ${tiles}
</svg>`;
}

/* ---------- языки ---------- */
function langsCard(langs) {
  const W = 800;
  const rows = langs.slice(0, 6);
  const H = 96 + rows.length * 30;
  const total = rows.reduce((s, l) => s + l.bytes, 0) || 1;
  let x = 40;
  const barW = W - 80;
  const segs = rows
    .map((l) => {
      const w = (l.bytes / total) * barW;
      const seg = `<rect x="${x.toFixed(1)}" y="52" width="${w.toFixed(1)}" height="12" fill="${l.color}"/>`;
      x += w;
      return seg;
    })
    .join("");
  const lines = rows
    .map((l, i) => {
      const y = 100 + i * 30;
      const pct = (l.bytes / total) * 100;
      const bw = Math.max(4, (pct / 100) * 360);
      return `
  <g>
    <circle cx="48" cy="${y}" r="5" fill="${l.color}"/>
    <text x="64" y="${y + 4.5}" font-family="${FONT}" font-size="14" font-weight="600" fill="#e6e9f5">${esc(l.name)}</text>
    <rect x="260" y="${y - 4}" width="360" height="8" rx="4" fill="#ffffff" fill-opacity="0.06"/>
    <rect x="260" y="${y - 4}" width="0" height="8" rx="4" fill="${l.color}">
      <animate attributeName="width" from="0" to="${bw.toFixed(1)}" dur="1.2s" begin="${0.3 + i * 0.12}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>
    </rect>
    <text x="${W - 40}" y="${y + 4.5}" text-anchor="end" font-family="${MONO}" font-size="13" fill="#9aa4c7">${pct.toFixed(1)}%</text>
  </g>`;
    })
    .join("");
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1226"/><stop offset="1" stop-color="#12112a"/></linearGradient>
    <clipPath id="bar"><rect x="40" y="52" width="0" height="12" rx="6">
      <animate attributeName="width" from="0" to="${barW}" dur="1.4s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>
    </rect></clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.1"/>
  <text x="40" y="36" font-family="${MONO}" font-size="13" font-weight="700" letter-spacing="2" fill="#b79cff">ЯЗЫКИ</text>
  <g clip-path="url(#bar)">${segs}</g>
  ${lines}
</svg>`;
}

/* ---------- карточки проектов ---------- */
function projectsCard(repos) {
  const cw = 380, gap = 30, H = 150;
  const W = cw * 3 + gap * 2;
  const cards = repos
    .map((r, i) => {
      const x = i * (cw + gap);
      const color = LANG_COLORS[r.language] || "#9aa4c7";
      const days = r.pushed ? Math.max(0, Math.floor((Date.now() - new Date(r.pushed)) / 864e5)) : null;
      const when = days === null ? "" : days === 0 ? "сегодня" : `${days} дн. назад`;
      const name = r.name.length > 20 ? r.name.slice(0, 19) + "…" : r.name;
      return `
  <g transform="translate(${x} 0)">
    <rect x="0.5" y="0.5" width="${cw - 1}" height="${H - 1}" rx="18" fill="url(#cardbg)" stroke="#ffffff" stroke-opacity="0.1"/>
    <rect x="0" y="0" width="${cw}" height="3" fill="url(#shimmer${i})" clip-path="url(#top)"/>
    <g transform="translate(26 30)">
      <path d="M0 4a3 3 0 0 1 3-3h5l2 2.5h8a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3Z" fill="#b79cff" fill-opacity="0.2" stroke="#b79cff" stroke-width="1.6" transform="scale(1.1)"/>
    </g>
    <text x="64" y="50" font-family="${FONT}" font-size="22" font-weight="800" fill="#fff">${esc(name)}</text>
    <text x="64" y="72" font-family="${MONO}" font-size="12" fill="#7f8ab0">${esc(r.owner)}${r.fork ? " · fork" : ""}</text>
    <circle cx="30" cy="110" r="6" fill="${color}"><animate attributeName="r" values="5;7;5" dur="2.6s" begin="${i * 0.5}s" repeatCount="indefinite"/></circle>
    <text x="44" y="115" font-family="${FONT}" font-size="14" font-weight="600" fill="#e6e9f5">${esc(r.language || "—")}</text>
    <text x="170" y="115" font-family="${FONT}" font-size="14" fill="#e6e9f5">★ ${r.stars}</text>
    <text x="228" y="115" font-family="${FONT}" font-size="14" fill="#e6e9f5">⑂ ${r.forks}</text>
    <text x="${cw - 24}" y="115" text-anchor="end" font-family="${MONO}" font-size="11" fill="#7f8ab0">${esc(when)}</text>
  </g>`;
    })
    .join("");
  const shimmers = repos
    .map(
      (_, i) => `
    <linearGradient id="shimmer${i}" gradientUnits="userSpaceOnUse" x1="-200" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#7c5cff" stop-opacity="0"/><stop offset="0.5" stop-color="#5eead4"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/>
      <animate attributeName="x1" values="-200;${cw}" dur="3.6s" begin="${i * 0.6}s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="0;${cw + 200}" dur="3.6s" begin="${i * 0.6}s" repeatCount="indefinite"/>
    </linearGradient>`
    )
    .join("");
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <defs>
    <linearGradient id="cardbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1226"/><stop offset="1" stop-color="#14112b"/></linearGradient>
    <clipPath id="top"><rect width="${cw}" height="${H}" rx="18"/></clipPath>${shimmers}
  </defs>${cards}
</svg>`;
}

/* ---------- бегущая строка ---------- */
function ticker() {
  const words = ["KOTLIN", "TYPESCRIPT", "RUST", "DOCKER", "WASM", "CALL OF DUTY", "NEURAL NETWORKS", "SHIP FAST", "STAY SPOOKY"];
  const item = (w) => `${w}   ✦   `;
  const line = words.map(item).join("");
  const unit = line.length * 13.2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="52" viewBox="0 0 1200 52" fill="none">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.08" stop-color="#fff"/><stop offset="0.92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="m"><rect width="1200" height="52" fill="url(#fade)"/></mask>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8ab4ff"/><stop offset="0.5" stop-color="#b79cff"/><stop offset="1" stop-color="#5eead4"/></linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="1199" height="51" rx="14" fill="#0b0f1e" stroke="#ffffff" stroke-opacity="0.08"/>
  <g mask="url(#m)">
    <g font-family="${MONO}" font-size="20" font-weight="700" letter-spacing="2" fill="url(#t)">
      <animateTransform attributeName="transform" type="translate" from="0 0" to="-${unit.toFixed(0)} 0" dur="38s" repeatCount="indefinite"/>
      <text x="0" y="33" xml:space="preserve">${esc(line)}</text>
      <text x="${unit.toFixed(0)}" y="33" xml:space="preserve">${esc(line)}</text>
      <text x="${(unit * 2).toFixed(0)}" y="33" xml:space="preserve">${esc(line)}</text>
    </g>
  </g>
</svg>`;
}

/* ---------- main ---------- */
await mkdir(OUT, { recursive: true });

const profile = await api(`/users/${USER}`);
const [starred, ownRepos, contrib] = await Promise.all([
  paginate(`/users/${USER}/starred`).catch(() => []),
  paginate(`/users/${USER}/repos?type=owner`).catch(() => []),
  contributions(),
]);

await write("badge-followers.svg", badge({ label: "Followers", value: profile.followers, color: "#7c5cff", icon: "👥" }));
await write("badge-repos.svg", badge({ label: "Repos", value: profile.public_repos, color: "#22d3ee", icon: "📦" }));
await write("badge-starred.svg", badge({ label: "Starred", value: starred.length, color: "#f472b6", icon: "⭐" }));

const earned = ownRepos.reduce((s, r) => s + r.stargazers_count, 0);
await write(
  "stats.svg",
  statsCard([
    { label: "Followers", value: profile.followers, target: 50, color: "#7c5cff" },
    { label: "Repos", value: profile.public_repos, target: 20, color: "#22d3ee" },
    { label: "Starred", value: starred.length, target: 50, color: "#f472b6" },
    { label: "Stars earned", value: earned, target: 25, color: "#fbbf24" },
    { label: "Contributions", value: contrib ?? 0, target: 1000, color: "#5eead4" },
  ])
);

const showcase = [];
for (const full of SHOWCASE) {
  try {
    const r = await api(`/repos/${full}`);
    showcase.push({
      name: r.name, owner: r.owner.login, fork: r.fork, language: r.language,
      stars: r.stargazers_count, forks: r.forks_count, pushed: r.pushed_at, full,
    });
  } catch (e) {
    console.warn("showcase repo skipped:", full, e.message);
    showcase.push({ name: full.split("/")[1], owner: full.split("/")[0], fork: false, language: null, stars: 0, forks: 0, pushed: null, full });
  }
}
await write("projects.svg", projectsCard(showcase));

const bytes = {};
const seen = new Set();
for (const full of [...SHOWCASE, ...ownRepos.map((r) => r.full_name)]) {
  if (seen.has(full)) continue;
  seen.add(full);
  try {
    const l = await api(`/repos/${full}/languages`);
    for (const [name, b] of Object.entries(l)) bytes[name] = (bytes[name] || 0) + b;
  } catch (e) {
    console.warn("languages skipped:", full, e.message);
  }
}
const langs = Object.entries(bytes)
  .sort((a, b) => b[1] - a[1])
  .map(([name, b]) => ({ name, bytes: b, color: LANG_COLORS[name] || "#9aa4c7" }));
if (langs.length) await write("langs.svg", langsCard(langs));

await write("ticker.svg", ticker());
console.log({ followers: profile.followers, repos: profile.public_repos, starred: starred.length, earned, contrib, langs: langs.length });
