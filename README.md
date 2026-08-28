# Agnos — real-time patient form

A patient intake form that the staff can watch being filled in, keystroke by keystroke.

**Live:** https://patient-input-and-staff-view-97aca62c3bd8.herokuapp.com/

The patient opens a form on their phone and answers at their own pace. Everything they type appears
on the staff console immediately — including which field their cursor is currently in — so the desk
can see who is progressing, who is stuck, and who has finished, without asking anyone anything.

| Screen | Route | Shown as |
| --- | --- | --- |
| Patient form | `/form/[sessionId]` | *Agnos · form* → "Before we see you" |
| Intake Form Console | `/staff`, `/staff/[sessionId]` | *Agnos · staff console* |

Each session has a **Form ID** like `ABCD-2345`. It is in the URL, shown under the form, returned on
the confirmation screen, and used by staff to identify the session.

Every session is labelled **actively filling**, **paused**, **inactive** or **submitted**.

**Built with:** Next.js 15 (App Router) · TypeScript · TailwindCSS v4 · Socket.IO · Zod ·
React Hook Form · Vitest

---

## Setup

Requires Node 20.11 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. To see both sides at once, put two windows side by side

**A 30-second tour:** open `/` and click **Open the staff console**. In a second window open `/`
again and click **Start a patient form**. Type and the console updates as you go. Submit, and the
status pill turns green.

`npm run dev` starts the custom Node server, which serves both Next.js and Socket.IO from one
process.

### Other commands

```bash
npm test            # Vitest: schema, presence machine, session store
npm run typecheck   # tsc --noEmit
npm run build       # Production build
npm start           # Production server
npm run gen:countries   # Regenerate src/lib/countries.ts
```

### Environment variables

None are required locally — the defaults below are what the app uses.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. Supplied by the host in production. |
| `HOST` | `0.0.0.0` | Bind address. |
| `NEXT_PUBLIC_SOCKET_PATH` | `/api/socket` | Where Socket.IO is mounted. Client and server read the same value. |

---

## Deployment

Deployed on **Heroku**. A Node dyno runs `npm start`, which starts `server.ts` — Next.js and
Socket.IO in a single long-lived process. `PORT` is supplied by Heroku; nothing else is needed, and
`GET /healthz` returns `200` for health checks.

**Not on Vercel, because of the sockets.** Vercel does support WebSockets now, but its functions are
serverless: each instance has its own memory, and connections are not guaranteed to reach the same
one. The patient's socket and the console's socket are separate connections, so they can land on
different instances and never see each other's messages. Making it work there would mean moving the
session store and the pub/sub to Redis. A long-lived process avoids the problem entirely.

---

## Bonus features

Beyond the required form, validation, responsive layouts and live updates:

**Realtime and presence**

- **Live field monitoring** — The console shows which field the patient is in right now, not
  just what they have typed.
- **Four presence states instead of three.** *Paused* (form still open, no input for 15 seconds) is
  distinguished from *inactive* (tab closed). Paused counts real input only, so a form left open and untouched reads as paused rather than active.
- **Delete abandoned sessions** - Staff can delete inactive forms from the console, through a two-step confirm. The server refuses to
  delete anything that is not marked inactive, regardless of what the client asks.
- **Reconnection repair** — on reconnect the client re-joins and re-sends its full current state, so
  the server's copy is repaired rather than left stale. A restarted server recovers every
  session from its clients.

**Patient experience**

- **Draft persistence** — form state is mirrored to `localStorage`, so a dropped connection does not
  lose the patient's work.
- **Fresh session on refresh** — reloading starts a new Form ID and clears the abandoned draft; the
  old session shows as inactive on the console, ready to be deleted.
- **Errors restored intelligently** — returning to a saved session flags restored values that are
  invalid, while fields left empty stay quiet until they are edited.
- **Progress that tells the truth** — the meter counts a field only when it is filled *and* valid, so
  it can never reach full while submit would still refuse.
- **Age hint** on date of birth, derived as you type.

**Phone numbers and countries**

- **Per-country phone validation** via `libphonenumber-js`, not a generic digit count. `081 234 5678`
  is a valid Thai mobile and an invalid Singapore number, and the form says so.
- **Searchable country picker** over all 245 countries — by name, ISO code, or dialling code. Typing
  `44` offers the United Kingdom before Jersey, because the generated data marks the main country for
  each shared dialling code.
- **Digits-only entry** — the dialling prefix comes from the picker, so letters and punctuation are
  stripped as they are typed or pasted.
- **Separate pickers** for the patient's number and the emergency contact's, so a Thai patient can
  list a relative abroad.
- **Readable values in the console** — option labels, formatted dates, and numbers in international
  form (`+44 7400 123456`) so the desk can dial without guessing the prefix.

**Craft**

- **No layout shift** — every field reserves a line for its hint or error, so nothing moves when one
  appears.
- **69 unit tests** covering the validation schema, the presence state machine and the session store.

---

## Documentation

[docs/specification.md](docs/specification.md) covers the project structure, the UI/UX decisions
across screen sizes, the component architecture, and the real-time synchronisation flow in detail.

## Known limitations

- **In-memory store.** Sessions are lost on restart and do not survive horizontal scaling. Moving to
  Redis is a single-file change — the store already sits behind a `SessionStore` interface.
- **No authentication.** Anyone with the URL can open the staff console.
- **No PHI handling.** Real use would need consent capture, an audit trail, encryption at rest and a
  compliance review.
- **English-only interface.**
