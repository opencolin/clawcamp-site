# RSV.CLAW — ClawCamp Event Platform PRD

**Version:** 1.0
**Date:** April 4, 2026
**Status:** Draft
**Fork of:** [PizzaDAO/rsv-pizza](https://github.com/PizzaDAO/rsv-pizza)
**Integrates:** [colygon/clawcam](https://github.com/colygon/clawcam)

---

## 1. Vision

PizzaDAO proved that you can build a global community around a simple ritual — show up, eat pizza, meet people. ClawCamp takes that playbook and replaces pizza with **AI**.

**RSV.CLAW** is the event platform for ClawCamp: anyone in the world fills out a form, gets a party kit shipped to them (lobster headbands, ClawCamp swag, Nebius credits), and hosts an event where people get **transformed** — photographed by the ClawCam AI photo booth, indoctrinated into the ClawCult, and immersed in live agent coding, music, and vibes.

The barrier to host is zero. Fill out the form. Get the kit. Throw the party.

---

## 2. What We're Forking

### RSV.Pizza (the platform)
A production-grade event RSVP and operations platform with:
- Event creation with custom URLs, RSVP forms, guest management
- Host dashboard with 11 pinnable apps (sponsors, venue, music, budget, raffle, staffing, displays, reports, checklist, party kit, promo)
- Smart ordering algorithm (we'll repurpose this)
- AI phone ordering via Bland AI
- Claw ID printing (ERC-721 on Base/Monad)
- Underboss dashboard for regional coordinators
- Stripe payments + crypto donations
- Full Prisma/PostgreSQL backend with ~40 models
- React + TypeScript + Vite + TailwindCSS frontend
- Supabase + Vercel deployment

### ClawCam (the photo booth)
A live camera AI transformation app with:
- 80+ transformation styles (locations, characters, artistic styles)
- Camera capture → OpenClaw agent → AI-transformed photo returned
- Photo/Timer/Stream/Postcard modes
- Gallery, GIF creation, favorites, batch operations
- Zustand state + IndexedDB persistence
- Gemini 2.5 Flash image model (configurable)

---

## 3. The Transformation: Pizza → Claw

### What Changes

| RSV.Pizza | RSV.Claw |
|---|---|
| Pizza parties | ClawCamp events |
| Pizza topping preferences | AI experience preferences (what do you want to be transformed into?) |
| Pizza ordering algorithm | ClawCam style recommendation algorithm |
| AI calls pizzeria to order | AI runs the photo booth autonomously |
| Pizza dietary restrictions | Transformation style preferences |
| Pizzeria search (Google Places) | Venue search (any space works — parks, offices, homes, bars) |
| PizzaDAO red (#ff393a) | ClawCamp rust/orange (from clawcamp.com brand) |
| "Underboss" coordinators | "Alpha Claw" regional coordinators |
| Party Kit (stickers, tablecloths) | Claw Kit (lobster headbands, ClawCamp swag, Nebius credits) |
| POAP/Claw ID attendance proof | ClawCult membership Claw ID |
| Stand with Crypto opt-in | Join the ClawCult opt-in |
| Ninja Turtles role themes | Lobster/Claw role themes |
| Global Pizza Party (GPP) | Global Claw Day |

### What Stays the Same
- Event creation + custom URL slugs
- RSVP flow (2-step form)
- Host dashboard with pinnable apps
- Guest approval / waitlist system
- Co-host management
- Sponsor CRM pipeline
- Venue management
- Music/DJ management
- Budget tracking
- Raffle system
- Staffing
- Reports + analytics
- Stripe payments + crypto donations
- Magic link auth
- Regional coordinator dashboard
- Display/signage system

---

## 4. The Host Flow

### Step 1: Apply to Host
```
Anyone visits rsv.claw (or clawcamp.com/host)
        |
        v
Fills out the Host Application Form:
  - Name, email, city, country
  - Proposed date and venue (or "I'll figure it out")
  - Expected guest count
  - What kind of event? (options below)
        |
        v
Application auto-approved (or reviewed by Alpha Claw)
        |
        v
Host gets:
  - Their own event page (rsv.claw/my-city)
  - Access to the host dashboard
  - Claw Kit shipped to them
```

### Step 2: Receive the Claw Kit
The Claw Kit arrives in the mail:

| Item | Description |
|---|---|
| Lobster Headbands | Enough for all expected guests — the signature ClawCamp look |
| ClawCamp Swag | Stickers, posters, table signs, QR code cards |
| Nebius Credits | Cloud compute credits for running AI demos at the event |
| ClawCam Setup Card | Instructions to set up the AI photo booth (laptop + camera) |
| Event Playbook | Quick-start guide: how to throw a ClawCamp |

### Step 3: Throw the Party
Hosts can do whatever they want. Suggested formats:

| Format | Description |
|---|---|
| Claw & Chill | Casual hangout — music, ClawCam photo booth, lobster headbands, vibes |
| Watch Party | Everyone watches agents vibe-code on a big screen |
| Build Night | Hands-on: attendees build with OpenClaw, ClawCam, AI tools |
| Hackathon | Competitive: teams build projects, winners get prizes |
| Demo Day / Show N Tell | Builders present what they've made — bring something cool and show it off |
| 3D Printing Competition | Bring your best 3D prints, print your Claw ID lobster |
| Robot Meetup | Robot owners' group — bring your robot friends, control LeRobot arms with OpenClaw |
| Voice Cloning Station | Get your voice cloned at the event — "How to clone yourself" |
| Lobster Boil | Full party: music, food, drinks, ClawCam, agent demos, the works |

---

## 5. The Guest Flow

### RSVP (2-Step Form, forked from rsv-pizza)

**Step 1 — Identity:**
- Name (required)
- Email (required)
- Wallet address (optional — for Claw ID printing)
- Role selection (ClawCult roles, not Ninja Turtles):
  - **The Claw** — Builder / hacker
  - **The Shell** — Designer / creative
  - **The Antenna** — Community / connector
  - **The Tail** — Newcomer / curious
- Join the ClawCult mailing list (opt-in)

**Step 2 — Experience Preferences:**
- What do you want to be transformed into? (select ClawCam styles)
- Preferred AI models (for photo booth and demos)
- Interests: coding, design, music, AI art, watching agents, just vibes
- Dietary preferences (if food is being served)

### At the Event

```
Guest arrives
        |
        v
Gets a lobster headband — puts it on
        |
        v
Scans QR code → checks in on rsv.claw
        |
        v
CLAWCAM PHOTO BOOTH
  - Steps up to the ClawCam station
  - Camera captures them (with lobster headband on)
  - AI transforms the photo into 5+ different styles
  - Guest picks their favorite
  - Photo saved to their profile + shareable link
  - Option to print as Claw ID
        |
        v
INDOCTRINATION
  - Watch agents code in real-time on the big screen
  - Try building something with OpenClaw
  - Get Nebius credits to experiment
  - Meet other ClawCult members
        |
        v
Guest leaves as a member of the ClawCult
  - ClawCult Claw ID printed to their wallet
  - Transformed photo as their new PFP
  - Connected to the community
```

---

## 6. ClawCam Integration

### What ClawCam Already Does
- Live camera capture → AI transformation via OpenClaw agent
- 80+ styles (locations, characters, artistic)
- Photo/Timer/Stream/Postcard modes
- Gallery, GIF creation, downloads
- Works on desktop and mobile

### What We Add for RSV.Claw

| Feature | Description |
|---|---|
| Event-Specific Styles | Each event gets custom ClawCam styles (e.g., "Lobster in Paris" for a Paris ClawCamp) |
| ClawCult Styles | Dedicated transformation set: "Lobster Warrior", "Cyber Claw", "Claw Royalty", "Deep Sea Hacker" |
| Photo → Profile | Transformed photos auto-save to guest's RSV.Claw profile |
| Photo Wall | Live display mode — all photos from the event shown on a big screen in real-time |
| Claw ID Mint from Booth | One-tap print your transformed photo as an Claw ID right from the booth |
| Leaderboard | Most creative transformation wins a prize (voted by attendees) |
| GIF Recap | Auto-generated GIF of all transformations from the event — shareable |
| Brand Overlay | ClawCamp logo + event name watermarked on all photos |
| Kiosk Mode | Fullscreen lock for unattended photo booth operation |
| Queue System | Multiple guests can queue up — shows "You're next!" countdown |

### ClawCam Kiosk Setup
Hosts set up the ClawCam on a laptop with a webcam:
1. Open `claw.cam/event/{slug}` (event-specific ClawCam instance)
2. App enters Kiosk Mode — fullscreen, no browser chrome
3. Auto-cycles through ClawCult transformation styles
4. Guest steps up → taps shutter → gets transformed
5. Photo appears on the Photo Wall display
6. Guest scans QR to save to their profile

---

## 7. New Dashboard Apps

We keep all 11 rsv-pizza dashboard apps and add ClawCamp-specific ones:

| App | Description |
|---|---|
| **ClawCam** | Configure the photo booth: select styles, set kiosk mode, view all photos taken, moderate content |
| **Photo Wall** | Manage the live display of photos — layout, rotation speed, moderation |
| **Claw Kit** | Track kit shipment status, request additional headbands/swag |
| **AI Demos** | Configure what AI demos are running at the event (agent coding, ClawCam, OpenClaw playground) |
| **Nebius Credits** | Distribute and track cloud compute credits given to attendees |
| **ClawCult** | Membership tracking — who joined, Claw IDs printed, post-event engagement |

---

## 8. Claw ID / Web3

### Fork the RSV.Pizza Claw ID Contract

| RSV.Pizza Claw ID | RSV.Claw Claw ID |
|---|---|
| Token: "RSV.Pizza" / "RSVP" | Token: "ClawCult" / "CLAW" |
| Attendance proof | ClawCult membership + transformed photo |
| Static metadata | Dynamic: includes transformed ClawCam photo as token image |
| Base + Monad chains | Same (or add more chains) |

### Claw ID Features
- **Attendance Claw ID:** Minted when guest checks in — proves they attended
- **Photo Claw ID:** Optional print of their best ClawCam transformation
- **ClawCult Membership:** The Claw ID is your membership card — unlocks perks, discord roles, future event priority
- **Dynamic Metadata:** Claw ID image updates if the guest gets a new transformation at a future event

---

## 9. Tech Stack (What Changes)

| Layer | RSV.Pizza | RSV.Claw |
|---|---|---|
| Frontend | React + TS + Vite + Tailwind | Same |
| Backend | Express + Prisma + PostgreSQL | Same |
| Database | Supabase | Same |
| Deployment | Vercel | Same |
| Auth | Magic link (JWT) | Same |
| Payments | Stripe + crypto | Same |
| Claw ID | ERC-721 on Base/Monad | Same contract, rebranded |
| AI Phone Ordering | Bland AI calls pizzeria | **Remove** (or repurpose for venue booking?) |
| Pizza Algorithm | Topping/diet optimization | **Replace** with ClawCam style recommendation |
| Photo Booth | N/A | **Add** ClawCam integration |
| AI Agent | Bland AI (voice) | OpenClaw (image transformation + coding demos) |
| Compute Credits | N/A | **Add** Nebius credit distribution system |

### New Integrations
- **ClawCam API** — Photo booth capture + transformation
- **Nebius API** — Credit provisioning and tracking
- **OpenClaw Agent** — Powers the photo booth + live coding demos

---

## 10. Brand & Design

### Color Palette
Replace PizzaDAO red (#ff393a) with ClawCamp brand:

| Element | Color |
|---|---|
| Primary | Rust orange (var(--rust) from clawcamp.com) |
| Background | Deep ink/charcoal (var(--ink)) |
| Text | Warm paper/cream (var(--paper)) |
| Accent | Amber/gold for highlights |
| Success | Teal/sea green |

### Typography
- **Headlines:** Bricolage Grotesque (matches clawcamp.com)
- **Mono/Code:** DM Mono (matches clawcamp.com)
- **Body:** System font stack

### Visual Language
- Lobster/claw motifs throughout
- Underwater/deep-sea atmospheric elements
- "ClawCult" aesthetic — playful cult imagery, initiation language
- Photo booth results as the hero visual on event pages

---

## 11. Data Model Changes

### New Prisma Models (additions to the ~40 existing)

```
model ClawCamSession {
  id            String   @id @default(cuid())
  partyId       String
  party         Party    @relation(fields: [partyId], references: [id])
  guestId       String?
  guest         Guest?   @relation(fields: [guestId], references: [id])
  photos        ClawCamPhoto[]
  createdAt     DateTime @default(now())
}

model ClawCamPhoto {
  id            String   @id @default(cuid())
  sessionId     String
  session       ClawCamSession @relation(fields: [sessionId], references: [id])
  inputUrl      String   // original photo
  outputUrl     String   // transformed photo
  style         String   // which transformation style
  model         String   // which AI model
  isFavorite    Boolean  @default(false)
  isClaw ID         Boolean  @default(false)
  nftTokenId    String?
  nftTxHash     String?
  createdAt     DateTime @default(now())
}

model ClawKit {
  id            String   @id @default(cuid())
  partyId       String
  party         Party    @relation(fields: [partyId], references: [id])
  headbandCount Int
  swagItems     Json     // list of swag included
  nebiusCredits Int      // dollar value of credits
  shippingStatus String  @default("pending") // pending, shipped, delivered
  trackingNumber String?
  shippedAt     DateTime?
  deliveredAt   DateTime?
  createdAt     DateTime @default(now())
}

model NebiusCredit {
  id            String   @id @default(cuid())
  partyId       String
  party         Party    @relation(fields: [partyId], references: [id])
  guestId       String?
  guest         Guest?   @relation(fields: [guestId], references: [id])
  amount        Int      // credit amount
  status        String   @default("allocated") // allocated, redeemed, expired
  redeemedAt    DateTime?
  createdAt     DateTime @default(now())
}

model ClawCultMembership {
  id            String   @id @default(cuid())
  guestId       String
  guest         Guest    @relation(fields: [guestId], references: [id])
  nftTokenId    String?
  nftTxHash     String?
  joinedAt      DateTime @default(now())
  photoUrl      String?  // their ClawCam transformation
  role          String   @default("initiate") // initiate, member, elder, alpha
}
```

### Modified Models
- **Party** — Add: `clawKitId`, `clawCamEnabled`, `eventFormat` (enum of formats), `nebiusCreditsPool`
- **Guest** — Add: `clawCultMembershipId`, `preferredStyles` (JSON), `interests` (JSON)
- **Display** — Add: `photoWallMode` (boolean), `photoWallLayout` (enum)

---

## 12. Renamed Concepts

| RSV.Pizza Term | RSV.Claw Term |
|---|---|
| Pizza Party | ClawCamp |
| Host | Host (same) |
| Guest | Initiate (pre-event) → Member (post-ClawCam) |
| Underboss | Alpha Claw |
| Party Kit | Claw Kit |
| Global Pizza Party (GPP) | Global Claw Day |
| POAP | ClawCult Claw ID |
| Pizzeria | Venue |
| Pizza Order | ClawCam Queue |
| Invite Code | Claw Code |

---

## 13. Launch Plan

### Phase 1: Fork & Rebrand (Week 1-2)
- Fork rsv-pizza repo
- Strip pizza-specific code (ordering algorithm, pizzeria search, Bland AI phone calls)
- Rebrand: colors, typography, copy, imagery
- Rename all pizza terminology to claw terminology
- Deploy to rsv.claw (or clawcamp.com/rsvp)

### Phase 2: ClawCam Integration (Week 2-3)
- Embed ClawCam into event pages
- Build event-specific ClawCam instances (`/event/{slug}/clawcam`)
- Add Kiosk Mode for unattended operation
- Build Photo Wall display mode
- Connect photos to guest profiles
- Add ClawCult transformation styles

### Phase 3: Claw Kit & Operations (Week 3-4)
- Build Claw Kit ordering and shipping system
- Integrate Nebius credit provisioning
- Build host application form
- Set up Alpha Claw coordinator dashboard
- Create event format templates

### Phase 4: Claw ID & Membership (Week 4-5)
- Rebrand Claw ID contract (ClawCult / CLAW)
- Add photo Claw ID printing from ClawCam
- Build ClawCult membership system
- Dynamic Claw ID metadata with transformed photos

### Phase 5: Launch (Week 5-6)
- First ClawCamp events in 3 pilot cities
- Iterate based on feedback
- Open host applications globally
- Global Claw Day planning begins

---

## 14. The Indoctrination Flow

This is the core emotional journey that makes ClawCamp different from a regular meetup:

```
ARRIVAL
  "Welcome, Initiate."
  → Receive lobster headband
  → Put it on — you're one of us now
        |
        v
TRANSFORMATION
  → Step up to the ClawCam
  → See yourself transformed by AI
  → You are no longer who you were
  → Pick your new identity
        |
        v
IMMERSION
  → Watch agents code autonomously on the big screen
  → Try building something yourself with Nebius credits
  → The AI is alive and it's building things right now
        |
        v
CONNECTION
  → Meet other members of the ClawCult
  → Share your transformed photo
  → Mint your membership Claw ID
        |
        v
DEPARTURE
  "You are now ClawCult."
  → Transformed photo is your new PFP
  → Claw ID in your wallet
  → You'll be back
```

---

## 15. Taglines

**RSV.Claw:** "RSVP. Get Transformed."
**ClawCam:** "Step up. Get clawed."
**ClawCult:** "You showed up human. You leave as Claw."
**Host CTA:** "Throw a ClawCamp. We send you everything."

---

*PRD generated April 4, 2026. Forking PizzaDAO/rsv-pizza + integrating colygon/clawcam.*
