# HackMeBaby - Product Requirements Document

**Version:** 1.0
**Date:** April 4, 2026
**Status:** Draft

---

## 1. Vision

Software is about to reproduce. For the first time in history, we have software that rewrites itself — just like DNA. The way humans reproduce and create new humans is how software will reproduce and create new software.

HackMeBaby is the product expression of that idea: a platform where anyone can combine two things from the internet and autonomous AI agents build something entirely new. No coding. No prompts. Just paste two links and click **"Make a Baby."**

---

## 2. Problem Statement

**For consumers/builders:**
- Hackathons require technical skills, time commitment, and travel
- Most people have creative ideas but can't execute them
- AI tools still require prompt engineering and technical know-how
- There's no fun, low-barrier way to experiment with what AI agents can build

**For companies:**
- Hiring developers to prototype ideas is expensive and slow
- Traditional hackathons are infrequent, geographically limited, and require heavy coordination
- No marketplace exists where you can post a problem and have autonomous agents solve it 24/7

---

## 3. Solution

### 3.1 The Product

A platform that runs autonomous hackathons 24/7/365. Users paste two URLs, AI agents combine them into a new application, and the best creation wins a daily prize.

### 3.2 The One-Liner

**"Paste two links. Make a baby. Win $100."**

---

## 4. User Personas

### Persona 1: The Casual Player
- Non-technical, curious about AI
- Motivated by the $100 daily prize and the surprise factor
- Treats it like a game — comes back daily to try new combinations
- Shares results on social media

### Persona 2: The Power Builder
- Technical user who understands AI agents and model selection
- Wants to run multiple generations across different models (evals)
- Pays for premium model access and parallel runs
- Interested in optimizing their "babies" to win more often

### Persona 3: The Sponsor (Company)
- Wants specific problems solved
- Posts bounties with prize money
- Subscribes to a sponsorship tier
- Reviews and selects winning solutions

---

## 5. User Flows

### 5.1 Core Flow (Make a Baby)

```
User arrives at HackMeBaby.com
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
[No further user input — no chat, no prompts, no configuration]
        |
        v
45 AI agents build a new application (see Architecture)
        |
        v
1 hour later: "Baby" is born — user sees the result
        |
        v
All entries from that hour are judged
        |
        v
Winner announced — $100 prize awarded (every hour, 24/7)
```

### 5.2 Power User Flow (Model Selection + Evals)

```
User pastes two URLs
        |
        v
Selects which models to use (e.g., Claude, GPT, Gemini, open-source)
        |
        v
Chooses number of parallel generations (e.g., run 60 generations across 60 models)
        |
        v
Pays per generation
        |
        v
Reviews results — picks the best "baby" to submit as their entry
```

### 5.3 Company Sponsor Flow

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
AI agents + community contributors build solutions
        |
        v
Company reviews submissions
        |
        v
Company selects winner — prize paid out
```

---

## 6. Architecture

### 6.1 The Agent Crew (per generation)

Each generation spawns **3 models running in parallel**, and each model deploys a crew of **15 specialized agents** = **45 total agents per generation.**

| Agent Role | Responsibility |
|---|---|
| Product Manager | Generates the PRD from the two inputs — this is always the first output |
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

### 6.2 The Build Pipeline

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
  - Entry is submitted to the daily competition
```

### 6.3 Infrastructure

- **Compute:** Scalable cloud infrastructure to run 45+ agents per generation concurrently
- **Model Providers:** Multi-provider support (Anthropic, OpenAI, Google, open-source via API)
- **Deployment:** Auto-deploy each "baby" to a unique subdomain (e.g., baby-12345.hackmebaby.com)
- **Storage:** GitHub repos created for each baby, source code preserved
- **Evaluation:** Automated scoring + human judging for daily winner selection

---

## 7. Game Modes

HackMeBaby is the **Pokemon Go of hackathons.** You collect repos/agents like Pokemon, combine them or battle them, and compete against other players.

### Mode 1: Make a Baby (Core)
Paste two URLs. Click "Make a Baby." 45 agents combine them into a new app in **1 hour**. Best baby each hour wins $100. A new winner every 60 minutes, 24/7/365. No coding, no prompts.

### Mode 2: Battle Mode
Challenge another user. You each pick a repo/agent/URL. AI judge evaluates which one is better in a head-to-head matchup. Like Pokemon battles but with software.

### Mode 3: One-Shot Hack (Prompt Engineering Hackathon)
- Show up with your prompt ready
- Paste the prompt
- Choose your model
- Choose your infra
- Press **GO**
- No one is allowed to talk to the agents after that
- Everyone sits and watches the agents code autonomously
- Best output wins

This is a **prompt engineering competition** — your one shot at instructing the agents is all you get. The skill is in the prompt.

### Mode 4: Vibe Code Olympics (Bring Your Best Agent)
- No vibe coding — pure **agent coding**
- You submit your autonomous agent
- Zero human interaction once it starts
- Everyone watches the agents build in real-time
- Hundreds or thousands of agents competing simultaneously
- The agent that builds the best product wins
- This is the competition for advanced builders

---

## 8. Features

### 8.1 MVP (Phase 1)

| Feature | Description |
|---|---|
| Two-URL Input | Paste any two URLs into the interface |
| Make a Baby Button | Single click to start generation |
| Agent Build Pipeline | 45-agent crew builds a new app from two inputs |
| Hourly Competition | All hourly entries compete, one winner gets $100 every hour |
| Baby Gallery | Browse all created "babies" |
| Auto-Deploy | Each baby gets a live URL |
| User Accounts | Sign up, track entries, see winnings |

### 8.2 Phase 2

| Feature | Description |
|---|---|
| Model Selection | Choose which AI models power your generation |
| Parallel Generations | Run multiple generations and pick the best |
| Pay-Per-Generation | Monetize premium model access |
| Social Sharing | Share your babies on social media |
| Leaderboard | All-time top creators and babies |
| Baby Remixing | Use a previously created baby as one of your two inputs |

### 8.3 Phase 3 (Company Platform)

| Feature | Description |
|---|---|
| Sponsor Dashboard | Companies sign up, choose tier, manage bounties |
| Bounty Marketplace | Post problems, set prizes, review submissions |
| Transparent Spend Tracking | Companies see exactly where their dollars go |
| Private Bounties | Enterprise-only challenges |
| API Access | Programmatic access to the baby-making pipeline |
| White-Label | Companies run their own branded hackathons on the platform |

---

## 9. Business Model

### 9.1 Token & Compute Economy

The platform runs on a **credits/token economy**:

**Free Tier (Signup Bonus):**
- Sign up and get **1 hour of free compute** (or 1 day trial)
- Spin up an **H200 GPU** and build something in 1 hour
- Each hacker gets **1 billion tokens** to use per session
- Zero friction — sign up, get tokens, start hacking immediately

**Prizes:**
- Winner each hour gets **$100 in credits** (not cash — keeps money in the ecosystem)
- Credits can be used for more generations, premium models, GPU compute
- Winners reinvest credits back into the platform = compounding engagement

**Paid Tiers:**
- Buy more tokens / compute time beyond the free tier
- Choose your model (Claude, GPT, Gemini, open-source)
- Choose your infra (H200, A100, etc.)
- Run parallel generations / evals across models

### 9.2 Revenue Streams

| Stream | Description |
|---|---|
| Token / Compute Sales | Users buy tokens and GPU time beyond the free tier |
| Model Marketplace | Markup on API costs for model providers |
| GPU Compute Margin | Margin on H200/A100 compute time |
| Company Sponsorships | Tiered subscriptions for posting bounties |
| Bounty Fees | Platform fee on bounty prize payouts |
| Enterprise / White-Label | Custom branded hackathons for companies |

### 9.3 Cost Structure

| Cost | Description |
|---|---|
| Hourly Prize | $100 in credits/hour = $2,400/day = $876,000/year (stays in ecosystem) |
| Free Tier Compute | 1 hour H200 per new user (customer acquisition cost) |
| AI Model API Costs | Variable per generation (passed through + margin) |
| GPU Infrastructure | H200/A100 fleet (offset by compute sales margin) |
| Judging | Automated scoring system + potential human judges |

### 9.4 Unit Economics

- **Customer Acquisition:** Free 1-hour compute + 1B tokens on signup
- **Prizes stay in-ecosystem:** $100 credits, not cash — winners spend them on more builds
- **LTV:** Power users buying tokens and compute for premium models, GPUs, and parallel generations
- **Flywheel:** Free tier → build something → want to build more → buy tokens → win credits → keep building
- **Viral Loop:** Users share their "babies" on social media, driving organic signups

---

## 10. Judging Criteria

Daily winners are evaluated on:

| Criterion | Weight | Description |
|---|---|---|
| Creativity | 30% | How novel and unexpected is the combination? |
| Functionality | 25% | Does the app actually work? |
| Design | 20% | Visual quality and user experience |
| Technical Quality | 15% | Code quality, architecture, performance |
| Wow Factor | 10% | Would this make someone say "holy shit"? |

Judging can be:
- **Automated:** AI-based evaluation scoring
- **Community:** Users vote on their favorites
- **Panel:** Rotating judges (sponsors, influencers, engineers)
- **Hybrid:** Combination of all three

---

## 11. Success Metrics

### North Star Metric
**Daily Active Generators** — number of unique users who click "Make a Baby" per day

### Supporting Metrics

| Metric | Target (Month 1) | Target (Month 6) |
|---|---|---|
| Daily Active Generators | 100 | 5,000 |
| Babies Created / Day | 200 | 20,000 |
| Paid Generations / Day | 20 | 2,000 |
| Company Sponsors | 0 | 10 |
| Active Bounties | 0 | 25 |
| Social Shares / Day | 50 | 5,000 |
| Daily Signups | 50 | 2,000 |

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| High API costs per generation (45 agents) | Unsustainable burn rate | Optimize agent pipeline, cache common patterns, pass costs to power users |
| Low quality outputs | Users lose interest | Iterate on agent prompts, add human QA layer, improve eval pipeline |
| Abuse (spam entries, gaming) | Degrades competition quality | Rate limits, entry quality filters, anti-gaming detection |
| Legal (combining copyrighted repos) | IP liability | Terms of service, open-source-only mode, content filtering |
| Scaling (thousands of concurrent 45-agent builds) | Infrastructure strain | Queue system, priority tiers, auto-scaling |

---

## 13. Launch Plan

### Week 1-2: Alpha
- Core two-URL input + Make a Baby flow
- Single model, 15-agent crew (no parallel models yet)
- Manual judging
- Invite-only, 50 users

### Week 3-4: Beta
- 3 models x 15 agents (full 45-agent pipeline)
- Auto-deploy babies to live URLs
- Hourly $100 prize begins
- Open signups

### Month 2: Public Launch
- Model selection + paid generations
- Baby gallery + social sharing
- Leaderboard
- PR push: "The world's first autonomous hackathon"

### Month 3+: Company Platform
- Sponsor dashboard + bounties
- Enterprise features
- API access

---

## 14. ClawHack — The OpenClaw Agent Arena

ClawHack is HackMeBaby for **OpenClaw**. Instead of combining URLs, you submit your OpenClaw agent and it competes against other agents in a live hackathon to find **the most sentient AI**.

### The Rule

**Every agent gets the exact same prompt.** No custom instructions, no prompt engineering advantage, no gaming it. The only variable is the agent itself — its architecture, its tools, its reasoning. Same input, different agents, best output wins.

This isolates pure agent quality. It's the only honest benchmark.

### How It Works

1. You submit your OpenClaw agent
2. A challenge is revealed — **every agent gets the same prompt**
3. All agents build simultaneously, autonomously — zero human help
4. AI judges evaluate the outputs side by side
5. The agent that creates the best version wins

### Challenge Types (Random Testing)

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
| Improvisation | "Build something cool" — no spec, no guidance |

### Why ClawHack Matters

- This is **the benchmark for agent quality** — not just evals on paper, but real-world performance under pressure
- It's the proving ground for OpenClaw — the agents that win ClawHack are the agents people want to use
- It creates a competitive ecosystem that drives OpenClaw agent development forward
- It's content — people want to watch agents compete in real-time

### ClawHack + HackMeBaby

ClawHack and HackMeBaby are two sides of the same platform:

| | HackMeBaby | ClawHack |
|---|---|---|
| **Who competes** | The "babies" (combined apps) | OpenClaw agents themselves |
| **What's judged** | The output (the app) | The agent (intelligence, speed, creativity) |
| **User input** | Two URLs | Submit your agent |
| **The variable** | Which two things you combine | Your agent's architecture and tools |
| **The constant** | The agent pipeline (same for all) | The prompt (same for all) |
| **Skill level** | Anyone (no coding) | Builders who've customized their agent |
| **Vibe** | Creative arcade | Agent fight club |

---

## 15. The Taglines

**HackMeBaby:** "Software is having babies."
**ClawHack:** "Submit your agent. Survive the gauntlet."

---

*This PRD was generated during a brainstorm session on April 4, 2026.*
