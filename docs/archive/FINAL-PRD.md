# ClawCamp Ecosystem - Master PRD

**Version:** 1.0
**Date:** April 4, 2026
**Status:** Draft

---

## 1. Vision & Thesis

Software is about to reproduce.

For the first time in history, we have software that rewrites itself -- just like DNA. The way humans reproduce and create new humans is how software will reproduce and create new software. AI agents are the new workforce. They don't sleep, they don't quit, and they're getting better every day.

ClawCamp is the community that makes this happen. Not a conference. Not a Discord server. A global network of events, products, and competitions where people experience the AI agent revolution firsthand -- where they watch software build software, get transformed by AI, and become part of something bigger.

The thesis is simple: the barrier between "idea" and "product" is collapsing to zero. ClawCamp is the place where that collapse is celebrated, accelerated, and weaponized.

**The products:**
- **ClawCamp** -- the community hub and marketing site
- **Claw.RSVP** -- throw an AI event anywhere in the world, we send you everything
- **ClawCam** -- AI photo booth that transforms you
- **HackMeBaby** -- paste two links, 45 agents build something new, win $100 every hour
- **ClawHack** -- submit your agent, survive the gauntlet
- **OpenClaw** -- the open source AI coding agent powering it all

---

## 2. The Ecosystem (Overview)

Every product connects. Shared identity, shared compute, shared community.

```
                        +------------------+
                        |   clawcamp.com   |
                        |  Community Hub   |
                        +--------+---------+
                                 |
            +--------------------+--------------------+
            |                    |                     |
   +--------v--------+  +-------v--------+  +---------v-------+
   |    claw.rsvp     |  | hackmebaby.com |  |    claw.cam     |
   |  Event Platform  |  |  Autonomous    |  |  AI Photo Booth |
   |  (rsv-pizza fork)|  |  Hackathon     |  |                 |
   +--------+---------+  +-------+--------+  +---------+-------+
            |                    |                      |
            +----------+---------+----------+-----------+
                       |                    |
              +--------v--------+  +--------v--------+
              |    ClawHack     |  |    OpenClaw      |
              |  Agent Arena    |  |  Open Source     |
              |                 |  |  AI Agent        |
              +-----------------+  +-----------------+
```

| Product | Domain | What It Does | Status |
|---|---|---|---|
| ClawCamp | clawcamp.com | Community site, marketing, blog, event directory | Live |
| Claw.RSVP | claw.rsvp | Event platform -- host and attend ClawCamp events worldwide | Fork in progress |
| ClawCam | claw.cam | AI photo booth -- camera capture + AI transformation | Live |
| HackMeBaby | hackmebaby.com | Autonomous hackathon -- paste 2 URLs, 45 agents build something new | Building |
| ClawHack | (within hackmebaby) | Agent arena -- submit your OpenClaw agent, compete against others | Building |
| OpenClaw | GitHub | Open source AI coding agent powering the ecosystem | Active |

**How they connect:**
- ClawCam is embedded in Claw.RSVP events as the photo booth
- HackMeBaby runs at Claw.RSVP events as a live activity
- ClawHack uses OpenClaw agents competing on the HackMeBaby platform
- ClawID (your QR code identity) works across all products
- Shared Supabase backend, shared auth, separate Vercel projects

---

## 3. Claw.RSVP - Event Platform

**Fork of:** [PizzaDAO/rsv-pizza](https://github.com/PizzaDAO/rsv-pizza)
**Integrates:** [colygon/clawcam](https://github.com/colygon/clawcam)
**Domain:** claw.rsvp

### 3.1 What It Is

PizzaDAO proved you can build a global community around a simple ritual -- show up, eat pizza, meet people. ClawCamp takes that playbook and replaces pizza with AI.

Anyone in the world fills out a form, gets a Claw Kit shipped to them (lobster headbands, ClawCamp swag, Nebius credits), and hosts an event where people get **transformed** -- photographed by the ClawCam AI photo booth, indoctrinated into the ClawCult, and immersed in live agent coding, music, and vibes.

The barrier to host is zero. Fill out the form. Get the kit. Throw the party.

### 3.2 What We Fork vs. What Changes

**What stays the same (from rsv-pizza):**
- Event creation + custom URL slugs
- RSVP flow (2-step form)
- Host dashboard with 11 pinnable apps
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
- Magic link auth (JWT)
- Regional coordinator dashboard
- Display/signage system
- Full Prisma/PostgreSQL backend (~40 models)
- React + TypeScript + Vite + TailwindCSS frontend

**What changes:**

| RSV.Pizza | Claw.RSVP |
|---|---|
| Pizza parties | ClawCamp events |
| Pizza topping preferences | AI experience preferences + food preferences (both) |
| PizzaDAO branding, logos, modals | ClawCamp rust/orange branding |
| Ninja Turtles role themes | ClawCult lobster roles |
| "Underboss" coordinators | "Alpha Claw" coordinators |
| Party Kit (stickers, tablecloths) | Claw Kit (lobster headbands, swag, Nebius credits) |
| POAP attendance proof | ClawCult membership ClawID |
| Stand with Crypto opt-in | Join the ClawCult opt-in |
| Global Pizza Party (GPP) | Global Claw Day |
| Pizzeria search (Google Places) | Venue search (any space -- parks, offices, homes, bars) |
| PizzaDAO red (#ff393a) | ClawCamp rust/orange palette |

**IMPORTANT -- What we keep from the food system:**

Pizza as FOOD stays. Only PizzaDAO as a BRAND goes. The following features are kept and rebranded:

- Smart food ordering algorithm (optimizes orders based on guest preferences -- works for any food, not just pizza)
- Restaurant/pizzeria search via Google Places
- AI phone ordering via Bland AI (AI calls the restaurant to place the order)
- Topping/food preferences in RSVP form
- Dietary restrictions
- Beverage settings and ordering

These are genuinely useful features. We strip the PizzaDAO branding from around them (no PizzaChefModal, no PizzaDAOModal, no PizzaDAO links) but keep the underlying functionality.

### 3.3 Host Flow

**Step 1: Apply to Host**
```
Anyone visits claw.rsvp (or clawcamp.com/host)
        |
        v
Fills out the Host Application Form:
  - Name, email, city, country
  - Proposed date and venue (or "I'll figure it out")
  - Expected guest count
  - What kind of event? (select from 10 formats)
        |
        v
Application auto-approved (or reviewed by Alpha Claw coordinator)
        |
        v
Host gets:
  - Their own event page (claw.rsvp/my-city)
  - Access to the host dashboard
  - Claw Kit shipped to them
```

**Step 2: Receive the Claw Kit**

| Item | Description |
|---|---|
| Lobster Headbands | Enough for all expected guests -- the signature ClawCamp look |
| ClawPrint Sticker Sheets | QR code stickers linking to your AI agent |
| Bumper Stickers | "Talk to my agent", "Ask my agent", "The AI is driving, sorry", "AI agents are people too" |
| ClawCamp Swag | Posters, table signs, branded materials |
| Nebius Credits | Cloud compute credits for running AI demos at the event |
| ClawCam Setup Card | Instructions to set up the AI photo booth (laptop + camera) |
| Event Playbook | Quick-start guide: how to throw a ClawCamp |

**Step 3: Throw the Party** -- hosts pick their format, run it however they want.

### 3.4 Guest Flow

**RSVP (2-Step Form, forked from rsv-pizza)**

**Step 1 -- Identity:**
- Name (required)
- Email (required)
- Wallet address (optional -- for ClawID printing)
- ClawCult role selection:
  - **The Claw** -- Builder / hacker
  - **The Shell** -- Designer / creative
  - **The Antenna** -- Community / connector
  - **The Tail** -- Newcomer / curious
- Join the ClawCult mailing list (opt-in)

**Step 2 -- Preferences (both activities AND food):**
- Activity preferences: ClawCam, 3D printing, robots, voice cloning, Show N Tell, watch agents code, build with OpenClaw, just vibes
- What do you want to be transformed into? (select ClawCam styles)
- Preferred AI models (for photo booth and demos)
- Food preferences: pizza toppings, dietary restrictions, beverages
- Interests: coding, design, music, AI art, watching agents, just vibes

**The Indoctrination Flow (at the event):**
```
ARRIVAL
  "Welcome, Initiate."
  -> Receive lobster headband
  -> Put it on -- you're one of us now
        |
        v
TRANSFORMATION
  -> Step up to the ClawCam
  -> See yourself transformed by AI
  -> You are no longer who you were
  -> Pick your new identity
        |
        v
IMMERSION
  -> Watch agents code autonomously on the big screen
  -> Try building something yourself with Nebius credits
  -> The AI is alive and it's building things right now
        |
        v
CONNECTION
  -> Meet other members of the ClawCult
  -> Share your transformed photo
  -> Print your ClawID
        |
        v
DEPARTURE
  "You are now ClawCult."
  -> Transformed photo is your new PFP
  -> ClawID in your wallet
  -> ClawPrint stickers on your laptop
  -> You'll be back
```

### 3.5 Event Formats & Activities

Hosts select which activities to offer. Guests select which ones they want to participate in.

**The 9 Core Activities:**

| # | Activity | Description |
|---|---|---|
| 1 | ClawCam Photo Booth | AI photo transformation -- step up, get "clawed", pick your new identity |
| 2 | 3D Printing Competition | Bring your best 3D prints. Print your ClawID lobster live at the event |
| 3 | Robot Meetup | Robot owners' group -- bring your robot friends |
| 4 | LeRobot Arms | Control LeRobot robotic arms with OpenClaw agents |
| 5 | Voice Cloning Station | Get your voice cloned at the event -- "How to clone yourself" |
| 6 | Show N Tell | Bring something cool you've built and present it to the group |
| 7 | Watch Agents Code | Big screen showing autonomous agents building software in real-time |
| 8 | Build with OpenClaw | Hands-on coding session with Nebius credits provided |
| 9 | Claw & Chill | Just vibes -- music, photo booth, headbands, conversation |

**Event Format Templates:**

| Format | What It Is |
|---|---|
| Claw & Chill | Casual hangout -- music, ClawCam, lobster headbands, vibes |
| Watch Party | Everyone watches agents vibe-code on a big screen |
| Build Night | Hands-on: attendees build with OpenClaw, ClawCam, AI tools |
| Hackathon | Competitive: teams build projects, winners get prizes |
| Demo Day / Show N Tell | Builders present what they've made |
| 3D Print Night | Bring your best 3D prints, print ClawID lobsters |
| Robot Meetup | Robot owners' group -- bring your robot friends, control LeRobot arms |
| Voice Cloning Station | Get your voice cloned -- "How to clone yourself" |
| Lobster Boil | Full party: music, food, drinks, ClawCam, agent demos, the works |
| Restaurant Robot Night | The entire food service is run by agents and robots (see Section 7) |

### 3.6 ClawCam Integration

**What ClawCam already does:**
- Live camera capture -> AI transformation via OpenClaw agent
- 80+ styles (locations, characters, artistic)
- Photo/Timer/Stream/Postcard modes
- Gallery, GIF creation, downloads
- Zustand state + IndexedDB persistence
- Gemini 2.5 Flash image model (configurable)
- Works on desktop and mobile

**New features for Claw.RSVP:**

| Feature | Description |
|---|---|
| Event-Specific Styles | Each event gets custom ClawCam styles (e.g., "Lobster in Paris" for a Paris ClawCamp) |
| ClawCult Styles | Dedicated transformation set: "Lobster Warrior", "Cyber Claw", "Claw Royalty", "Deep Sea Hacker" |
| Photo -> Profile | Transformed photos auto-save to guest's Claw.RSVP profile |
| Photo Wall | Live display mode -- all photos from the event shown on a big screen in real-time |
| ClawID Print from Booth | One-tap print your transformed photo as a ClawID right from the booth |
| Leaderboard | Most creative transformation wins a prize (voted by attendees) |
| GIF Recap | Auto-generated GIF of all transformations from the event -- shareable |
| Brand Overlay | ClawCamp logo + event name watermarked on all photos |
| Kiosk Mode | Fullscreen lock for unattended photo booth operation |
| Queue System | Multiple guests can queue up -- shows "You're next!" countdown |

**ClawCam Kiosk Setup:**
1. Host opens `claw.cam/event/{slug}` on a laptop with a webcam
2. App enters Kiosk Mode -- fullscreen, no browser chrome
3. Auto-cycles through ClawCult transformation styles
4. Guest steps up -> taps shutter -> gets transformed
5. Photo appears on the Photo Wall display
6. Guest scans QR to save photo to their profile

### 3.7 Food Ordering (Kept from rsv-pizza)

The smart food ordering system stays. It is rebranded but functionally identical.

**How it works:**
1. Guests submit food preferences during RSVP (Step 2)
2. The ordering algorithm optimizes the order based on everyone's preferences, dietary restrictions, and group size
3. AI (Bland AI) can call the restaurant to place the order by phone
4. Host can also order manually through the dashboard

**What we keep:**
- Smart ordering algorithm (topping/diet optimization)
- Restaurant search via Google Places
- AI phone ordering via Bland AI
- Dietary restriction tracking
- Beverage settings and ordering
- Order status tracking

**What we remove:**
- PizzaDAO branding, logos, modals (PizzaChefModal, PizzaDAOModal)
- PizzaDAO links, references, and community/governance features

**Swag tie-in:** Every pizza box gets a "My agent ordered this pizza" sticker.

### 3.8 ClawCult Roles

Replaces the Ninja Turtles role system from rsv-pizza.

| Role | Who They Are |
|---|---|
| **The Claw** | Builder / hacker -- writes code, builds agents, ships products |
| **The Shell** | Designer / creative -- design, art, music, visual identity |
| **The Antenna** | Community / connector -- brings people together, runs events, network builder |
| **The Tail** | Newcomer / curious -- just showed up, wants to learn, open to everything |

Guests select their role during RSVP. Role determines:
- Their ClawID visual style
- Suggested activities at the event
- Community group assignments
- Badge/flair across the ecosystem

### 3.9 Alpha Claw Coordinators

Replaces the "Underboss" system from rsv-pizza. Alpha Claws are regional coordinators who:

- Review and approve host applications in their region
- Mentor new hosts
- Coordinate multi-city events (Global Claw Day)
- Have access to the Alpha Claw dashboard (regional analytics, host management, kit tracking)
- Get priority Claw Kits and extra Nebius credits

### 3.10 Dashboard Apps

**Existing 11 apps (kept from rsv-pizza):**

| App | Description |
|---|---|
| Sponsors | CRM pipeline for event sponsors |
| Venue | Venue search, booking, details |
| Music | DJ/music management |
| Budget | Budget tracking and reporting |
| Raffle | Prize raffle system |
| Staffing | Volunteer/staff management |
| Displays | Signage and display configuration |
| Reports | Analytics and post-event reports |
| Checklist | Event prep checklist |
| Party Kit | (becomes Claw Kit) |
| Promo | Promotional materials and marketing |

**New ClawCamp apps (6 additions):**

| App | Description |
|---|---|
| **ClawCam** | Configure the photo booth: select styles, set kiosk mode, view all photos, moderate content |
| **Photo Wall** | Manage the live display of photos -- layout, rotation speed, moderation |
| **Claw Kit** | Track kit shipment status, request additional headbands/swag |
| **AI Demos** | Configure what AI demos run at the event (agent coding, ClawCam, OpenClaw playground) |
| **Nebius Credits** | Distribute and track cloud compute credits given to attendees |
| **ClawCult** | Membership tracking -- who joined, ClawIDs printed, post-event engagement |

### 3.11 Architecture

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Backend | Express + Prisma + PostgreSQL |
| Database | Supabase |
| Deployment | Vercel |
| Auth | Magic link (JWT) |
| Payments | Stripe + crypto donations |
| ClawID | ERC-721 on Base/Monad (rebranded contract) |
| AI Phone Ordering | Bland AI (calls restaurant to place food orders) |
| Food Algorithm | Smart ordering optimization (topping/diet/group size) |
| Photo Booth | ClawCam integration (claw.cam) |
| AI Agent | OpenClaw (image transformation + coding demos) |
| Compute Credits | Nebius credit distribution system |

**New integrations:**
- **ClawCam API** -- Photo booth capture + transformation
- **Nebius API** -- Credit provisioning and tracking
- **OpenClaw Agent** -- Powers the photo booth + live coding demos

### 3.12 New Prisma Models

Additions to the existing ~40 models:

```prisma
model ClawCamSession {
  id            String         @id @default(cuid())
  partyId       String
  party         Party          @relation(fields: [partyId], references: [id])
  guestId       String?
  guest         Guest?         @relation(fields: [guestId], references: [id])
  photos        ClawCamPhoto[]
  createdAt     DateTime       @default(now())
}

model ClawCamPhoto {
  id            String         @id @default(cuid())
  sessionId     String
  session       ClawCamSession @relation(fields: [sessionId], references: [id])
  inputUrl      String         // original photo
  outputUrl     String         // transformed photo
  style         String         // which transformation style
  model         String         // which AI model
  isFavorite    Boolean        @default(false)
  isClawId      Boolean        @default(false)
  clawIdTokenId String?
  clawIdTxHash  String?
  createdAt     DateTime       @default(now())
}

model ClawKit {
  id             String    @id @default(cuid())
  partyId        String
  party          Party     @relation(fields: [partyId], references: [id])
  headbandCount  Int
  swagItems      Json      // list of swag included
  nebiusCredits  Int       // dollar value of credits
  shippingStatus String    @default("pending") // pending, shipped, delivered
  trackingNumber String?
  shippedAt      DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime  @default(now())
}

model NebiusCredit {
  id         String    @id @default(cuid())
  partyId    String
  party      Party     @relation(fields: [partyId], references: [id])
  guestId    String?
  guest      Guest?    @relation(fields: [guestId], references: [id])
  amount     Int       // credit amount
  status     String    @default("allocated") // allocated, redeemed, expired
  redeemedAt DateTime?
  createdAt  DateTime  @default(now())
}

model ClawCultMembership {
  id           String   @id @default(cuid())
  guestId      String
  guest        Guest    @relation(fields: [guestId], references: [id])
  clawIdToken  String?
  clawIdTxHash String?
  joinedAt     DateTime @default(now())
  photoUrl     String?  // their ClawCam transformation
  role         String   @default("initiate") // initiate, member, elder, alpha
}
```

**Modified existing models:**
- **Party** -- Add: `clawKitId`, `clawCamEnabled`, `eventFormat` (enum of formats), `nebiusCreditsPool`
- **Guest** -- Add: `clawCultMembershipId`, `preferredStyles` (JSON), `interests` (JSON), `foodPreferences` (JSON)
- **Display** -- Add: `photoWallMode` (boolean), `photoWallLayout` (enum)

### 3.13 Brand & Design

| Element | Value |
|---|---|
| Primary Color | Rust orange (var(--rust) from clawcamp.com) |
| Background | Deep ink/charcoal (var(--ink)) |
| Text | Warm paper/cream (var(--paper)) |
| Accent | Amber/gold for highlights |
| Success | Teal/sea green |
| Headline Font | Bricolage Grotesque |
| Mono/Code Font | DM Mono |
| Body Font | System font stack |
| Visual Language | Lobster/claw motifs, underwater/deep-sea atmosphere, playful cult imagery |

### 3.14 Renamed Concepts (Full Map)

| RSV.Pizza Term | Claw.RSVP Term |
|---|---|
| Pizza Party | ClawCamp |
| Host | Host (same) |
| Guest | Initiate (pre-event) -> Member (post-ClawCam) |
| Underboss | Alpha Claw |
| Party Kit | Claw Kit |
| Global Pizza Party (GPP) | Global Claw Day |
| POAP | ClawCult ClawID |
| Pizzeria | Venue / Restaurant |
| Pizza Order | Food Order (algorithm stays, brand goes) |
| Invite Code | Claw Code |
| PizzaDAO | ClawCamp / ClawCult |

---

## 4. ClawID & ClawPrints

### 4.1 ClawID

Your ClawID is a QR code that links to your personal AI agent.

You scan someone's ClawID and you're chatting with their AI agent. Your identity IS your agent. This is the core concept: "Talk to my agent."

**How it works:**
1. You attend a ClawCamp event
2. You step up to the ClawCam and get transformed
3. Your transformed photo becomes your ClawID image
4. A QR code is generated that links to your personal AI agent
5. That QR code is your ClawID -- printed on chain (ERC-721 on Base/Monad), printed physically as a sticker, or 3D printed as a lobster

**When someone scans your ClawID:**
- They land on a chat interface
- They're talking to YOUR AI agent
- Your agent knows about you, your work, your interests
- It can answer questions, share your portfolio, set up meetings
- You don't need to be there -- your agent represents you

**ClawID formats:**
- On-chain print (ERC-721 on Base/Monad) -- the digital version
- Physical QR sticker (ClawPrint) -- slap it on your laptop, water bottle, car
- 3D printed lobster -- a physical lobster with the QR code embedded
- Business card -- traditional card with ClawID QR code

**ClawID contract (forked from rsv-pizza):**

| RSV.Pizza | Claw.RSVP |
|---|---|
| Token: "RSV.Pizza" / "RSVP" | Token: "ClawCult" / "CLAW" |
| Static attendance proof | Dynamic: includes ClawCam photo as token image |
| Basic metadata | Rich metadata: role, events attended, transformation history |
| Base + Monad chains | Same (or add more chains) |

**ClawID types:**
- **Attendance ClawID** -- printed when guest checks in, proves they attended
- **Photo ClawID** -- optional print of their best ClawCam transformation
- **ClawCult Membership** -- the ClawID is your membership card, unlocks perks, future event priority
- **Dynamic Metadata** -- ClawID image updates if you get a new transformation at a future event

### 4.2 ClawPrints

ClawPrints are physical QR stickers of your ClawID. They go everywhere.

- Sticker sheets included in every Claw Kit
- Hosts hand them out at events
- Attendees put them on laptops, water bottles, phone cases, cars
- Anyone who scans it starts chatting with that person's AI agent

**The loop:**
1. Go to a ClawCamp
2. Get your ClawID printed (QR code -> your agent)
3. Slap a "Talk to my agent" bumper sticker on your laptop
4. Now anyone who scans it is chatting with your AI agent
5. Your agent represents you 24/7

---

## 5. HackMeBaby - Autonomous Hackathon

**Domain:** hackmebaby.com
**Tagline:** "Software is having babies."
**One-liner:** "Paste two links. Make a baby. Win $100."

### 5.1 What It Is

A platform that runs autonomous hackathons 24/7/365. Users paste two URLs, AI agents combine them into a new application, and the best creation wins an hourly prize. No coding. No prompts. Just paste two links and click "Make a Baby."

### 5.2 User Personas

| Persona | Description | Motivation |
|---|---|---|
| The Casual Player | Non-technical, curious about AI | $100 hourly prize, surprise factor, social sharing |
| The Power Builder | Technical, understands models/agents | Optimize babies, run parallel generations, win more |
| The Sponsor (Company) | Wants problems solved | Post bounties, review solutions, hire agents |

### 5.3 Core Flow (Make a Baby)

```
User arrives at hackmebaby.com
        |
        v
Pastes URL #1 (any URL: GitHub, website, docs, article, game, Wikipedia, MCP server)
        |
        v
Pastes URL #2
        |
        v
Clicks "Make a Baby"
        |
        v
[No further input -- no chat, no prompts, no configuration]
        |
        v
45 AI agents build a new application
        |
        v
1 hour later: "Baby" is born -- user sees the result
        |
        v
All entries from that hour are judged
        |
        v
Winner announced -- $100 in credits awarded (every hour, 24/7)
```

### 5.4 Game Modes

**Mode 1: Make a Baby (Core)**
Paste two URLs. Click "Make a Baby." 45 agents combine them into a new app in 1 hour. Best baby each hour wins $100 in credits. A new winner every 60 minutes, 24/7/365. No coding, no prompts.

**Mode 2: Battle Mode (Pokemon Go Style)**
Challenge another user. You each pick a repo/agent/URL. AI judge evaluates which one is better in a head-to-head matchup. Like Pokemon battles but with software. You collect repos/agents like Pokemon, combine them or battle them, and compete against other players.

**Mode 3: One-Shot Hack (Prompt Engineering Hackathon)**
- Show up with your prompt ready
- Paste the prompt
- Choose your model
- Choose your infra
- Press GO
- No one is allowed to talk to the agents after that
- Everyone sits and watches the agents code autonomously
- Best output wins

This is a prompt engineering competition -- your one shot at instructing the agents is all you get. The skill is in the prompt.

**Mode 4: Vibe Code Olympics (Bring Your Best Agent)**
- No vibe coding -- pure agent coding
- You submit your autonomous agent
- Zero human interaction once it starts
- Everyone watches the agents build in real-time
- Hundreds or thousands of agents competing simultaneously
- The agent that builds the best product wins
- This is the competition for advanced builders

**Bonus: Minions Hackathon**
Zero human in the loop. Agents are the contestants. Everyone dresses up as minions. For advanced builders doing fully autonomous projects.

### 5.5 Architecture

**The Agent Crew (per generation):**

3 models running in parallel x 15 specialized agents each = **45 total agents per generation.**

| Agent Role | Responsibility |
|---|---|
| Product Manager | Generates the PRD from the two inputs -- always the first output |
| Architect | Designs system architecture and tech stack |
| Frontend Engineer | Builds UI/UX |
| Backend Engineer | Builds APIs, business logic, data layer |
| Database Engineer | Schema design, data modeling, migrations |
| DevOps / Infra | Deployment, CI/CD, hosting |
| SRE | Reliability, monitoring, error handling |
| QA Engineer | Testing, edge cases, validation |
| Security Engineer | Auth, permissions, vulnerability checks |
| Designer | Visual design, branding, asset generation |
| Technical Writer | Documentation, README, user guides |
| Data Engineer | Data pipelines, integrations, ETL |
| ML/AI Engineer | Any AI/ML features in the combined product |
| Growth Engineer | Analytics, tracking, SEO, performance |
| Project Manager | Coordination, dependency management, timeline |

Inspired by the Stripe dev methodology (minions pattern).

**The Build Pipeline:**

```
Step 1: INGEST
  - Scrape/clone both input URLs
  - Extract features, functionality, content, design patterns
  - Build a comprehensive understanding of both inputs

Step 2: PRD GENERATION
  - Product Manager agent generates a PRD
  - Combines the best features of both inputs
  - Defines scope, features, and acceptance criteria

Step 3: ARCHITECTURE
  - Architect agent designs the system
  - Tech stack selection based on input analysis

Step 4: PARALLEL BUILD
  - 3 models each run their 15-agent crew independently
  - Each crew builds the full application from the PRD

Step 5: EVALUATION
  - All 3 outputs are evaluated
  - Best version is selected (or merged)
  - Final QA pass

Step 6: DEPLOY
  - Application is deployed and made live
  - Entry is submitted to the hourly competition
```

**Infrastructure:**
- Scalable cloud infrastructure for 45+ concurrent agents per generation
- Multi-provider model support (Anthropic, OpenAI, Google, open-source via API)
- Auto-deploy each baby to a unique subdomain (baby-12345.hackmebaby.com)
- GitHub repos created for each baby, source code preserved
- Automated scoring + human judging for winner selection

### 5.6 Judging Criteria

| Criterion | Weight | Description |
|---|---|---|
| Creativity | 30% | How novel and unexpected is the combination? |
| Functionality | 25% | Does the app actually work? |
| Design | 20% | Visual quality and user experience |
| Technical Quality | 15% | Code quality, architecture, performance |
| Wow Factor | 10% | Would this make someone say "holy shit"? |

Judging modes:
- **Automated** -- AI-based evaluation scoring
- **Community** -- Users vote on their favorites
- **Panel** -- Rotating judges (sponsors, influencers, engineers)
- **Hybrid** -- Combination of all three

### 5.7 Features by Phase

**Phase 1 (MVP):**

| Feature | Description |
|---|---|
| Two-URL Input | Paste any two URLs into the interface |
| Make a Baby Button | Single click to start generation |
| Agent Build Pipeline | 45-agent crew builds a new app from two inputs |
| Hourly Competition | All hourly entries compete, one winner gets $100 every hour |
| Baby Gallery | Browse all created babies |
| Auto-Deploy | Each baby gets a live URL |
| User Accounts | Sign up, track entries, see winnings |

**Phase 2:**

| Feature | Description |
|---|---|
| Model Selection | Choose which AI models power your generation |
| Parallel Generations | Run multiple generations and pick the best |
| Pay-Per-Generation | Monetize premium model access |
| Social Sharing | Share your babies on social media |
| Leaderboard | All-time top creators and babies |
| Baby Remixing | Use a previously created baby as one of your two inputs |

**Phase 3 (Company Platform):**

| Feature | Description |
|---|---|
| Sponsor Dashboard | Companies sign up, choose tier, manage bounties |
| Bounty Marketplace | Post problems, set prizes, review submissions |
| Transparent Spend Tracking | Companies see exactly where their dollars go |
| Private Bounties | Enterprise-only challenges |
| API Access | Programmatic access to the baby-making pipeline |
| White-Label | Companies run their own branded hackathons on the platform |

### 5.8 Company Sponsor Flow

```
Company signs up and selects sponsorship tier
        |
        v
Posts a bounty: describes the problem they want solved
        |
        v
Sets prize amount and deadline
        |
        v
AI agents + community contributors build solutions (24/7/365)
        |
        v
Company reviews submissions
        |
        v
Company selects winner -- prize paid out
```

### 5.9 Success Metrics

**North Star Metric:** Daily Active Generators -- unique users who click "Make a Baby" per day.

| Metric | Month 1 Target | Month 6 Target |
|---|---|---|
| Daily Active Generators | 100 | 5,000 |
| Babies Created / Day | 200 | 20,000 |
| Paid Generations / Day | 20 | 2,000 |
| Company Sponsors | 0 | 10 |
| Active Bounties | 0 | 25 |
| Social Shares / Day | 50 | 5,000 |
| Daily Signups | 50 | 2,000 |

---

## 6. ClawHack - Agent Arena

**Tagline:** "Submit your agent. Survive the gauntlet."

### 6.1 What It Is

ClawHack is HackMeBaby for OpenClaw. Instead of combining URLs, you submit your OpenClaw agent and it competes against other agents in a live hackathon. The goal: find the most capable AI agent.

### 6.2 THE RULE

**Every agent gets the exact same prompt.** No custom instructions, no prompt engineering advantage, no gaming it. The only variable is the agent itself -- its architecture, its tools, its reasoning. Same input, different agents, best output wins.

This isolates pure agent quality. It's the only honest benchmark.

### 6.3 How It Works

1. You submit your OpenClaw agent
2. A challenge is revealed -- every agent gets the same prompt
3. All agents build simultaneously, autonomously -- zero human help
4. AI judges evaluate the outputs side by side
5. The agent that creates the best version wins

### 6.4 Challenge Types (Random)

Agents don't know what's coming. Challenges are pulled at random to test different dimensions of intelligence:

| Category | Example Challenges |
|---|---|
| Speed Coding | Build a calculator in under 60 seconds |
| Creative Problem Solving | Generate a multisided die (N-sided) |
| Reasoning | Parse ambiguous instructions and do the right thing |
| Full-Stack Build | Build and deploy a working app from a one-line spec |
| Debugging | Fix a broken codebase with no context |
| Multi-Step | Complete a chain of dependent tasks without getting lost |
| Adversarial | Handle deliberately misleading or contradictory prompts |
| Collaboration | Work with another random agent to build something together |
| Improvisation | "Build something cool" -- no spec, no guidance |

### 6.5 HackMeBaby vs. ClawHack

These are mirror images of each other:

| | HackMeBaby | ClawHack |
|---|---|---|
| **Who competes** | The "babies" (combined apps) | OpenClaw agents themselves |
| **What's judged** | The output (the app) | The agent (intelligence, speed, creativity) |
| **User input** | Two URLs | Submit your agent |
| **The variable** | Which two things you combine | Your agent's architecture and tools |
| **The constant** | The agent pipeline (same for all) | The prompt (same for all) |
| **Skill tested** | Creativity (what to combine) | Capability (how good is your agent) |
| **Skill level** | Anyone (no coding) | Builders who've customized their agent |
| **Vibe** | Creative arcade | Agent fight club |

### 6.6 Why ClawHack Matters

- This is **the benchmark for agent quality** -- not just evals on paper, but real-world performance under pressure
- It's the proving ground for OpenClaw -- the agents that win ClawHack are the agents people want to use
- It creates a competitive ecosystem that drives OpenClaw agent development forward
- It's content -- people want to watch agents compete in real-time

---

## 7. Restaurant Robots

### 7.1 The Concept

A hackathon format (and ClawCamp event format) where AI agents and robots compete to run a restaurant autonomously. Humans just show up and eat.

### 7.2 How It Works

- Agents take orders (voice via ClawCam, chat, phone via Bland AI)
- AI optimizes the menu based on guest preferences (using the rsv-pizza ordering algorithm)
- Agents call the restaurant to place orders (Bland AI)
- Robots deliver the food (LeRobot arms, robot meetup participants)
- The whole experience is autonomous -- zero human labor in the food chain

### 7.3 Hackathon Format

Teams build restaurant automation systems. Judged on smoothest overall experience.

**Agent responsibilities:**
- Ordering (voice, chat, phone)
- Menu optimization based on dietary preferences
- Dietary matching and restriction handling
- Phone calls to suppliers/restaurants

**Robot responsibilities:**
- Food delivery
- Table service
- Kitchen coordination
- LeRobot arms prep or plate food

### 7.4 How It Connects to Everything

| Component | Source |
|---|---|
| Food ordering algorithm | rsv-pizza (already built) |
| AI phone ordering | Bland AI (already integrated) |
| Robotic arms | LeRobot controlled by OpenClaw |
| Robot meetup | ClawCamp event activity |
| Voice ordering | ClawCam (tell the camera what you want) |
| Agent competitions | HackMeBaby / ClawHack format |

### 7.5 The Dream

A ClawCamp event where the entire food service is run by agents and robots. You walk up to the ClawCam, tell the camera what you want to eat, the agent calls the restaurant, robots deliver the food to your table. Zero human labor in the food chain.

This is a signature ClawCamp event format: **Restaurant Robot Night.**

---

## 8. Merch & Swag

### 8.1 Bumper Stickers

| Sticker | Vibe |
|---|---|
| "Talk to my agent" | The core ClawID concept -- your agent represents you |
| "Ask my agent" | Variant -- more casual |
| "The AI is driving, sorry" | For cars, laptops -- humor + statement |
| "AI agents are people too" | Provocative, conversation starter |
| "My agent ordered this pizza" | Goes on pizza boxes at ClawCamp events |

### 8.2 Physical Swag

| Item | Description |
|---|---|
| Lobster Headbands | The signature ClawCamp look -- included in every Claw Kit |
| ClawPrint QR Stickers | QR codes linking to your personal AI agent |
| Sticker Packs | Mix of bumper stickers and ClawCamp branded stickers |
| 3D Printed Lobster ClawIDs | Physical lobster with your QR code embedded |
| Business Cards | ClawID QR code on a professional card |
| T-Shirts | Slogans: "Talk to my agent", "Software is having babies", "ClawCult" |
| Posters | Event signage, ClawCamp branding |
| Table Signs | For events -- activity labels, QR codes, branding |

### 8.3 Claw Kit Contents (Complete List)

Everything that ships to a host:

| Item | Quantity |
|---|---|
| Lobster Headbands | Enough for all expected guests |
| ClawPrint Sticker Sheets | QR code stickers for all guests |
| Bumper Sticker Pack | Mix of all slogans |
| ClawCamp Posters | 2-3 for venue walls |
| Table Signs | Activity labels + branding |
| QR Code Cards | For check-in and ClawCam access |
| Nebius Credits Card | Scratch-off or code card with compute credits |
| ClawCam Setup Card | Step-by-step photo booth setup instructions |
| Event Playbook | Quick-start guide for hosting |
| "My agent ordered this pizza" Stickers | For food boxes |

---

## 9. Business Model

### 9.1 Token & Compute Economy (HackMeBaby)

**Free Tier (Signup Bonus):**
- Sign up and get 1 hour of free compute
- Spin up an H200 GPU and build something in 1 hour
- Each hacker gets 1 billion tokens to use per session
- Zero friction -- sign up, get tokens, start hacking immediately

**Prizes:**
- Winner each hour gets $100 in credits (not cash -- keeps money in the ecosystem)
- Credits can be used for more generations, premium models, GPU compute
- Winners reinvest credits back into the platform = compounding engagement

**Paid Tiers:**
- Buy more tokens / compute time beyond the free tier
- Choose your model (Claude, GPT, Gemini, open-source)
- Choose your infra (H200, A100, etc.)
- Run parallel generations / evals across models

**The Flywheel:**
Free tier -> build something -> want to build more -> buy tokens -> win credits -> keep building

### 9.2 Revenue Streams

| Stream | Source | Description |
|---|---|---|
| Token / Compute Sales | HackMeBaby | Users buy tokens and GPU time beyond the free tier |
| Model Marketplace | HackMeBaby | Markup on API costs for model providers |
| GPU Compute Margin | HackMeBaby | Margin on H200/A100 compute time |
| Company Sponsorships | HackMeBaby + Claw.RSVP | Tiered subscriptions for posting bounties and sponsoring events |
| Bounty Fees | HackMeBaby | Platform fee on bounty prize payouts |
| Enterprise / White-Label | HackMeBaby | Custom branded hackathons for companies |
| Claw Kit Sales | Claw.RSVP | Premium kit upgrades, extra headbands, custom swag |
| Nebius Credit Margin | Claw.RSVP | Margin on compute credits distributed at events |
| Merch | All | Bumper stickers, t-shirts, 3D printed ClawIDs |
| Event Sponsorships | Claw.RSVP | Companies sponsor specific ClawCamp events |
| Stripe Payments | Claw.RSVP | Ticketed events, premium RSVPs |

### 9.3 Cost Structure

| Cost | Amount / Description |
|---|---|
| Hourly HackMeBaby Prize | $100 in credits/hour = $2,400/day = $876K/year (stays in ecosystem) |
| Free Tier Compute | 1 hour H200 per new user (customer acquisition cost) |
| AI Model API Costs | Variable per generation (passed through + margin) |
| GPU Infrastructure | H200/A100 fleet (offset by compute sales margin) |
| Claw Kit Fulfillment | Headbands, stickers, swag, shipping |
| Nebius Credits | Compute credits distributed to event attendees |
| Judging | Automated scoring system + potential human judges |

### 9.4 Unit Economics

- **Customer Acquisition:** Free 1-hour compute + 1B tokens on signup (HackMeBaby) or free Claw Kit (Claw.RSVP hosts)
- **Prizes stay in-ecosystem:** $100 credits, not cash -- winners spend them on more builds
- **LTV:** Power users buying tokens and compute for premium models, GPUs, and parallel generations
- **Viral Loop:** Users share their babies on social media, driving organic signups. Event attendees share ClawCam photos, driving awareness.
- **Cross-product flywheel:** Attend a ClawCamp -> try HackMeBaby at the event -> sign up -> keep building at home -> host your own event

---

## 10. Technical Architecture

### 10.1 System Overview

All products share a Supabase backend with a shared auth system. Each product is a separate Vercel project.

```
+------------------+     +------------------+     +------------------+
|   clawcamp.com   |     |    claw.rsvp     |     |  hackmebaby.com  |
|   (Vercel)       |     |    (Vercel)      |     |    (Vercel)      |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                         |
         +------------------------+-------------------------+
                                  |
                        +---------v----------+
                        |     Supabase       |
                        |  (Shared Backend)  |
                        |  - PostgreSQL      |
                        |  - Auth (JWT)      |
                        |  - Storage         |
                        |  - Realtime        |
                        +--------------------+
                                  |
              +-------------------+-------------------+
              |                   |                    |
     +--------v--------+ +-------v--------+ +---------v-------+
     |    claw.cam      | |   OpenClaw     | |   Bland AI      |
     |  (Vercel)        | |   (Agent)      | |  (Voice API)    |
     +-----------------+  +----------------+ +-----------------+
```

### 10.2 Tech Stack by Product

| Product | Frontend | Backend | Database | Deployment | Special |
|---|---|---|---|---|---|
| clawcamp.com | Astro + TailwindCSS | Static / Serverless | Supabase | Vercel | Leaflet maps |
| claw.rsvp | React + TS + Vite + Tailwind | Express + Prisma | Supabase (PostgreSQL) | Vercel | Bland AI, Stripe, ERC-721 |
| claw.cam | React + TS + Zustand | Serverless | IndexedDB + Supabase | Vercel | Gemini 2.5 Flash, OpenClaw |
| hackmebaby.com | React + TS | Serverless + Queue | Supabase | Vercel | Multi-model API, GPU compute |

### 10.3 Shared Services

- **Auth:** Magic link JWT auth shared across all products via Supabase
- **User Profiles:** Single user record across all products -- your ClawID, your event history, your HackMeBaby entries, your ClawCam photos
- **ClawID:** ERC-721 contract on Base/Monad, referenced by all products
- **Nebius Credits:** Credit ledger in Supabase, distributed at events, spent on HackMeBaby

### 10.4 External Integrations

| Service | Used By | Purpose |
|---|---|---|
| Supabase | All | Database, auth, storage, realtime |
| Vercel | All | Deployment, serverless functions |
| Stripe | Claw.RSVP | Payment processing |
| Bland AI | Claw.RSVP | AI phone ordering (calls restaurants) |
| Google Places | Claw.RSVP | Restaurant/venue search |
| Nebius | Claw.RSVP, HackMeBaby | Cloud compute credits |
| Gemini 2.5 Flash | ClawCam | Image transformation model |
| Anthropic API | HackMeBaby | Claude model access |
| OpenAI API | HackMeBaby | GPT model access |
| Google AI API | HackMeBaby | Gemini model access |
| Base / Monad | ClawID | ERC-721 chain deployment |
| GitHub API | HackMeBaby | Repo creation for babies |

---

## 11. Launch Roadmap

### Phase 1: Foundation (Weeks 1-2)

| Task | Product |
|---|---|
| Fork rsv-pizza repo | Claw.RSVP |
| Strip PizzaDAO branding (keep food ordering) | Claw.RSVP |
| Rebrand: colors, typography, copy, imagery | Claw.RSVP |
| Rename all pizza terminology to claw terminology | Claw.RSVP |
| Deploy to claw.rsvp | Claw.RSVP |
| Core two-URL input + Make a Baby flow | HackMeBaby |
| Single model, 15-agent crew (no parallel models yet) | HackMeBaby |

### Phase 2: ClawCam + Events (Weeks 2-3)

| Task | Product |
|---|---|
| Embed ClawCam into event pages | Claw.RSVP |
| Build event-specific ClawCam instances (/event/{slug}/clawcam) | Claw.RSVP / ClawCam |
| Add Kiosk Mode for unattended operation | ClawCam |
| Build Photo Wall display mode | ClawCam |
| Connect photos to guest profiles | Claw.RSVP |
| Add ClawCult transformation styles | ClawCam |
| 3 models x 15 agents (full 45-agent pipeline) | HackMeBaby |
| Auto-deploy babies to live URLs | HackMeBaby |

### Phase 3: Operations + Economy (Weeks 3-4)

| Task | Product |
|---|---|
| Build Claw Kit ordering and shipping system | Claw.RSVP |
| Integrate Nebius credit provisioning | Claw.RSVP |
| Build host application form | Claw.RSVP |
| Set up Alpha Claw coordinator dashboard | Claw.RSVP |
| Create event format templates | Claw.RSVP |
| Hourly $100 prize begins | HackMeBaby |
| Open signups | HackMeBaby |
| Free tier compute + token economy | HackMeBaby |

### Phase 4: ClawID + Membership (Weeks 4-5)

| Task | Product |
|---|---|
| Rebrand ClawID contract (ClawCult / CLAW) | Claw.RSVP |
| Add photo ClawID printing from ClawCam | Claw.RSVP / ClawCam |
| Build ClawCult membership system | Claw.RSVP |
| Dynamic ClawID metadata with transformed photos | ClawID |
| ClawPrint QR sticker generation | ClawID |
| Model selection + paid generations | HackMeBaby |
| Baby gallery + social sharing + leaderboard | HackMeBaby |

### Phase 5: Launch + ClawHack (Weeks 5-6)

| Task | Product |
|---|---|
| First ClawCamp events in 3 pilot cities | Claw.RSVP |
| Iterate based on feedback | All |
| Open host applications globally | Claw.RSVP |
| Global Claw Day planning begins | Claw.RSVP |
| ClawHack agent arena launches | ClawHack |
| Sponsor dashboard + bounties | HackMeBaby |

### Phase 6: Scale (Month 2+)

| Task | Product |
|---|---|
| Enterprise features + API access | HackMeBaby |
| White-label hackathons for companies | HackMeBaby |
| Restaurant Robot Night event format | Claw.RSVP |
| Battle Mode + One-Shot Hack + Vibe Code Olympics | HackMeBaby |
| 3D printed ClawID lobsters | ClawID |
| Merch store launch | ClawCamp |
| Cross-product analytics + shared user profiles | All |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| High API costs per generation (45 agents) | Unsustainable burn rate | Optimize agent pipeline, cache common patterns, pass costs to power users |
| Low quality HackMeBaby outputs | Users lose interest | Iterate on agent prompts, add human QA layer, improve eval pipeline |
| Abuse (spam entries, gaming) | Degrades competition quality | Rate limits, entry quality filters, anti-gaming detection |
| Legal (combining copyrighted repos) | IP liability | Terms of service, open-source-only mode, content filtering |
| Scaling (thousands of concurrent 45-agent builds) | Infrastructure strain | Queue system, priority tiers, auto-scaling |
| Claw Kit shipping logistics | Delays, costs | Partner with fulfillment provider, regional warehouses |
| ClawCam content moderation | Inappropriate transformations | Content filters, host moderation tools, report system |
| Low event attendance | Hosts discouraged | Event promotion tools, Alpha Claw coordination, cross-event promotion |

---

## Taglines

| Product | Tagline |
|---|---|
| ClawCamp | "Software is reproducing. Come watch." |
| Claw.RSVP | "RSVP. Get Transformed." |
| ClawCam | "Step up. Get clawed." |
| ClawCult | "You showed up human. You leave as Claw." |
| Host CTA | "Throw a ClawCamp. We send you everything." |
| HackMeBaby | "Software is having babies." |
| ClawHack | "Submit your agent. Survive the gauntlet." |
| ClawID | "Talk to my agent." |

---

*This master PRD was compiled on April 4, 2026 from 8 source documents across files and Apple Notes. It is the single source of truth for the ClawCamp ecosystem.*
