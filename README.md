# Agnos — real-time patient form

A patient form that the front desk can watch being filled in, keystroke by keystroke.

Two screens over one shared session:

| Screen | Route | Shown as | Who it is for |
| --- | --- | --- | --- |
| Patient form | `/form/[sessionId]` | *Agnos · form* → "Before we see you" | A patient to fill |
| Intake Form Console | `/staff`, `/staff/[sessionId]` | *Agnos · staff console* | Clinic staff at a desk or tablet |

Every keystroke on the patient form appears in the console with no refresh, and each session is
labelled **actively filling**, **paused**, **inactive** or **submitted**.

Each session has a **Form ID** — a code like `ABCD-2345`. It is in the URL, shown to the patient
under the form, given back on the confirmation screen, and used by staff to identify the session.

## Try it in 30 seconds

1. Open `/` and click **Open the staff console**.
2. In a second window, open `/` again and click **Start a patient form**.
3. Type. The console updates as you type, shows which field the cursor is in, and moves the
   progress bar. Submit, and the pill turns green.

## Local setup

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. Use two browser windows side by side — or a phone on the same
network — to see both sides at once.

Other scripts:

```bash
npm test        # Vitest: schema, presence machine, session store
npm run build   # Production build
npm start       # Production server (Next.js + Socket.IO in one process)
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. Set automatically by most hosts. |
| `HOST` | `0.0.0.0` | Bind address. |
| `NEXT_PUBLIC_SOCKET_PATH` | `/api/socket` | Where Socket.IO is mounted. Client and server read the same value. |

None are required for local development.

## Architecture

```
Patient (phone)                                  Staff (desktop)
/form/[sessionId]                                /staff
      │  form:update (coalesced, 250ms)                ▲
      │  form:focus  (immediate)                       │ session:patch
      │  form:submit                                   │ session:status
      │  connect / disconnect                          │ session:list
      │                                        staff:delete │
      ▼                                                │
┌──────────────────────────────────────────────────────┴────┐
│         One Node process — Next.js handler + Socket.IO     │
│  rooms:  session:<id>  ·  staff:lobby                      │
│  store:  Map<sessionId, SessionState> + 30min TTL sweep    │
└────────────────────────────────────────────────────────────┘
```

The server is a relay with just enough authority to be trustworthy: it stamps `lastActivityAt`,
derives status, re-validates submissions against the same Zod schema the client uses, and is the
only thing that decides a session has gone inactive.

Full design rationale is in [docs/specification.md](docs/specification.md).

### The real-time flow in five sentences

1. The patient's browser joins the room `session:<id>` and the staff console joins `staff:lobby`.
2. Typing queues a per-field patch that is flushed at most every 250 ms, so a burst of keystrokes
   becomes one small message containing only the fields that changed.
3. Focus and blur are sent immediately and undebounced, because the caret marker in the console
   should feel instant.
4. The server shallow-merges each patch, re-derives the session's status, and broadcasts it to
   every staff client.
5. A 5-second sweep re-derives status for all sessions and emits only the ones that changed, so an
   idle dashboard stays quiet; sessions untouched for 30 minutes are dropped.

### Status state machine

Derived on the server by one pure function (`src/lib/presence.ts`), unit-tested, so the list and
the detail pane can never disagree.

```
                    any typing or field change
       ┌────────────────────────────────────────┐
       ▼                                        │
  ┌─────────┐   no input for 15s   ┌────────┐   │
  │ filling │ ───────────────────► │ paused │ ──┘
  └────┬────┘                      └───┬────┘
       │ form:submit                   │
       │                    tab closed │ tab closed
       ▼                               ▼
  ┌───────────┐                  ┌──────────┐
  │ submitted │                  │ inactive │ ── staff can delete
  └───────────┘                  └──────────┘
     terminal
```

The three live states answer three different questions:

| State | Meaning |
| --- | --- |
| **Actively filling** | Typing right now — something changed in the last 15 seconds. |
| **Paused** | The form is still open on their device, but nothing has been entered for 15 seconds. |
| **Inactive** | The tab is gone and the form was never submitted. |

Paused is measured from real input only — typing, changing a field, moving between fields. There is
no heartbeat inflating it, so a form sitting open and untouched reads as paused, not as filling.
Inactive comes from the socket disconnecting, so it means exactly "they closed it", not "they went
quiet". Submitted is terminal and survives the tab closing.

Staff can delete an **inactive** session from either the list or the detail pane, behind a
two-step confirm. The server refuses to delete anything else — a live, paused or submitted session
is never removable, whatever the client asks for.

## Project structure

```
server.ts                     Custom server: Next.js handler + Socket.IO + /healthz
src/lib/fields.ts             Field registry — the spine both views render from
src/lib/countries.ts          Generated: 245 countries, dial codes, demonyms, flags
src/lib/schema.ts             Zod schema, shared by the client and the server
src/lib/presence.ts           Status derivation and sort order (pure, tested)
src/lib/realtime/events.ts    Typed event contract shared by client and server
src/lib/realtime/store.ts     SessionStore interface + in-memory implementation
src/lib/realtime/server.ts    Socket handlers and the inactivity sweep
src/hooks/                    usePatientSession, useStaffSessions
src/components/form/          Patient form: field primitives, sections, progress
src/components/staff/         Console: list, detail, status pill, live field caret
tests/                        Vitest: schema rules, presence machine, session store
```

Adding a field is one entry in `src/lib/fields.ts` plus one line in the Zod schema — the form, the
progress meter and the staff detail pane all pick it up.

`src/lib/countries.ts` is generated, not hand-maintained:

```bash
npm run gen:countries
```

It is committed rather than built at runtime so the server and the browser always render an
identical `<option>` list — deriving names from `Intl` at render time risks a hydration mismatch
when Node's ICU data and the browser's disagree.

## Phone numbers and nationality

The phone field is a country picker plus a number, and validity is judged by that country's own
numbering plan via `libphonenumber-js` — not by a generic digit count. `081 234 5678` is a valid
Thai mobile and an invalid Singapore number, and the form says so:

| Country | `081 234 5678` | Message |
| --- | --- | --- |
| Thailand | valid | — |
| United States | invalid | "Please enter a valid United States phone number" |
| Singapore | invalid | "Please enter a valid Singapore phone number" |

The picker is a searchable combobox rather than a native select: type a country name, an ISO code,
or the dialling code itself. Typing `44` offers the United Kingdom before Jersey, because the
generated data marks the main country for each shared code. Thailand leads both country lists and
is the default.

Both number fields accept digits only — the dialling prefix comes from the picker, so letters and
punctuation are stripped as they are typed or pasted. Both the patient's number and the emergency
contact's number have their own picker, so a Thai patient can list a relative abroad. Changing a country re-judges a number already typed. The staff
console shows numbers in international form (`+44 7400 123456`), so the front desk can dial without
guessing the prefix.

The emergency contact **number** is required — it is the part that is actually useful in a crisis.
The contact's name and relationship are optional and independent of each other.

Nationality covers all 245 countries and territories, labelled by demonym where one is in common
use ("Thai", "British", "Ivorian") and by country name where one is not ("Gibraltar", "Guadeloupe").
Both lists come from the same generated file, so a country can never appear in one and not the other.

## Validation and progress

Ten of the fourteen questions are required. The progress meter counts a field only when it is both
filled in **and** valid, so a malformed email or a number that is wrong for its country does not
advance the bar — it can never reach full while submit would still refuse.

Errors surface on blur, then update live once a field has been visited; a field the patient has not
reached yet never shows red. Clearing a field they have just edited validates immediately, and a
field already showing an error clears it the moment it is fixed rather than waiting for the next
blur.

Cross-field rules (the phone/country pairing, for instance) run on every keystroke rather than only
at submit. Zod skips object-level refinements while any base field is still empty — which on a
half-filled form is always — so those rules are also applied by a small resolver wrapper in
`PatientForm`, and the schema still enforces them server-side on submit.

## Sessions and refreshing

Reloading the patient form starts a **new** session: the page redirects to a fresh Form ID, the
abandoned draft is cleared, and the old session appears on the staff console as inactive, ready to
be deleted. Returning to a session URL without reloading still restores its draft, and any restored
value that is invalid shows its error straight away — a field left empty stays quiet until it is
edited.

## Design notes

**Paper for the patient, console for staff.** A patient fills this in once, nervously, on a phone;
staff keep it open all shift on a bright screen. The patient surface is near-white and quiet with
large tap targets. The staff surface is a dark console where colour is reserved almost entirely for
status, so a glance across the room reads as "two amber, one green."

**The signature element is the live field caret.** When the patient's cursor is in "Phone number",
that row in the console shows a soft pulsing marker. It answers "is this person actually filling
the form in" with the thing itself rather than a badge that claims it.

**Accessibility:** every input has a real `<label>`; errors are linked with `aria-describedby` and
announced with `role="alert"`; status changes go through an `aria-live` region; focus rings are
visible throughout; `prefers-reduced-motion` disables the caret pulse and the row-change flash.

## Bonus features implemented

- **Draft persistence** — form state is mirrored to `localStorage`, so a dropped connection does
  not lose the patient's work. A deliberate refresh starts a fresh session instead, as described
  under **Sessions and refreshing** above.
- **Reconnection repair** — on reconnect the client re-joins and re-sends its full current state,
  so the server's copy is repaired rather than left stale.
- **Copyable form link** — the console's empty state ("No patients are filling in a form right
  now") generates a fresh form link for handing to a patient.
- **Age hint** on date of birth, and human-readable values (option labels, formatted dates) in the
  console rather than raw stored values.

Not shipped: QR handoff, per-field "last changed" timestamps, a Thai/English UI toggle.

## Deployment

Target: **Render** (Web Service, free tier) — a Node process with real WebSocket support.

```
Build:  npm ci && npm run build
Start:  npm start
Env:    PORT is provided by the host
Health: GET /healthz → 200
```

Railway, Fly and Heroku work identically — anything that runs a long-lived Node process and calls
`npm start`.

Free-tier services sleep when idle, so the first request after a quiet period can take a few
seconds to wake.

### Why not a serverless host

Vercel [does support WebSockets](https://vercel.com/docs/functions/websockets), so the transport is
not the obstacle. The obstacle is state. Vercel's own documentation is explicit:

> New WebSocket connections are not guaranteed to reach the same Vercel Function instance… Store
> durable state, presence, counters, rooms, and pub/sub coordination in an external data store
> instead of relying on in-memory variables.

The patient's socket and the staff console's socket are two separate connections, so they can land
on different instances. `Map<sessionId, SessionState>` lives in one instance's memory and a room
broadcast only reaches sockets on that same instance — the patient types and the console never
hears it. Netlify Functions have the same constraint.

Running here would mean a Redis-backed store plus Redis pub/sub, and moving the socket handler out
of `server.ts` into a route handler (Next.js has no upgrade API of its own; Vercel's path is
`experimental_upgradeWebSocket`, which yields a raw `ws` socket rather than a Socket.IO server).
The store already sits behind the `SessionStore` interface, so that part is one new file — but it
is real work, not a config flag.

## Known limitations

Deliberate scope choices, stated plainly.

- **In-memory store.** Sessions are lost on restart and do not survive horizontal scaling.
  Production would move the map to Redis with the Socket.IO Redis adapter — the store already sits
  behind the `SessionStore` interface, so that is a single-file change.
- **Requires a long-lived Node process.** The realtime layer needs a host that runs `server.ts`.
  Serverless platforms give each invocation its own memory, so the patient's connection and the
  console's connection can land on different instances and never see each other — see
  [Why not a serverless host](#why-not-a-serverless-host).
- **No authentication.** Anyone with the URL can open the staff console. A real deployment needs
  staff auth and per-clinic scoping.
- **No PHI handling.** This holds real personal health data in production, which requires consent
  capture, an audit trail, encryption at rest and a compliance review well beyond this assignment.
- **No i18n framework.** The interface copy is English-only; the field content supports Thai.
- **One writer per session.** Patches are shallow-merged in arrival order with no conflict
  resolution, which is correct while exactly one patient owns a session.
