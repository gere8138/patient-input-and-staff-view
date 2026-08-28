# Agnos Realtime Intake

A patient intake form that the front desk can watch being filled in, keystroke by keystroke.

Two interfaces over one shared session:

| Interface | Route | Who it is for |
| --- | --- | --- |
| Patient form | `/form/[sessionId]` | A patient on a phone in the waiting room |
| Staff console | `/staff`, `/staff/[sessionId]` | Clinic staff at a desk or tablet |

Every keystroke on the patient form appears in the staff console with no refresh, and each session
is labelled **actively filling**, **paused**, **inactive** or **submitted**.

## Try it in 30 seconds

1. Open the staff console in one window: `/staff`
2. Open a patient form in another: click **Start a patient intake** from `/`
3. Type in the form. The console updates as you type, shows which field the cursor is in, and
   moves the progress bar. Submit, and the pill turns green.

## Local setup

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. Use two browser windows side by side — or a phone on the same
network — to see both sides at once.

Other scripts:

```bash
npm test        # Vitest: validation schema + presence state machine
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
      │  presence:ping (5s while visible)              │ session:list
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
                any form:update / presence:ping
       ┌────────────────────────────────────────┐
       ▼                                        │
  ┌─────────┐  silent 15s  ┌────────┐  silent 90s  ┌──────────┐
  │ filling │ ───────────► │ paused │ ───────────► │ inactive │
  └────┬────┘              └────────┘              └──────────┘
       │ form:submit
       ▼
  ┌───────────┐
  │ submitted │  terminal — never downgrades
  └───────────┘
```

A visible patient tab pings every 5 seconds, so "paused" and "inactive" mean the tab was closed,
backgrounded, or lost its connection — which is exactly the case staff need to spot.

## Project structure

```
server.ts                     Custom server: Next.js handler + Socket.IO + /healthz
src/lib/fields.ts             Field registry — the spine both views render from
src/lib/schema.ts             Zod schema, shared by the client and the server
src/lib/presence.ts           Status derivation and sort order (pure, tested)
src/lib/realtime/events.ts    Typed event contract shared by client and server
src/lib/realtime/store.ts     SessionStore interface + in-memory implementation
src/lib/realtime/server.ts    Socket handlers and the inactivity sweep
src/hooks/                    usePatientSession, useStaffSessions
src/components/form/          Patient form: field primitives, sections, progress
src/components/staff/         Console: list, detail, status pill, live field caret
tests/                        Vitest: schema rules and the presence machine
```

Adding a field is one entry in `src/lib/fields.ts` plus one line in the Zod schema — the form, the
progress meter and the staff detail pane all pick it up.

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

- **Draft persistence** — form state is mirrored to `localStorage`, so a refresh or a dropped
  connection does not lose the patient's work.
- **Reconnection repair** — on reconnect the client re-joins and re-sends its full current state,
  so the server's copy is repaired rather than left stale.
- **Copyable intake link** — the console's empty state generates a fresh session link for handing
  to a patient.
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

Railway, Fly and Heroku work identically. Vercel does not: its serverless functions cannot hold an
open WebSocket. The transport is isolated behind `src/lib/realtime/`, so moving to a hosted pub/sub
service (Pusher, Ably) to stay on Vercel would not touch a single component.

Free-tier services sleep when idle, so the first request after a quiet period can take a few
seconds to wake.

## Known limitations

Deliberate scope choices, stated plainly.

- **In-memory store.** Sessions are lost on restart and do not survive horizontal scaling.
  Production would move the map to Redis with the Socket.IO Redis adapter — the store already sits
  behind the `SessionStore` interface, so that is a single-file change.
- **No authentication.** Anyone with the URL can open the staff console. A real deployment needs
  staff auth and per-clinic scoping.
- **No PHI handling.** This holds real personal health data in production, which requires consent
  capture, an audit trail, encryption at rest and a compliance review well beyond this assignment.
- **No i18n framework.** The interface copy is English-only; the field content supports Thai.
- **One writer per session.** Patches are shallow-merged in arrival order with no conflict
  resolution, which is correct while exactly one patient owns a session.
