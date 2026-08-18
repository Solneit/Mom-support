# Mom Support — Início → Resultados (v0.1 code prototype)

A coded alternative to the Softr prototype, wired directly to your real Airtable base
(`appenkUjX71btkhcc`). Same deploy pattern as Volta: static site + Netlify Functions,
pushed to GitHub, deployed on Netlify.

## What's built

- **`public/index.html`** — Screen 1, Início (search form: location, age, date)
- **`public/resultados.html`** — Screen 3, live results pulled from `SERVICES`
- **`public/instituicao.html`** — Screen 4, institution detail
- **`public/plano.html`** — Screen 5, O meu plano — countdown, progress counts,
  next action, and application list, merged live from `PARENTS` + `APPLICATIONS`
- **`public/confirmar.html`** — Screen 6, the no-login creche self-confirmation
  flow ("leva menos de 20 segundos")
- **`netlify/functions/services.js`** — proxy + filter for `SERVICES` (read-only)
- **`netlify/functions/plan.js`** — merges one parent's `PARENTS` + `APPLICATIONS`
  records into the plan view (read-only)
- **`netlify/functions/confirm.js`** — reads a single institution's services and
  writes status updates back to `SERVICES` (read **and** write — see token note below)
- **`public/partilhar.html`** + **`netlify/functions/reviews.js`** — "Partilhar
  atualização", the crowd-sourced update form, reading/writing `AVALIAÇÕES`
- **`public/styles.css`** — the one shared stylesheet every page now links to
  (colours, type, buttons, status pills, cards, forms). Change the design once,
  it updates everywhere — no page has its own copy of the design system anymore.

Not built yet: **Screen 3B (Mapa)**. Everything else from the 6-screen spec now
has working code behind it, using your real field names, and every page shares
one look.

## Quick local preview (no Netlify, no Airtable needed)

`preview_server.py` is a tiny mock server with two real records baked in —
useful for checking layout/styling changes instantly without touching
Netlify or your Airtable token:

```bash
cd momsupport
python3 preview_server.py
# open http://localhost:8765/index.html
```

It only fakes `services` and `reviews` (GET). `plan.js` and `confirm.js`
aren't mocked, so `plano.html` and `confirmar.html` will show their real
error state until you deploy for real — that's expected, not a bug.

## 1. Get TWO scoped Airtable tokens

You need two, because `confirmar.html` (Screen 6) is a public, no-login link
— a creche can open it and write data. Keep that write power on a separate,
narrowly-scoped token so it isn't sitting on the same credential as your
read-only browsing.

**Token A — read-only** (`AIRTABLE_TOKEN`)
1. [airtable.com/create/tokens](https://airtable.com/create/tokens) → **Create new token**
2. Scope: `data.records:read`
3. Access: **Add a base** → your Mom Support base only
4. Used by: `services.js`, `plan.js`, and the read half of `confirm.js`

**Token B — write, Services table only** (`AIRTABLE_TOKEN_WRITE`)
1. Create a second token
2. Scopes: `data.records:read` + `data.records:write`
3. Access: if Airtable's UI lets you scope to a single table, restrict to
   `SERVICES` only — a compromised link should never be able to touch
   `PARENTS` or `APPLICATIONS`
4. Used by: the write half of `confirm.js` only

Copy both — Airtable only shows each token once.

## 2. Confirm your exact table names

The functions read tables literally named `SERVICES`, `PARENTS`, and
`APPLICATIONS` (see the `*_TABLE` constants at the top of each file in
`netlify/functions/`). If any of yours differ — capitalisation, Portuguese
names, etc. — update that one constant to match exactly. Table names in the
Airtable API are case-sensitive.

## 3. Deploy on Netlify

```bash
# from this folder
git init
git add .
git commit -m "Mom Support v0.1 prototype"
gh repo create mom-support-prototype --private --source=. --push
# or push to an existing GitHub repo the same way you did for Volta
```

Then in Netlify:
1. **Add new site → Import an existing project** → pick the repo
2. Build settings are already read from `netlify.toml` — no changes needed
3. **Site settings → Environment variables → Add variable**, twice:
   - `AIRTABLE_TOKEN` → Token A (read-only)
   - `AIRTABLE_TOKEN_WRITE` → Token B (write, Services only)
4. Deploy

## 4. Test locally before deploying (optional)

```bash
npm install -g netlify-cli
netlify dev
```

This runs the functions locally with the same env var. Create a `.env` file
(never commit it) with:

```
AIRTABLE_TOKEN=your_token_here
```

## Notes on the data mapping

- `resultados.html` filters client-side (age range, address text match) since
  the base is tiny right now. Once you have more than ~100 institutions,
  switch to Airtable's `filterByFormula` query param inside
  `services.js` instead, so filtering happens on Airtable's side.
- Status badges never invent precision: if `Estado das vagas` is `Unknown` or
  blank, the UI shows "🟡 Vagas a confirmar" rather than guessing — same rule
  as your original spec (Screen 3 notes).
- `instituicao.html` fetches the full list and finds the record by id
  client-side. Fine for a handful of institutions; worth a dedicated
  single-record function later if the base grows.

## How to test Screen 5 (O meu plano)

Open `plano.html?parentName=Test Parent` — that's the only parent in the
base right now. Once you have real parent accounts, this becomes
`plano.html?parentId=...` behind actual login instead of a name match.

## How to test Screen 6 (Confirmar vagas)

Open `confirmar.html?institution=Mini Milkies` — this is the exact link
format you'd send a creche by WhatsApp or email. It:
1. Loads that institution's services from `SERVICES`
2. Lets them tap **✓ Sim** (no write) or **Alterar** → pick a real status → **Guardar** (writes `Estado das vagas` + today's date to `Última verificação do serviço`)
3. Enables **Confirmar tudo** once every service on the page has been
   answered one way or the other

## What to fill in on Airtable, per table

This is the practical question: which fields actually feed the UI, so you know
what's worth spending time filling in first. Nothing below is required for the
app to *run* — empty fields just show as "A confirmar" / "—" — but this is
what upgrades the screens from placeholder to real.

**`Institution`** — used for contact/identity, not filtering (that's Services)
| Field | Where it shows up |
|---|---|
| `Name` | Card title, detail header, avatar initials |
| `Municipality` | Not yet surfaced directly — worth adding to `SERVICES` too if you want location filtering to actually work (see note below) |
| `Phone`, `Email`, `Website` | Detail page contact row + "Verificar vaga" button link |
| `Creche Feliz` | Not wired into the UI yet — easy add to the card tags once you confirm the values you use (`Yes`/`Unknown`/etc.) |
| `Last Verified` | Feeds the "freshness" note if you switch a screen to read from Institution instead of Services |

**`SERVICES`** — this is the one that matters most; almost everything on
Resultados and Instituição comes from here
| Field | Where it shows up |
|---|---|
| `Nome do serviço` | — |
| `Instituição` | Card name, avatar initials, groups services by creche |
| `Tipo de serviço` | Tag pill, avatar colour (Creche/CATL/Pré-escolar) |
| `Age Min` / `Age Max` | Powers the age filter — **fill these in for every service**, this is the one field the search on Início can't work without |
| `Faixa etária` | Human-readable age label shown on cards |
| `Estado das vagas` | The status pill colour everywhere — this is the single highest-value field to keep current |
| `Horário`, `Preço / mês` | Card meta row |
| `Última verificação do serviço` | "Verificado em…" freshness line |
| `Telefone/Email/Website/Morada da instituição` | These are lookups from Institution — if they're blank on Services, check the lookup is actually configured, not just that Institution has the data |

**`PARENTS`** — only used by `plano.html`, only for the one test parent right now
| Field | Where it shows up |
|---|---|
| `Parent Name` | Matches the `?parentName=` URL param |
| `Childcare Needed From` | The countdown card at the top of O meu plano |
| `Childcare Confirmed` | Fetched but not yet shown — easy add if useful |

**`APPLICATIONS`** — drives the progress counts and next-action card
| Field | Where it shows up |
|---|---|
| `Parent`, `Service` | Links the row to the right parent + shows the service name in the list |
| `Status` | Status pill (Confirmada / Lista de espera / Visita marcada / Sem resposta) |
| `Next Follow-Up`, `Next Action` | The "Próxima ação" card — **this is the field worth keeping current**, it's the whole point of the screen |
| `Visit Date` | Counts toward the "visitas" progress number |
| `Waiting List Position` | Shows under the application row when present |

**`AVALIAÇÕES`** — powers the ratings strip on Instituição + the share-update form
| Field | Where it shows up |
|---|---|
| `Serviço` | Which institution's ratings strip the review counts toward |
| `Avaliação geral`, `Comunicação`, `Processo de candidatura` | The three averages in the ratings strip |
| `Estado das vagas comunicado`, `Data do contacto`, `Método de contacto`, `Conseguiu vaga?`, `Comentário` | Written by the public form — nothing to pre-fill, this table grows from real submissions |
| `Estado da moderação` | New submissions are written as `Pendente` — **you need to manually flip this to something other than `Rejeitada`** for a review to count toward the public average (see `reviews.js`, line ~57) |

**Fastest way to make the demo feel real:** fill in `Age Min`/`Age Max` and
`Estado das vagas` for every row in `SERVICES` first — those two fields alone
drive the search, the cards, and the status pills across three screens.

## A note on location filtering

Right now `municipality` filtering in `services.js` does a loose text match
against the looked-up address field, since `SERVICES` has no direct
`Municipality` field of its own (only `Institution` does). This works fine
while everything is in Montijo, but once you add creches in Setúbal or
Almada, add a `Municipality` lookup field on `SERVICES` (same pattern as
the phone/email lookups) so filtering doesn't depend on parsing street
addresses as text.

## Not built yet

- **Screen 3B — Mapa.** The data has no coordinates yet (only street
  addresses), so this needs either a geocoding step (address → lat/lng,
  one-time batch job) or manually adding `Latitude`/`Longitude` fields to
  `Institution`. Worth doing before Mapa, not as part of it.
- **Screen 6 follow-up automation** — e.g. auto-sending the `confirmar.html`
  link by WhatsApp/email on a schedule. That's a small automation (Airtable
  Automation or a scheduled Netlify Function), not a UI screen, and depends
  on which channel (WhatsApp Business API vs. plain email) you want first.
