# RigRent — Product Requirements (PRD)

## Original Problem Statement
Build a truck & trailer rental marketplace (like Turo). Truckers submit a driver-license photo that is AI-read to extract details and check expiry — only a valid (non-expired) license lets them proceed to book. Insurance proof also read by AI. The load being picked up is captured at booking. The app owner takes a configurable cut and the truck/trailer owner takes the majority (split shown; no real payments yet). Also: role-based experiences for owner vs renter, before/after inspection video upload, and a bidding marketplace for tow/maintenance companies where the cheapest bid wins.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (Bearer), uuid string ids, `/api` prefix.
- Frontend: Expo Router (React Native), dark industrial theme "RigRent", Rajdhani + Manrope fonts, Material Design Icons.
- AI: GPT-5.4 vision via emergentintegrations (EMERGENT_LLM_KEY) for license/insurance reading.
- Storage: Emergent Managed Object Storage for images & inspection videos.

## User Personas
- Trucker (renter): browses rigs, verifies license, books with load details.
- Fleet Owner: lists rigs, approves bookings, tracks earnings.
- Service Company (vendor): bids on tow/repair/maintenance jobs.
- Admin: reviews verifications, sets platform commission rate.

## Core Requirements (static)
- AI license verification gate before booking (expiry detected).
- Insurance proof reading.
- Configurable commission split (owner majority, app fee).
- Role-based navigation in one app.
- Before/after inspection video upload per booking.
- Tow/maintenance bidding marketplace, cheapest bid highlighted.

## Implemented (2026-06)
- Auth (JWT) with roles renter/owner/vendor/admin; seeded demo accounts.
- AI license + insurance verification (GPT-5.4 vision) with admin review.
- Marketplace: search, category chips, seeded semi/trailer listings.
- Listing detail with load-details form + live commission split module.
- Booking flow (blocked until license verified) + owner approve/decline.
- Owner dashboard (earnings/active/pending) + My Rigs (create/soft-delete + photo upload).
- Roadside bidding: post requests, vendors bid, poster accepts cheapest.
- Inspection before/after video upload via object storage.
- Admin: verification review + commission-rate stepper.
- Object storage upload/serve endpoints.
- **Sign-in temporarily bypassed**: app auto-enters as a trucker for testing (auth screen retained for later).
- Replaced pickup-style render with verified semi-truck imagery across auth hero + listings.

## Backlog
- P1: Re-enable sign-in / onboarding gate when ready.
- P1: In-app role switcher for testing all experiences without login.
- P2: Secure `/api/files` for sensitive docs (owner/admin only).
- P2: Real payments (Stripe) for the split.
- P2: Booking date-conflict checks; messaging between owner/renter.

## Next Tasks
- Add a role switcher to Profile so all experiences are testable while sign-in is off.
