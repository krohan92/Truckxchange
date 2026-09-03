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
- Auth (JWT) with roles renter/owner/vendor/admin; seeded demo accounts; login screen + one-tap quick role login.
- AI license + insurance verification (GPT-5.4 vision) with admin review.
- Marketplace: search, category chips, seeded semi/trailer listings.
- Listing detail with swipeable photo gallery, compliance card (DOT/insurance), load form + live commission split; celebratory booking confirmation modal.
- Booking flow (blocked until license verified) + owner approve/decline; role-based landing (owner→Dashboard, vendor→Jobs).
- Owner dashboard + My Rigs (multi-photo create up to 6, soft-delete).
- **Compliance gate**: owners must enter DOT number + insurance (provider/policy/expiry); expired or missing insurance blocks listing (backend 400/422).
- Roadside bidding: post requests, vendors bid, poster accepts cheapest.
- Inspection before/after video upload via object storage.
- Admin: verification review + commission-rate stepper.
- **In-app notifications**: inbox screen + bell with unread badge on all main headers. Events: booking requested, approved, declined, rig picked up (trip started), trip completed, bid received, bid accepted. (Real push deferred — user will add google-services.json later.)

## Backlog
- P1: Real phone push (Emergent-managed) once user provides google-services.json (package com.emergent.fleetrentcheck.vpnmy2). Notification write points already centralized in `notify()`.
- P2: Secure `/api/files` for sensitive docs (owner/admin only).
- P2: Real payments (Stripe) for the split.
- P2: Booking date-conflict checks; messaging between owner/renter.

## Next Tasks
- Add a role switcher to Profile so all experiences are testable while sign-in is off.
