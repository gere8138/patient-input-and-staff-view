# Specification — Agnos Front-end Assignment

**Project:** Real-time patient intake form + staff monitoring view
**Deadline:** 3 days from receipt
**Status:** Build specification (v1) — written before implementation, kept updated as decisions change.
**Implementation status:** Built. §2 records what is verified; R21 (deployment) and R22 (public repo) are the two steps that need the owner's own hosting and GitHub accounts.

---

## 1. Objective

Two interfaces, one shared session:

| Interface | Route | Audience | Job |
|---|---|---|---|
| Patient Form | `/form/[sessionId]` (reached from the `/` landing page) | Patient on a phone in a waiting room | Enter personal details quickly and correctly, once. |
| Staff View | `/staff` and `/staff/[sessionId]` | Clinic staff at a desk or tablet | Watch intake happen live, spot who is stuck, see who has submitted. |

Every keystroke in the patient form must appear on the staff view without a refresh. The staff view must also say whether each patient is **actively filling**, **inactive**, or **submitted**.

---

## 2. Requirements traceability

Every line of the assignment mapped to where it is satisfied. This table is the checklist before submitting.

| # | Requirement | Where satisfied | Done |
|---|---|---|---|
| R1 | First Name | `PatientForm` → `identity` section | ☑ |
| R2 | Middle Name (optional) | `identity` | ☑ |
| R3 | Last Name | `identity` | ☑ |
| R4 | Date of Birth | `identity`, native date input + age hint | ☑ |
| R5 | Gender | `identity`, radio group + self-describe option | ☑ |
| R6 | Phone Number | `contact`, country picker + per-country validation | ☑ |
| R7 | Email | `contact`, required and validated | ☑ |
| R8 | Address | `contact`, textarea | ☑ |
| R9 | Preferred Language | `background`, select | ☑ |
| R10 | Nationality | `background`, select over all 245 countries | ☑ |
| R11 | Emergency Contact (optional: name + relationship) | `emergency` | ☑ |
| R12 | Religion (optional) | `background` | ☑ |
| R13 | Form validation (required fields, valid phone, valid email) | Zod schema + RHF resolver | ☑ |
| R14 | Responsive patient form | Mobile-first, single column → two column at `md` | ☑ |
| R15 | Staff view shows every field in real time | `SessionDetail` | ☑ |
| R16 | Responsive staff view | List-only on mobile, list + detail split at `lg` | ☑ |
| R17 | Indicators: submitted / actively filling / inactive | `StatusPill` + presence state machine (§8) | ☑ |
| R18 | WebSockets or suitable real-time tech | Socket.IO over WS (§5) | ☑ |
| R19 | Next.js | App Router, TypeScript | ☑ |
| R20 | TailwindCSS | v4, tokens in `globals.css` | ☑ |
| R21 | Deployed on a cloud platform | Render / Railway (WS-capable), see §12 | ☐ |
| R22 | Public repo + run instructions | README §13 | ☐ |
| R23 | Development planning documentation | This file, committed to repo | ☑ |

---

## 3. Tech stack and why

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Required. TypeScript because the same field schema is shared by both views and the socket payloads — one source of truth, no drift. |
| Styling | TailwindCSS v4 | Required. Design tokens declared once in `globals.css` via `@theme`. |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) | RHF keeps re-renders local to the changed field, which matters when every keystroke also fires a socket emit. Zod gives one schema reused for client validation and server-side sanity checks. |
| Real-time | Socket.IO (WebSocket transport, long-polling fallback) | Room-per-session maps directly to the problem. Auto-reconnect and fallback are already solved, which is what makes it safe on a free-tier host. |
| Server | Custom Node server (`server.ts`) hosting both Next.js and Socket.IO | Single process, single deploy, single origin — no CORS, no second service to keep alive. |
| State store | In-memory `Map<sessionId, SessionState>` with TTL sweep | The assignment scopes this as a front-end task; no persistence is required. Documented as a deliberate limit with the upgrade path (§14). |
| Phone/country data | `libphonenumber-js` (max metadata) | A phone field that claims to validate must respect each country's numbering plan; hand-rolling that for 245 regions is a liability. The country/dial/flag list is generated from the same source, so the picker and the validator can never disagree. |
| Testing | Vitest for the Zod schema, the phone rules and the status reducer | Small and targeted: validation rules and the presence state machine are the two places a silent bug would be invisible in a demo. |

### The one real decision: where the socket lives

Vercel's serverless functions cannot hold an open WebSocket. Three viable routes were considered:

| Option | Verdict |
|---|---|
| **A. Custom Next.js server + Socket.IO on Render/Railway/Heroku** | **Chosen.** True WebSockets, no third-party account, one URL for everything. Costs the Vercel-specific edge optimisations, which this app does not need. |
| B. Vercel + hosted pub/sub (Pusher / Ably) | Works and stays on Vercel, but adds a vendor, keys to manage, and a free-tier message cap that a keystroke-level stream will hit fast. |
| C. Vercel + Supabase Realtime | Same trade as B, plus a database this project has no other use for. |

If the reviewer specifically expects a Vercel URL, option B is the fallback: the socket layer is isolated behind `lib/realtime/` so the transport can be swapped without touching any component.

---

## 4. Project structure

```
agnos-realtime-intake/
├── server.ts                       # Custom server: Next.js handler + Socket.IO
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Fonts, theme tokens, <html lang>
│   │   ├── page.tsx                # Landing: "Start intake" / "Open staff view"
│   │   ├── form/[sessionId]/page.tsx
│   │   ├── staff/page.tsx          # Session list (mobile) / split view (desktop)
│   │   └── staff/[sessionId]/page.tsx
│   ├── components/
│   │   ├── form/                   # Field primitives + section blocks
│   │   ├── staff/                  # SessionList, SessionDetail, StatusPill, FieldRow
│   │   └── ui/                     # Button, Field, Toast, EmptyState
│   ├── lib/
│   │   ├── schema.ts               # Zod schema + inferred PatientData type
│   │   ├── fields.ts               # Field registry: key, label, type, section, options
│   │   ├── presence.ts             # Status derivation (pure, unit-tested)
│   │   └── realtime/
│   │       ├── events.ts           # Typed event contract, shared client+server
│   │       ├── client.ts           # Browser socket singleton
│   │       └── server.ts           # Handlers + in-memory store
│   └── hooks/
│       ├── usePatientSession.ts    # Patient side: emit debounced updates
│       └── useStaffSessions.ts     # Staff side: subscribe to all sessions
├── docs/specification.md           # This file
└── README.md
```

**Why this shape:** `lib/fields.ts` is the spine. The patient form renders from it, the staff view renders from it, and the Zod schema keys match it. Adding a field is one entry in one array, not four edits across two views.

---

## 5. Architecture and data flow

```
┌────────────────────┐                      ┌────────────────────┐
│   Patient (phone)  │                      │   Staff (desktop)  │
│  /form/[sessionId] │                      │       /staff       │
└─────────┬──────────┘                      └──────────▲─────────┘
          │ form:update  (debounced 250ms)             │
          │ form:submit                                │ session:patch
          │ presence:ping (every 5s)                   │ session:list
          ▼                                            │
   ┌──────────────────────────────────────────────────┴──────┐
   │        Node process — Next.js handler + Socket.IO        │
   │  rooms:  session:<id>   (patient + any staff watching)   │
   │          staff:lobby    (all staff, gets every patch)    │
   │  store:  Map<sessionId, SessionState>  + 30min TTL sweep │
   └──────────────────────────────────────────────────────────┘
```

The server is a relay with a small amount of authority: it stamps `updatedAt`, derives status, and is the only thing that decides a session has gone inactive.

---

## 6. Data model

```ts
// lib/schema.ts
export const patientSchema = z.object({
  firstName:      z.string().min(1, 'Enter the patient\'s first name').max(60),
  middleName:     z.string().max(60).optional().or(z.literal('')),
  lastName:       z.string().min(1, 'Enter the patient\'s last name').max(60),
  dateOfBirth:    z.string().refine(isRealPastDate, 'Enter a date of birth in the past'),
  gender:         z.enum(['female', 'male', 'other', 'prefer_not_to_say']),
  genderSelfDescribe: z.string().max(40).optional(),
  phone:          z.string().refine(isValidPhone, 'Enter a phone number with 9–15 digits'),
  email:          z.string().min(1, 'Enter an email address').email('Enter an email like name@example.com'),
  address:        z.string().min(5, 'Enter a street address').max(300),
  preferredLanguage: z.string().min(1, 'Choose a preferred language'),
  nationality:    z.string().min(1, 'Choose a nationality'),
  emergencyContactName: z.string().max(80).optional(),
  emergencyContactRelationship: z.string().max(40).optional(),
  religion:       z.string().max(60).optional(),
})
.refine(bothOrNeither('emergencyContactName', 'emergencyContactRelationship'),
  { message: 'Add the relationship as well as the name', path: ['emergencyContactRelationship'] });

export type PatientData = z.infer<typeof patientSchema>;
```

```ts
// lib/realtime/events.ts
export type PresenceStatus = 'filling' | 'idle' | 'inactive' | 'submitted';

export interface SessionState {
  sessionId: string;
  data: Partial<PatientData>;
  activeField: keyof PatientData | null;   // what they are typing in right now
  completedFields: number;                 // for the progress meter
  status: PresenceStatus;
  startedAt: number;
  lastActivityAt: number;
  submittedAt: number | null;
}
```

**Validation rules**

| Field | Rule |
|---|---|
| First name, Last name | Required, 1–60 chars |
| Date of birth | Required, parseable, not in the future, age ≤ 120 |
| Gender | Required; `other` reveals a free-text field |
| Phone | Required; country picker + number, validated against that country's numbering plan via `libphonenumber-js` |
| Email | Required and validated (the brief allows optional; the product owner asked for it to be required) |
| Address | Required, min 5 chars |
| Preferred language | Required, from a list |
| Nationality | Required; all 245 countries and territories, by demonym where one exists |
| Emergency contact | Optional pair — if a name is given, the relationship is required |
| Religion | Optional, free text |

Errors surface on blur, then live-update once the field has been touched. Never validate a field the patient has not visited yet.

---

## 7. Component architecture

### Patient side

| Component | Purpose |
|---|---|
| `PatientFormPage` | Owns the RHF form instance and the socket connection for one session. |
| `FormSection` | Groups fields under a heading: Identity → Contact → Background → Emergency contact. Grouping reduces the perceived length of a 12-field form on a phone. |
| `TextField` / `SelectField` / `DateField` / `RadioGroup` | Field primitives. Each takes `name`, `label`, `error`, and reports focus/blur upward so the staff view can show `activeField`. |
| `ProgressMeter` | Sticky footer on mobile: "8 of 10 required fields complete" + the submit button. |
| `ConnectionBadge` | Shows reconnecting / offline state so a patient never types into a void. |
| `SubmittedScreen` | Replaces the form on success; confirms and shows a reference code. |

### Staff side

| Component | Purpose |
|---|---|
| `StaffDashboard` | Subscribes to `staff:lobby`, holds the session map. |
| `SessionList` | One row per patient: name-so-far (or "Unnamed patient"), status pill, progress, relative time. Sorted: filling → idle → submitted → inactive. |
| `SessionDetail` | Every field, live. Missing values render as a muted placeholder rather than a blank so the layout does not jump. |
| `FieldRow` | Label + value; briefly highlights when its value changes; shows a caret marker when it is the patient's `activeField`. |
| `StatusPill` | The indicator required by R17. One component, four states, used in both list and detail. |
| `EmptyState` | "No patients are filling in a form right now" + a copyable link to start one. Useful during the demo. |

---

## 8. Real-time synchronization flow

### Event contract

**Patient → server**

| Event | Payload | Notes |
|---|---|---|
| `session:join` | `{ sessionId }` | Creates the session if new; joins room `session:<id>`. |
| `form:update` | `{ sessionId, patch: Partial<PatientData>, activeField }` | Debounced 250 ms per field. Sends only changed keys, not the whole form. |
| `form:focus` | `{ sessionId, field \| null }` | Immediate, not debounced — drives the caret marker. |
| `form:submit` | `{ sessionId, data }` | Server re-validates with the same Zod schema before accepting. |
| `presence:ping` | `{ sessionId }` | Every 5 s while the tab is visible. |

**Server → staff**

| Event | Payload | Notes |
|---|---|---|
| `session:list` | `SessionState[]` | Sent once on staff connect. |
| `session:patch` | `{ sessionId, patch, activeField, status, lastActivityAt }` | Broadcast to `staff:lobby` on every change. |
| `session:status` | `{ sessionId, status }` | Emitted by the inactivity sweep when nothing else changed. |
| `session:removed` | `{ sessionId }` | After TTL expiry. |

### Status state machine

Derived on the server, in one pure function (`lib/presence.ts`) so it is testable and cannot diverge between views.

```
                 any form:update / presence:ping
        ┌──────────────────────────────────────────┐
        ▼                                          │
   ┌─────────┐  no activity 15s   ┌──────┐  no activity 90s   ┌──────────┐
   │ filling │ ─────────────────► │ idle │ ─────────────────► │ inactive │
   └────┬────┘                    └──────┘                    └──────────┘
        │ form:submit
        ▼
   ┌───────────┐
   │ submitted │   terminal — never downgrades
   └───────────┘
```

A 5-second server interval re-derives status for all sessions and emits `session:status` only for those that changed. Emitting only on change keeps an idle dashboard quiet.

### Why debounce at 250 ms

Every keystroke as its own packet is wasteful and, on a slow connection, arrives out of order. 250 ms is below the threshold at which a watching human perceives lag, and it collapses a burst of typing into one message. `form:focus` stays undebounced because the caret marker should feel instant.

### Reconnection

Socket.IO reconnects with backoff. On reconnect the patient client re-emits `session:join` followed by a full `form:update` with the current form values, so the server's copy is repaired rather than left stale. The staff client re-requests `session:list` and replaces its map wholesale.

### Ordering and conflicts

One writer per session, so no merge logic is needed. Patches are shallow-merged in arrival order; `updatedAt` is stamped server-side to avoid trusting client clocks.

---

## 9. Design decisions (UI/UX)

**Direction: paper for the patient, console for staff.** The two audiences use this product in opposite conditions — a patient fills it in once, nervously, on a phone; staff keep it open all shift on a bright screen. Giving them the same skin would serve neither. The patient surface is near-white and quiet, with generous line height and large tap targets. The staff surface is a dark console where colour is reserved almost entirely for status, so a glance across the room reads as "two amber, one green."

**Tokens** (declared once in `globals.css`):

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FBFBF9` | Patient background |
| `--ink` | `#10312E` | Primary text, deep pine |
| `--accent` | `#146B5F` | Focus rings, primary button, active field marker |
| `--console` | `#14181B` | Staff background |
| `--console-raised` | `#1E2429` | Staff cards |
| `--signal` | `#E8B93A` | Actively filling |
| `--ok` | `#3E9C6B` | Submitted |
| `--muted` | `#8A9199` | Inactive, placeholders |
| `--alert` | `#C2453B` | Validation errors |

**Type:** IBM Plex Sans Thai for everything — it carries Latin and Thai in one family with matching metrics, which a Thai clinic product actually needs and which most UI stacks fumble. IBM Plex Mono for timestamps, session IDs, and the field values in the staff console, where alignment and scannability beat warmth.

**Signature element:** the *live field caret* in the staff view. When the patient's cursor is in "Phone number," that row in the staff console shows a soft pulsing marker. It is the clearest possible answer to "is this person actively filling in the form" — not a badge that says so, but the thing itself. Everything else on the page stays deliberately flat so this reads.

**Responsive behaviour**

| Breakpoint | Patient form | Staff view |
|---|---|---|
| `< 640px` | Single column, 16px base font (prevents iOS zoom-on-focus), 44px min tap targets, sticky submit bar with progress | List only; tapping a row pushes to `/staff/[sessionId]` |
| `640–1024px` | Two columns for short paired fields (first/middle, city-level fields) | List only, wider rows, more metadata per row |
| `≥ 1024px` | Max width 720px, centred; sections spaced, no sticky bar | Split view: 320px list rail + detail pane |
| `≥ 1440px` | Unchanged | Detail pane shows fields in two columns |

**Accessibility floor:** every input has a real `<label>`; errors are linked with `aria-describedby` and announced via `role="alert"`; status changes on the staff side go through an `aria-live="polite"` region; visible focus rings throughout; `prefers-reduced-motion` disables the caret pulse and the row-change highlight.

---

## 10. Error and empty states

| Situation | Behaviour |
|---|---|
| Socket disconnected (patient) | Amber bar: "Reconnecting — your answers are saved on this device." Form stays editable; queued patch flushes on reconnect. |
| Socket disconnected (staff) | Console dims, banner: "Reconnecting to live updates." Last-known data stays visible, marked with the time it was received. |
| Submit fails validation server-side | Field-level errors returned by key and applied to the form; page scrolls to the first one. |
| No active sessions | "No patients are filling in a form right now" + copyable start link. |
| Unknown `sessionId` on staff detail | "This session has ended or expired" + back to the list. |

---

## 11. Bonus features (if time remains, in priority order)

1. **Draft persistence** — mirror form state to `localStorage` so a dropped connection or accidental refresh does not lose the patient's work.
2. **QR handoff** — staff view shows a QR code for a fresh session; the patient scans and starts on their own phone. This is how the app would actually be used in a clinic.
3. **Field-level "last changed" timestamps** in the staff detail pane.
4. **Thai/English UI toggle**, wired to the Preferred Language field.
5. **Completion analytics** — which field patients spend longest on, shown in the staff console.

Nothing here ships at the cost of the required features or the README.

---

## 12. Deployment

**Target: Render (Web Service, free tier)** — Node process, WebSockets supported, deploy on push.

```
Build:  npm ci && npm run build
Start:  npm run start        # node server.js — serves Next.js + Socket.IO
Env:    PORT (provided), NEXT_PUBLIC_SOCKET_PATH=/api/socket
Health: GET /healthz → 200
```

Railway and Heroku work identically. Free-tier cold starts are a known trade — the README notes that the first request may take a few seconds to wake the service.

**Pre-submission checks:** two devices on the deployed URL, one on mobile data; verify a keystroke on the phone appears in the staff console; kill the patient's network and confirm the status walks filling → idle → inactive; submit and confirm the pill goes green and stays green.

---

## 13. README outline (deliverable)

1. What this is + live URL + a 30-second "try it" (open staff view in one tab, form in another)
2. Screenshots: patient form on mobile, staff console on desktop
3. Local setup: `npm install`, `npm run dev`, open two browsers
4. Environment variables
5. Architecture summary + link to `docs/specification.md`
6. Real-time flow in five sentences
7. Bonus features implemented
8. Known limitations and what would change for production (§14)

---

## 14. Known limitations

Stated plainly rather than hidden — these are deliberate scope choices, not oversights.

- **In-memory store.** Sessions are lost on restart and do not survive horizontal scaling. Production would move the session map to Redis and use the Socket.IO Redis adapter; the store is already behind an interface so this is a single-file change.
- **No authentication.** Anyone with the URL can open the staff view. Real deployment needs staff auth and per-clinic scoping.
- **No encryption at rest or PHI handling.** This holds real personal health data in production; that requires consent capture, an audit trail, and a compliance review well beyond this assignment.
- **No i18n framework.** Copy is English-only unless bonus item 4 ships.

---

## 15. Plan

- Scaffold Next.js + Tailwind + custom server. `fields.ts`, `schema.ts`, `events.ts`. Patient form rendering and validating end to end, no sockets yet. Deploy an empty shell early to prove the pipeline. |
- Socket.IO server, session store, presence state machine + its unit tests. Staff list and detail wired to live patches. Status pills. Responsive passes on both views at all breakpoints. |
- Reconnection handling, error and empty states, accessibility pass, real two-device testing on the deployed URL. README, screenshots, this spec committed. Bonus features only after everything above is green. |

Deploy as soon as possible and push to it daily. Leaving deployment to the last afternoon is the most common way an otherwise finished assignment arrives broken.
