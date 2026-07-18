<USER_REQUEST>
# Agro-Data Hub — Complete Frontend Rebuild Blueprint

**Read this entire document before writing or deleting anything. Do not skip sections. Do not begin coding until Part 1 (Verification) is complete and its results are reported back.**

This is a full rebuild of the web application's frontend. It is being done because repeated incremental fixes have not produced a working, trustworthy product. This document exists so the rebuild does not repeat the same mistakes. Every rule in Part 3 was learned from a real, specific bug that shipped to production and had to be found and fixed by hand. Follow them exactly.

---

## PART 0 — What Is Protected and Must Never Be Touched

- **The Supabase database itself** — its schema, its tables, its Row-Level Security policies, and every row of real data currently in it. Do not run any `ALTER`, `DROP`, `CREATE POLICY`, `DROP POLICY`, or data-modifying statement against it as part of this rebuild, under any circumstance, without being given the exact statement to run and told explicitly to run it.
- **The GitHub repository location and the Vercel project** — keep using the same repo and the same Vercel project. Do not create a new one.

Everything else — every page, every component, every store, every piece of client-side routing and business logic — is in scope to be deleted and rebuilt.

---

## PART 1 — Mandatory Verification Before Writing Any Code

Before deleting anything or writing a single new line of code, verify the following directly against the live database using a real, authenticated session (sign up a real test account first, then query as that session — never test with the anon key alone, since anon-only tests fail against `authenticated`-scoped policies regardless of whether real signups work, and this has produced false bug reports before). Report exact findings for every item below before proceeding.

1. The exact current columns of `users`, `trade_requests`, `vehicle_states`, `logistics_bookings`, and `iot_telemetry_logs`. Part 2 below gives a strong best-known baseline — confirm it is still accurate, and correct anything that has drifted.
2. The exact current RLS policies on all five tables (`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = '<table>'` for each).
3. Whether `farm_input_listings` and `trade_inquiries` tables currently exist on the live database, or only in an unrun migration file. If they don't exist, do not build UI that depends on them until they do — flag this back for a decision rather than building against a table that isn't there.
4. What Supabase Storage buckets currently exist, and which of them have real, working upload policies (not just that the bucket exists — actually test an authenticated upload against each one).
5. Whether the Google Maps API key is correctly set as an environment variable in Vercel's own project settings (not just `.env.local`, which Vercel does not read in production), and whether that key has billing enabled and correct domain restrictions in Google Cloud Console.

Do not proceed to deletion or rebuilding until this report is given.

---

## PART 2 — Verified Database Schema (Best Known State — Confirm, Don't Assume)

This reflects the most recent confirmed state from direct, authenticated testing. Treat it as a strong starting point, not gospel — Part 1 requires you to confirm it directly before relying on it.

### `users`
| Column | Notes |
|---|---|
| `id` | UUID, primary key, auto-generated. **Not the same as the auth session ID.** |
| `auth_uid` | UUID, nullable, unique. Links a row to a real Supabase Auth session (`auth.uid()`). Must be set at signup. All profile lookups after login must use this column, not `id`. |
| `full_name` | text |
| `phone_number` | text |
| `declared_profession` | text, constrained by a CHECK to **exactly** these four strings, case-sensitive: `'Smallholder Farmer'`, `'Commodity Trader'`, `'Logistics Carrier'`, `'Enterprise Buyer'`. Never insert `'farmer'`, `'buyer'`, `'carrier'`, or any other casing/shorthand directly — always map an internal role key to the exact full string before writing to this column. |
| `age` | integer, appears to be NOT NULL |
| `gender` | varchar, appears to be NOT NULL, short max length |
| `macro_region` | text, appears to be NOT NULL |
| `has_registered_device` | boolean, default false |
| `verification_status` | text |
| `business_latitude`, `business_longitude` | double precision, nullable |
| `created_at` | timestamp |

### `trade_requests`
| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `user_id` | UUID, references `users.id` (**not** `users.auth_uid`, and there is **no** `owner_id` column on this table — do not use it) |
| `buyer_id` | UUID, nullable, references `users.id`. Set only when an Enterprise Buyer confirms/claims the request. |
| `commodity_variety` | text |
| `quantity_volume` | numeric — **the column is not called `quantity`** |
| `physical_address` | text — **the column is not called `address`** |
| `computed_latitude`, `computed_longitude` | double precision |
| `harvest_photo_url` | text, nullable |
| `payment_status`, `payment_reference`, `payment_gateway` | text |
| `request_status` | text — **the column is not called `status`.** Confirm the exact live value set directly (values seen in different parts of this project's history include `awaiting_buyer`, `pending`, `searching_logistics`, `allocated`, `dispatched`, `fulfilled` — there may be inconsistency here from past work; resolve and confirm the true current set before building status-dependent logic). |
| `created_at` | timestamp |

### `vehicle_states`
| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `carrier_id` | UUID, references `users.id` |
| `payload_capacity_baskets` | numeric |
| `current_latitude`, `current_longitude` | double precision |
| `carrier_status` | text: `available`, `busy`, `offline` |
| `vehicle_type` | varchar, CHECK-constrained: `Motorcycle`, `Tricycle`, `Van`, `Pickup Truck`, `Truck` |
| `plate_number`, `vehicle_nickname` | varchar |
| `vehicle_photo_url` | text |
| `updated_at` | timestamp |

A carrier may have **more than one row** — do not assume one vehicle per carrier anywhere in the rebuilt UI.

### `logistics_bookings`
| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `trade_request_id` | references `trade_requests.id` |
| `carrier_id` | references the relevant carrier |
| `proximity_distance_km` | numeric |
| `created_at` | timestamp |

Confirm directly whether any payment/payer-related columns exist on this table — do not assume.

### `iot_telemetry_logs`
| Column | Notes |
|---|---|
| `id` | UUID, primary key |
| `owner_id` | UUID, nullable, references `users.id` — set for an individually-registered farm device reading |
| `associated_lga` | text — used for shared/regional readings when `owner_id` is null |
| `soil_moisture_percentage` | numeric |
| `created_at` / `recorded_at` | timestamp |

**Confirm directly whether `temperature` and `humidity` columns actually exist** — prior investigation this session found `temperature` did not exist on this table, contradicting an earlier description of it. Do not build UI displaying a temperature/humidity reading until this is confirmed one way or the other.

---

## PART 3 — Hard Rules, Each One Learned From a Real, Shipped Bug

These are not stylistic preferences. Each rule below directly corresponds to a specific bug that reached production during this project's history. Violating any of them is very likely to reproduce that exact bug.

1. **Never guess a column name.** Verify every single column referenced in an insert, select, or update against the live schema first, using a real authenticated session. A guessed column name (`owner_id` instead of `user_id`, `quantity` instead of `quantity_volume`, `address` instead of `physical_address`, `status` instead of `request_status`) has repeatedly caused silent, invisible submission failures.

2. **Never test RLS behaviour with the anon key alone.** Every meaningful policy in this project is scoped `TO authenticated`. An anon-only test will always fail, correctly, regardless of whether real signup and login work. Any RLS diagnosis must be based on a real `signUp()` → real session → query, not an anonymous script.

3. **Never hardcode a post-signup or post-login route.** Do not write `router.push('/dashboard/farmer')` as a fixed destination after any auth action. Always derive the destination dynamically from the actual, confirmed-loaded profile's role field — and do not navigate until that profile has actually finished loading.

4. **Never leave a specific fake person's name as a fallback value anywhere in a real code path.** A fallback shown while data is loading, or when data is genuinely absent, must be generic (e.g. "Loading...", or a neutral label) — never a specific invented name that could be mistaken for a real account.

5. **Guard every piece of async state that can be written from more than one trigger.** Specifically: if a profile-fetch can be triggered both by an explicit call (e.g. inside `signUp`) and by a background listener (e.g. `onAuthStateChange`), both calls must be protected by a monotonically increasing request-sequence counter, so a slower, stale response can never overwrite a newer, correct one. This exact race condition caused registered users' names and roles not to display correctly.

6. **Every React component must call all of its hooks unconditionally, before any early return.** An early `return` placed before a `useMemo`, `useEffect`, or similar hook call, in a component whose render path can vary (e.g. based on the current route), causes a hard React crash the moment the two paths diverge across renders. This exact bug caused a full login/logout crash.

7. **Never build a camera or file-upload feature against a Supabase Storage bucket without first confirming, with a real authenticated upload, that the bucket exists and its policy actually allows the upload.** Do not silently substitute a fake local Data-URL as a permanent fallback when a real upload fails — that hides the real, underlying problem (a missing bucket or policy) rather than fixing it. If a bucket or policy is missing, say so plainly and fix the actual cause.

8. **Never build UI against a table that has not been confirmed to exist on the live database.** A `CREATE TABLE` statement sitting in an unrun migration file is not the same as a real, existing table. Confirm existence directly before writing any component that reads or writes to it.

9. **The Google Maps integration must have an explicit loading state and an explicit error state**, both handled before the map component itself is ever rendered. Rendering the map component while the script is still loading, or when it has failed to load, has previously caused a blank or broken page with no explanation to the user. The API key must come from an environment variable actually set in Vercel's own project settings (not only `.env.local`), and must have billing enabled and the correct domain allowed in Google Cloud Console.

10. **No feature, page, or fix may be reported as complete based on a passing build or a backend script alone.** A successful `npm run build`, or a Node script that talks to Supabase directly, proves only that the code compiles or that the database itself behaves correctly — neither proves the actual page works for a real person in a real browser. Every feature must be manually tested in an actual browser, by a human, before being reported as done. If browser automation is not available in this environment, say so plainly and hand off the exact steps and URL for manual testing, rather than reporting something as finished.

11. **A public, unauthenticated marketing or landing page must never trigger a login, create a session, or redirect to an authenticated route as a side effect of simply navigating to it.**

12. **When a real bug is found during testing or diagnosis, never modify real user data, insert test rows into live tables, or alter any real account's identity fields without asking first.** Diagnostic reads are always fine; diagnostic writes to real data are not, unless explicitly authorised in that moment.

13. **A real, signed-up account's role is fixed permanently at signup and must never be self-service-switchable.** An earlier version of this project had a "become any role instantly" feature; it was deliberately removed because it let a single person act as both farmer and buyer on the same identity, defeating the entire point of the buyer-confirmation trust mechanism described below. If someone genuinely needs a different role, they register a separate account. Do not reintroduce any form of in-app role switching for real accounts.

14. **The "no photo, no confirm" rule on buyer confirmation applies uniformly to every trade request, regardless of which channel it originated from (USSD or the web app).** USSD cannot transmit a photo, and that is treated as a deliberate, disclosed business-policy boundary, not a bug to silently work around by exempting USSD-originated requests from the rule. Do not special-case this.

---

## PART 4 — What Gets Deleted

Delete entirely and rebuild from nothing:

- Every page under `app/` except the Next.js framework files that must exist for the app to run at all (e.g. `app/layout.tsx` can be rebuilt, not preserved).
- Every component under `components/`.
- The entire `store/` directory (the auth store and any other client state).
- Any service worker files and PWA registration components added during this project's history.
- The `app/signup` route added during a previous, now-superseded fix attempt.
- Any hardcoded demo/simulated data of any kind, anywhere.

Do **not** delete:
- The `supabase/` folder's migration files — keep them as historical reference only. Do not re-run them without being told to.
- Environment variable configuration itself (the variable names and where they're set in Vercel) — though verify each one per Part 1.

To be clear about mechanics: there is no separate "delete it from Vercel" action needed. Vercel does not retain old code as something separately live — deploying fresh code from a rebuilt repository automatically replaces whatever was there before. The actual work is entirely in the codebase itself.

---

## PART 5 — What Gets Built: Application Structure and Flow

### 5.1 Public Landing Page

- Remove the "Explore Live Geospatial Map" button and any public, unauthenticated map access entirely.
- The landing page's primary function is role selection, presented clearly: **Farmer / Seller**, **Enterprise Buyer**, **Logistics Provider** (and Commodity Trader, matching the real fourth role in the schema). Selecting a role leads to sign-up or login scoped to that role.
- No page navigation from this screen may create a session, log anyone in, or redirect to any `/dashboard/*` route without an actual, explicit authentication action having occurred.

### 5.2 Seller Experience — Smallholder Farmer and Commodity Trader

Both of these roles are sellers in the schema's terms and share the same core selling flow; build it once, accessible to both.

- A clear, prominent **"Sell"** action, leading to the harvest submission flow (commodity, quantity, address, live camera-only photo capture, submission).
- A view of the seller's own submitted trade requests and their current status.
- A map showing **available Enterprise Buyers relevant to the seller** — since the current data model does not yet have buyers actively posting open demand (buyers currently only claim existing seller listings), design this honestly against what's real: this may reasonably show, for example, buyers who are currently active in the seller's region based on past claimed trades, or a live indicator of active buyer accounts in-region. Do not fabricate a "buyers looking for produce" feed that doesn't correspond to anything real in the database — if this needs a small schema extension to represent properly, flag it back rather than faking it in the UI.
- A Commodity Trader's account is permanent and distinct from a Smallholder Farmer's — do not merge the two roles into one, even though their screens look similar. Each is its own real value in `declared_profession` and must be routed and labelled correctly throughout.

### 5.3 Buyer Experience

- A clear, prominent **"Buy"** action, leading to a live list of trade requests awaiting a buyer (`request_status` in its awaiting-buyer state), each showing commodity, quantity, region, and the required harvest photo — with the confirmation gate that blocks claiming any request that lacks a photo, exactly as already designed.
- A map showing **available sellers** — trade requests currently awaiting a buyer, plotted by their computed coordinates, so a buyer can see what's available near them geographically.
- A record of the buyer's own claimed/confirmed orders and their logistics status.

### 5.4 Logistics Provider Experience

- A clear view of **available trades needing logistics** — trade requests that have a confirmed buyer and have transitioned into the logistics-searching state, presented as jobs a carrier can review and accept.
- A map showing these opportunities geographically, so a carrier can judge proximity before accepting.
- A genuine **real-time tracking view** for an active, accepted job — in the style of a ride-hailing or delivery app: the carrier's live position updating on a map as they move, visible to both the carrier and, appropriately, the buyer and seller tied to that specific job. If the current data model has no mechanism for live position updates, this requires periodically writing the vehicle's live coordinates into `vehicle_states` from the carrier's own device while a job is active, and the map reading and refreshing from that. Build this properly, using genuine device geolocation — do not simulate or fake movement.
- Full vehicle fleet management, allowing more than one registered vehicle per carrier, each independently trackable.

### 5.5 Farm Inputs Marketplace

- Both farmers/traders and buyers may publish input listings (seed, fertiliser, equipment, etc.) for sale — this is deliberately open to both sides, not restricted to one role.
- Any registered user, regardless of role, may purchase from any listing.
- Confirm the underlying table exists live (per Part 1, item 3) before building this — do not ship UI against a table that isn't actually there yet.

### 5.6 Testing Access (Demo Logins)

- Keep the existing instant demo-account launcher buttons (one-click login into pre-seeded Farmer, Carrier, and Buyer test accounts) — these are useful for fast testing and do not touch any real account's role.
- These buttons must only render outside of production (confirm the correct environment check for this specific Next.js/Vercel setup rather than assuming one blindly) — they must never appear on the live, public-facing site.

### 5.7 Navigation

- A single, consistent, fully functional navigation structure appropriate to each role — every visible link must lead somewhere real and working. No placeholder, no dead link, no link that silently does nothing.
- Expand the application into a proper multi-page structure reflecting the flows above — do not compress everything into a small number of dense pages. Each major function (selling, buying, logistics matching, fleet management, live tracking, farm device readings, farm inputs marketplace) deserves its own page, reachable through the navigation.

### 5.8 Cross-Cutting Requirements

- Camera capture must be genuinely functional everywhere it's used (harvest photos, vehicle photos), uploading to real, confirmed, working Supabase Storage buckets, camera-only (not gallery selection), per the original evidentiary design already established in the dissertation's methodology.
- Google Maps must be genuinely functional everywhere it's used, with proper loading and error states, and a verified, correctly configured API key.
- Every role's dashboard must display the real, correct registered name and role of the signed-in person, every time, with no exceptions.
- Every real account's role is permanent from signup onward — see Part 3, Rule 13. No screen anywhere in the app may offer a way to change it.

---

## PART 6 — Engineering This for Real Scale, Not Just a Demo

Build this the way a senior engineer would build something meant to actually survive traffic, not the way a tutorial gets thrown together to satisfy a grading rubric. Specifically:

### 6.1 Database

- Every column that is frequently filtered or sorted on (`request_status`, `user_id`, `auth_uid`, `carrier_id`, geospatial coordinate columns) must have a proper index. A query that feels instant against a handful of rows can become unusably slow against millions without one.
- **Never fetch an unbounded result set.** Every list view (available trades, seller listings, buyer history, fleet vehicles) must be paginated or explicitly limited, both in the query and in how much is rendered at once. A page that tries to load "all trade requests" will work fine with ten rows and fail outright with ten million.
- Avoid N+1 query patterns — fetch related data through a single, proper joined/embedded query rather than looping over a result set and issuing one additional query per item.
- Be deliberate with Supabase's connection pooling (PgBouncer) — do not hold transactions open longer than necessary, and do not write patterns that assume unlimited concurrent direct connections.

### 6.2 Real-Time Features

- The logistics live-tracking feature must not broadcast a carrier's position to every connected client indefinitely. Scope Supabase Realtime subscriptions narrowly — a buyer or seller should only be subscribed to the one active job relevant to them, not a global feed of every vehicle's movement. Throttle how often a moving vehicle actually writes its position (a few seconds between updates is normal for this kind of feature; continuous writes are not).

### 6.3 Application Architecture

- Fetch data server-side where Next.js allows it, rather than only ever fetching on the client after the page has already loaded — this reduces round trips and keeps the app responsive as usage grows.
- Use code splitting and lazy loading for heavy, non-critical components (the map component in particular) so the initial page load stays fast regardless of how many features the app eventually has.
- Keep the application genuinely stateless on the server side — this runs on serverless functions (Vercel), and any assumption of persistent in-memory state on the server will break unpredictably once there is more than one concurrent server instance.
- Add basic rate limiting to any endpoint that writes data, to protect against abuse or accidental overload as usage grows.

### 6.4 Code Organisation

- Maintain a clear separation between data access, business logic, and presentation — do not let database queries and UI rendering logic tangle together inside the same component, since that is what makes a codebase progressively harder to extend and debug as it grows, independent of how many users it serves.
- Use TypeScript strictly and consistently — type safety is what allows a codebase to keep growing in features without silently reintroducing the exact class of bug (wrong column name, wrong shape of data) that this rebuild exists to eliminate.
- Build a small set of genuinely reusable UI components (buttons, cards, form fields, map wrapper) rather than re-implementing the same visual patterns slightly differently on every page.

### 6.5 Observability

- Wire in basic error tracking (for example, a service like Sentry, or at minimum structured server-side logging of unhandled errors) so that a real failure in production is visible and diagnosable, rather than only discoverable by a person manually noticing something is broken.

---

## PART 7 — Modern, Interactive UI Direction

The current design reads as a generic, templated dashboard. Build something that feels like a real, considered product — the kind of interface a well-funded consumer startup would ship, not a default component-library look.

### 7.1 The Public Landing Page Should Tell a Story as You Scroll

Build the landing page as a scroll-driven visual narrative of the platform's actual value chain, rather than a static block of hero text and feature cards. As an example of the kind of thing to build: an illustrated scene of a farmer and their harvest at the top of the page, which visually progresses, transforms, or reveals new elements (the harvest being logged, a truck arriving, produce reaching a buyer) as the visitor scrolls further down the page — using scroll-triggered animation (the Intersection Observer API, or an animation library such as Framer Motion for React) rather than everything simply being static and visible at once. This should happen entirely before any sign-in is required, as the platform's public first impression.

### 7.2 General Interaction Quality

- Real micro-interactions throughout: buttons and cards should respond visibly and smoothly to hover and press, not just change on click with no transition.
- Skeleton loading states for data that's still being fetched, instead of a blank page or a generic spinner — this both feels faster and communicates what's about to appear.
- Smooth, deliberate transitions between pages and states rather than hard, jarring cuts.
- A coherent design system — a consistent type scale, spacing system, and colour palette applied everywhere, rather than each page inventing its own slightly different visual treatment.
- Maintain the existing light/dark mode toggle, applied consistently across every new page built.

### 7.3 Accessibility Is Part of Quality, Not an Afterthought

Proper keyboard navigation, adequate colour contrast, and correct semantic/ARIA markup are expected throughout — a genuinely well-built product is usable by everyone, not just the easiest case to demo.

---

## PART 8 — Process Requirements for This Rebuild

- Time and resource usage are not a constraint. Do the job thoroughly and correctly rather than quickly.
- Report back after Part 1's verification is complete, before deleting anything.
- Report back after the deletion is complete and the new structure has been scaffolded, before building out full functionality.
- Test every feature manually, in a real browser, before reporting it as working — per Rule 10 in Part 3. If browser automation genuinely isn't available in this environment, say so and hand off precise manual test steps rather than declaring something done.
- Do not touch the Supabase database itself under any circumstance without being given the exact statement and told explicitly to run it.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-07-18T13:41:14+01:00.
</ADDITIONAL_METADATA>
