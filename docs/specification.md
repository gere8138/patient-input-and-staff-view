# Development Planning Documentation

**Project:** Agnos — real-time patient intake form with a live staff console
**Stack:** Next.js 15 (App Router) · TypeScript · TailwindCSS v4 · Socket.IO · Zod · React Hook Form

Two interfaces share one session. A patient fills in a form on their phone; the
front desk watches it happen, field by field, without refreshing. This document
covers the four things a reader needs to work on the codebase: how the files are
organised, why the interface behaves as it does on each device, what each
component is for, and how the realtime layer stays in sync.

---

## 1. Project structure

```
agnos/
├── server.ts                        Custom Node server: Next.js handler + Socket.IO + /healthz
├── render.yaml                      Deployment blueprint (build, start, health check)
├── scripts/
│   └── gen-countries.mjs            Generates src/lib/countries.ts from libphonenumber metadata
│
├── src/
│   ├── app/                         Routes only — no logic lives here
│   │   ├── layout.tsx               Fonts, theme tokens, <html lang>
│   │   ├── globals.css              Tailwind v4 @theme design tokens, keyframes, resets
│   │   ├── page.tsx                 Landing: start an intake / open the console
│   │   ├── not-found.tsx            Invalid session link
│   │   ├── form/[sessionId]/        Patient form (validates the id, then renders)
│   │   └── staff/[sessionId]/       Staff console, deep-linked to one session
│   │       └── ../staff/page.tsx    Staff console, no selection
│   │
│   ├── components/
│   │   ├── form/                    Patient surface: field primitives + form shell
│   │   ├── staff/                   Console surface: list, detail, status, delete
│   │   └── ui/Field.tsx             Shared label/help/error shell + control classes
│   │
│   ├── hooks/
│   │   ├── usePatientSession.ts     Patient side: coalesced emits, focus, submit
│   │   └── useStaffSessions.ts      Staff side: subscribe to every session
│   │
│   └── lib/
│       ├── fields.ts                Field registry — the spine of the app
│       ├── schema.ts                Zod schema + cross-field rules + phone helpers
│       ├── presence.ts              Status derivation and sort order (pure)
│       ├── countries.ts             Generated: 245 countries, dial codes, demonyms
│       └── realtime/
│           ├── events.ts            Typed event contract, shared client + server
│           ├── client.ts            Browser socket singleton
│           ├── server.ts            Socket handlers + inactivity sweep
│           └── store.ts             SessionStore interface + in-memory implementation
│
└── tests/                           Vitest: schema, presence, store
```

### The organising principle

**`src/lib/fields.ts` is the spine.** It is a single array describing every
question: key, label, section, control type, whether it is required, and how wide
it sits. The patient form renders from it, the staff detail pane renders from it,
the progress meter counts from it, and the socket server uses it to reject unknown
keys. Adding a question is one entry in that array plus one line in the Zod
schema — not four edits across two screens that can drift apart.

**Pure logic is separated from React.** `presence.ts`, `schema.ts` and `store.ts`
have no React or socket imports, which is why they carry the test suite. A silent
bug in validation or in the status machine would be invisible in a demo, so those
are the two places worth testing hardest.

**The transport is isolated behind `lib/realtime/`.** Components never import
`socket.io-client`. They talk to the two hooks; the hooks talk to the realtime
module. Swapping the transport touches that folder and nothing else.

**`countries.ts` is generated, not hand-maintained.** It is committed rather than
built at runtime so the server and the browser always render an identical
`<option>` list — deriving country names from `Intl` at render time risks a
hydration mismatch when Node's ICU data and the browser's disagree.

**Routes are thin.** Everything under `src/app/` validates params and renders a
component. No data logic lives in a route file.

---

## 2. Design

### Two surfaces, one product

The two audiences use this in opposite conditions. A patient fills it in once,
nervously, on a phone they are holding. Staff keep it open all shift on a bright
desk monitor. Giving both the same skin would serve neither.

| | Patient | Staff |
| --- | --- | --- |
| Ground | Near-white paper (`--color-paper`) | Dark console (`--color-console`) |
| Colour | Reserved for focus and errors | Reserved almost entirely for status |
| Density | Generous, one thing at a time | Compact, many patients at a glance |
| Type | Sans throughout | Mono for ids, values, timestamps |

Colour on the console is deliberately scarce so a glance across the room reads as
"two amber, one green" without anyone parsing text.

### Breakpoints

Only three, because only three real changes are needed.

| Width | Patient form | Staff console |
| --- | --- | --- |
| **< 640px** | Single column. Sticky progress + submit bar pinned to the bottom edge. | List only. Tapping a row opens the detail full-screen with a back button. |
| **≥ 640px** (`sm`) | Half-width fields pair up two per row; full-width fields span both. | Wider padding, same list. |
| **≥ 1024px** (`lg`) | Content capped at 720px and centred. The progress bar becomes a floating rounded card, still sticky, lifted off the bottom edge. | Split view: a 320px list rail beside the detail pane. |
| **≥ 1440px** | Unchanged. | Detail pane lays its four sections out in two columns. |

### Mobile-specific decisions

- **Inputs are at least 16px.** Anything smaller makes iOS Safari zoom the page
  on focus, which throws the layout and is disorienting mid-form.
- **44px minimum tap targets** on every control, including radio rows.
- **The submit bar is sticky, not parked at the bottom of a long form.** The
  patient always knows how much is left and can submit the moment it is valid.
- **The country picker's popover** is capped at `min(20rem, 100vw - 2rem)` so it
  never overflows a 375px screen, and its trigger stays a fixed 108px so the
  number field beside it keeps a usable width.

### Desktop-specific decisions

- **The console auto-selects the first session on desktop only**, gated behind a
  `matchMedia('(min-width: 1024px)')` check. On desktop an empty detail pane is
  wasted space; on mobile auto-selecting would hide the list the moment the page
  loaded.
- **The list rail and detail pane scroll independently**, so watching one patient
  does not lose your place in the queue.

### Layout stability

Two rules exist because both were visible bugs before they were rules.

1. **Every field reserves one line beneath its control** for a hint or an error,
   whether or not it has one. Without this, an error appearing or the date-of-birth
   age hint resolving would shove every field below it down the page.
2. **Help text sits below the control, never above.** Otherwise a field with a
   hint pushes its input down relative to the field beside it, and paired fields
   stop lining up. This is what keeps *Preferred language* and *Nationality*
   level despite only one carrying a hint.

The same thinking applies to the console: the delete button on an inactive
session gets its own footer row rather than floating over the card, so it can
never overlap the progress bar, and the row keeps identical height whether the
button is idle or showing its confirm step.

### Feedback and error timing

- Errors appear **on blur**, then update live once the patient has visited the
  field. A field they have not reached yet never shows red.
- Clearing a field they have just edited validates **immediately** — deleting
  something is a deliberate act worth answering at once.
- A field already showing an error revalidates **as they type**, so the message
  disappears the moment it is fixed rather than lingering until the next blur.
- On returning to a saved session, restored values that are invalid say so
  straight away; fields left empty stay quiet.

### Accessibility

Every input has a real `<label>`. Errors are linked with `aria-describedby` and
announced via `role="alert"`. Radio groups use `fieldset`/`legend`. Status changes
on the console go through an `aria-live` region. Focus rings are visible
throughout, and tinted per surface — accent on paper, signal amber on the console.
`prefers-reduced-motion` disables the caret pulse and the row-change flash.

---

## 3. Component architecture

### Patient surface

| Component | Purpose |
| --- | --- |
| `PatientForm` | Owns the React Hook Form instance and the socket session for one form. Holds the custom resolver, the draft restore, the field dispatcher and the submit handler. Everything else on this side is presentational. |
| `FormSection` | Groups fields under a numbered heading — About you → How we reach you → Background → Emergency contact. Chunking reduces the perceived length of a 14-field form on a phone. |
| `ui/Field.tsx` | `FieldShell`: the label, the reserved message line, and the shared control classes. Every primitive wraps itself in this, which is what makes the fields dimensionally identical. |
| `TextField` / `DateField` / `TextAreaField` / `SelectField` / `RadioGroup` | Field primitives, one per control type. `DateField` also derives the age hint from the entered date. |
| `PhoneField` | A country picker and a number input sharing one bordered box so the pair reads as a single control, with the focus ring on the container. Used for both the patient's number and the emergency contact's. |
| `CountryCombobox` | Searchable picker over all 245 countries — by name, ISO code or dialling code. A native `<select>` cannot be typed into freely, and 245 options need search. Keyboard-navigable, with the main country ranked first on a shared dialling code so "44" offers the UK before Jersey. |
| `ProgressMeter` | Sticky footer: "N of 10 required fields complete", the bar, and the submit button. |
| `ConnectionBadge` | Renders nothing while healthy. Surfaces a fixed banner only after a drop persists, so a momentary hiccup does not flash a warning. |
| `SubmittedScreen` | Replaces the form on success and shows the Form ID. |

### Staff surface

| Component | Purpose |
| --- | --- |
| `StaffDashboard` | Subscribes to every session, owns the selection, and decides list-only versus split by viewport. Keeps the URL shareable via `history.replaceState` rather than a route change, which would tear down the socket view. |
| `SessionList` | One row per patient: name so far (or "Unnamed patient"), status pill, progress, and either the field being typed in or the time since last activity. Sorted filling → paused → submitted → inactive. |
| `SessionDetail` | Every field of one session, live. Missing values render as a muted dash rather than a blank so the layout never jumps. |
| `FieldRow` | Label and value. Briefly flashes when its value changes, and shows the caret marker when the patient's cursor is in that field. |
| `StatusPill` | The status indicator. One component, four states, used in both the list and the detail header. |
| `DeleteSessionButton` | Two-step confirm for clearing an abandoned session. Deliberately not a modal — the action is small — and deliberately not one click, because it is irreversible. |
| `EmptyState` | Shown when nothing is live. Generates a copyable intake link, which is how a session actually starts in a clinic. |

### The signature element

When the patient's cursor is in *Phone number*, that row in the console shows a
soft pulsing caret. It answers "is this person actually filling the form in" with
the thing itself rather than a badge claiming it. Everything else on the console
is deliberately flat so this reads.

### Hooks and lib

| Module | Purpose |
| --- | --- |
| `usePatientSession` | Joins the session, coalesces field changes, sends focus immediately, submits, and repairs server state on reconnect. |
| `useStaffSessions` | Joins the lobby, maintains the session map from patches and status events, and exposes the delete action. Ticks once a second so relative times and sort order stay current without server chatter. |
| `lib/fields.ts` | The field registry, the option lists, and the completed-field counter. |
| `lib/schema.ts` | The Zod schema, the cross-field rules, and the phone helpers (per-country validation, formatting, digit stripping). |
| `lib/presence.ts` | Status derivation, sort order, relative time. Pure and tested. |
| `lib/realtime/store.ts` | The `SessionStore` interface and its in-memory implementation. The interface exists so the store can move to Redis without touching anything else. |

---

## 4. Real-time synchronization flow

### Topology

```
Patient (phone)                                    Staff (desktop)
/form/[sessionId]                                  /staff
      │  session:join                                    ▲
      │  form:update  (coalesced, 250ms)                 │  session:list
      │  form:focus   (immediate)                        │  session:patch
      │  form:submit                                     │  session:status
      │  (disconnect on tab close)                       │  session:removed
      ▼                                    staff:delete  │
┌──────────────────────────────────────────────────────┴─────┐
│          One Node process — Next.js handler + Socket.IO      │
│  rooms:  session:<id>   patient + any staff watching it      │
│          staff:lobby    every console, receives every patch  │
│  store:  Map<sessionId, SessionState>                        │
│          Map<sessionId, Set<socketId>>  which tabs are open  │
│  sweep:  every 5s — re-derive status, expire after 30min     │
└──────────────────────────────────────────────────────────────┘
```

The server is a relay with just enough authority to be trustworthy: it stamps
`lastActivityAt`, derives status, sanitises incoming patches against the field
registry, re-validates submissions, and is the only thing that decides a session
has gone inactive. It never trusts a client clock.

### Event contract

**Client → server**

| Event | Payload | Notes |
| --- | --- | --- |
| `session:join` | `{ sessionId }` | Creates the session if new, joins its room, and registers this tab as holding the form open. |
| `form:update` | `{ sessionId, patch, activeField }` | Only the changed keys, never the whole form. |
| `form:focus` | `{ sessionId, field }` | Immediate, undebounced — drives the caret. |
| `form:submit` | `{ sessionId, data }` → ack | Server re-validates before accepting. |
| `staff:join` | `{}` → ack | Joins `staff:lobby`, receives the full list. |
| `staff:watch` | `{ sessionId }` | Joins one session's room for deep links. |
| `staff:delete` | `{ sessionId }` → ack | Refused unless the session is inactive. |

**Server → client**

| Event | Payload | Notes |
| --- | --- | --- |
| `session:list` | `SessionState[]` | Once, on staff connect. |
| `session:patch` | `{ sessionId, patch, activeField, completedFields, status, … }` | On every change. |
| `session:status` | `{ sessionId, status, lastActivityAt, connected }` | From the sweep and on disconnect, when nothing else changed. |
| `session:removed` | `{ sessionId }` | After TTL expiry or a staff delete. |

### Why 250ms

Sending every keystroke as its own packet is wasteful and, on a slow connection,
arrives out of order. Changes accumulate into a pending patch that flushes at most
every 250ms — a trailing throttle, not a debounce, so continuous typing still
streams rather than waiting for a pause. 250ms is below the threshold at which a
watching human perceives lag, and it collapses a burst of typing into one message.

`form:focus` is exempt. The caret marker has to feel instant.

### Status derivation

One pure function, `deriveStatus`, is the only thing that decides status. Both the
sweep and every inbound event go through it, so the list and the detail pane can
never disagree.

```
                      any typing or field change
        ┌────────────────────────────────────────────┐
        ▼                                            │
   ┌─────────┐    no input for 15s     ┌────────┐    │
   │ filling │ ─────────────────────►  │ paused │ ───┘
   └────┬────┘                         └───┬────┘
        │ form:submit          tab closed  │  tab closed
        ▼                                  ▼
   ┌───────────┐                    ┌──────────┐
   │ submitted │                    │ inactive │  staff may delete
   └───────────┘                    └──────────┘
      terminal
```

The three live states answer three different questions:

| State | Means |
| --- | --- |
| **Actively filling** | Something changed in the last 15 seconds. |
| **Paused** | The form is still open on their device, but nothing has been entered for 15 seconds. |
| **Inactive** | The tab is gone and the form was never submitted. |

**Paused counts real input only** — typing, changing a field, moving between
fields. There is no heartbeat propping it up, so a form sitting open and untouched
correctly reads as paused rather than as active.

**Inactive is driven by the socket disconnecting**, not by a timer, so it means
"they closed it" rather than "they went quiet". The store tracks which tabs hold
each session open, so a second tab keeps a session alive and a staff socket
watching a session never keeps it out of inactive.

**Submitted is terminal.** It survives the tab closing and late-arriving patches
cannot reopen it.

A 5-second sweep re-derives status for every session and emits `session:status`
only for those that changed, so an idle dashboard stays quiet. Sessions untouched
for 30 minutes are dropped.

### Reconnection and repair

Socket.IO reconnects with backoff. On reconnect the patient client re-emits
`session:join` followed by a full `form:update` carrying its current values, so
the server's copy is repaired rather than left stale — this is what lets a
restarted server recover every in-flight session from its clients. The staff
client re-requests `session:list` and replaces its map wholesale rather than
merging into possibly-stale state.

While disconnected the form stays editable and the draft continues saving to
`localStorage`; the console keeps its last-known data on screen, labelled with
when it was received.

### Ordering, conflicts and trust

There is exactly one writer per session, so no merge logic is needed. Patches are
shallow-merged in arrival order and `lastActivityAt` is stamped server-side.

Three things the server does not take on faith:

1. **Patch keys** are filtered against the field registry and truncated, so an
   unknown or oversized key never enters the store.
2. **Submissions** are re-validated with the same Zod schema the client uses, so a
   tampered or stale payload is rejected identically either way.
3. **Deletes** are refused unless the session is genuinely inactive — a live,
   paused or submitted session cannot be removed, whatever the client asks.

---

## Known limitations

Stated plainly — these are scope choices, not oversights.

- **In-memory store.** Sessions are lost on restart and do not survive horizontal
  scaling. Production would move the map to Redis with the Socket.IO Redis
  adapter; the store already sits behind the `SessionStore` interface, so that is
  a single-file change.
- **Requires a long-lived Node process.** The realtime layer needs a host that
  runs `server.ts` — Render, Railway, Fly, Heroku. Serverless platforms give each
  invocation its own memory, so the patient's connection and the staff console's
  connection can land on different instances and never see each other. Deploying
  there would require the Redis store and pub/sub described above.
- **No authentication.** Anyone with the URL can open the console. A real
  deployment needs staff auth and per-clinic scoping.
- **No PHI handling.** This holds real personal health data in production, which
  requires consent capture, an audit trail, encryption at rest and a compliance
  review well beyond this assignment.
