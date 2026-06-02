# SafeMode - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** April 4, 2026
**Status:** Private Beta

---

## 1. Product Overview

SafeMode is a cloud hosting platform purpose-built for AI agents. It provides a managed deployment environment where developers can ship AI agents to production in under 5 minutes with flat $1/month pricing via a sleep/wake container architecture.

### 1.1 Vision

Eliminate the infrastructure burden of deploying AI agents. Traditional cloud platforms (AWS, Heroku, Railway) are built for web applications and fail at running AI agents due to timeouts on long-running tasks, lost state on restarts, and unpredictable per-request billing. SafeMode is the first platform designed specifically for the AI agent lifecycle.

### 1.2 Target Users

| Persona | Description | Primary Need |
|---------|------------|-------------|
| **Developers** | Individual developers building side projects or prototypes | Ship without spending weekends on infrastructure |
| **Startups** | Early-stage companies building AI-powered products | Get to market faster without a DevOps hire |
| **Researchers & Hackathon Teams** | ML researchers, academic teams, hackathon participants | Go from notebook to live demo in minutes |
| **Businesses** | Companies running internal AI agents | Secure, managed agents for support, data pipelines, and automation |

---

## 2. Website Architecture

### 2.1 Page Structure

```
/safemode/
  index.html          Homepage (marketing landing page)
  pricing/index.html   Pricing page (tiers + FAQ)
  docs/index.html      Documentation (quickstart + reference)
  blog/index.html      Blog listing page
  css/style.css        Global stylesheet
  js/main.js           Interactive behaviors
```

### 2.2 Navigation

**Primary Navigation (all pages):**
- Logo: SafeMode icon (cyan "M" on rounded square) + "safemode" wordmark
- Links: Features (#features) | Pricing | Docs | Blog
- CTA: "Join Beta" button (accent color)
- Sticky header with frosted glass effect (backdrop-blur)
- Mobile: Hamburger toggle at 768px breakpoint, full-screen overlay menu

**Docs Navigation:**
- Minimal header: Logo icon + "Documentation" label + "Dashboard" link
- Left sidebar with grouped sections (Getting Started, Reference, Framework Guides)
- Sidebar is sticky on desktop, slide-out on mobile

### 2.3 Footer (all pages except docs)

**4-column layout:**
1. **Brand:** Logo, tagline, contact email, social icons (X, LinkedIn, Discord)
2. **Product:** Features, Pricing, Documentation, CLI Reference, API Reference
3. **Frameworks:** CrewAI, LangGraph, OpenClaw
4. **Company:** Blog, X (Twitter), LinkedIn

**Bottom bar:** Copyright notice + Privacy/Terms links

---

## 3. Homepage Requirements

The homepage is the primary marketing page. It consists of 13 sections designed to move visitors from awareness to beta signup.

### 3.1 Hero Section

| Element | Content | Design |
|---------|---------|--------|
| Label | "Now in private beta" | Accent color, uppercase, tracked |
| Headline | "Cloud hosting for your **AI agents**." | "AI agents" in accent color |
| Subheading | Deploy any AI agent to the cloud in seconds. Sleep/wake architecture keeps costs at $1/month. No DevOps required. | Muted white (40% opacity) |
| CTA | "Join Beta" with right-arrow icon | Accent background, dark text |

**Responsive typography:** h1 scales from 2rem (mobile) to 2.5rem (tablet) to 3rem (desktop).

### 3.2 Logo Marquee

**Purpose:** Social proof showing framework/tool compatibility.

**Behavior:**
- Continuous horizontal scroll animation (30s linear loop)
- Items duplicated in DOM for seamless infinite scroll
- Pauses on hover
- CSS `@keyframes marquee` from `translateX(0)` to `translateX(-50%)`

**Items (12):** Python, Docker, LangChain, CrewAI, OpenAI, AutoGen, Anthropic, Hugging Face, FastAPI, LangGraph, Vercel, Next.js

### 3.3 Features Grid

**Layout:** 3-column CSS grid on desktop (1-column mobile) with a bento-style arrangement. Left card spans 2 rows.

**7 Feature Cards:**

| # | Title | Description | Visual Element |
|---|-------|-------------|----------------|
| 1 | Everything your agent needs to run | Your own container, public URL, secrets, metrics, and scaling -- all in one place | None (text-only featured card) |
| 2 | Flat $1/month | No per-request fees, no surprise bills. Sleep/wake architecture means you only pay when active. | Large "$1" price display |
| 3 | Built-in API endpoint | Every agent gets a stable HTTPS URL on deploy. Call it from your app, webhooks, or other agents. | 3 endpoint rows (GET/POST with colored method badges) |
| 4 | Bring your own stack | CrewAI, LangGraph, OpenAI Agents, or your own framework. If it runs in a container, it runs on SafeMode. | 6 framework logo pills |
| 5 | One-click deploys | Connect a GitHub repo and deploy. Your agent is live in seconds. | 3 GitHub repo rows with icons |
| 6 | Built-in secrets | Store API keys and credentials securely. Injected at runtime, never exposed in logs. | 4 masked secret rows (monospace) |

**Card interactions:**
- Hover: Background lightens to `rgba(255,255,255, 0.015)`
- Borders: `rgba(255,255,255, 0.06)` between cards
- Scroll reveal animation on viewport entry

### 3.4 How It Works (3 Steps)

**Heading:** "Production-ready in 3 steps."

| Step | Title | Description | Code Visual |
|------|-------|-------------|-------------|
| 1 | Push your code | Connect your GitHub repo or push directly with the CLI | `safemode deploy` with success output |
| 2 | Add secrets | Configure environment variables and API keys in the dashboard | Masked env vars (OPENAI_API_KEY, REDIS_URL, DATABASE_URL) |
| 3 | You're live | Your agent gets a public HTTPS endpoint. Invoke it via API, webhook, or cron. | `curl` command with JSON response |

**Layout:** 3-column grid with 1px border dividers between cards.

### 3.5 Problems Section

**Heading:** "Building an AI agent locally is easy. Deploying it to the cloud is hard."

| Problem | Description | Visual |
|---------|-------------|--------|
| Unpredictable costs | Per-request, per-minute, per-GB pricing makes it impossible to budget | AWS Lambda pricing breakdown ending in "= ???/month" (red) |
| Too much setup | Dockerfile, docker-compose, nginx, SSL certs, CI/CD pipelines... | File list + "2 hours of debugging" (yellow) |
| Built for web apps, not agents | Traditional platforms timeout on long-running tasks and lose state on restart | Error messages: 504 timeout, state lost, cold start |

### 3.6 Who It's For (Personas)

**Heading:** "Built for builders."

**Layout:** 2x2 grid of persona cards.

| Persona | Description |
|---------|-------------|
| Developers | Ship your side project or prototype without spending a weekend on infrastructure. Focus on the agent logic, not the plumbing. |
| Startups | Get to market faster with a managed platform. No DevOps hire needed. Scale up when you're ready. |
| Researchers & hackathon teams | Go from notebook to production in minutes. Share a live URL with your team or judges instantly. |
| Businesses | Run internal agents for support, data pipelines, and automation. Built-in secrets and access control keep things secure. |

### 3.7 Comparison Table

**Heading:** "Why we're different."

**Horizontally scrollable table** comparing SafeMode against 6 competitors:

| Feature | SafeMode | AWS Lambda | AWS EC2 | Railway | Heroku | Fly.io | Render |
|---------|----------|-----------|---------|---------|--------|--------|--------|
| Monthly cost | **$1/mo flat** | Variable | $15+/mo | $5+/mo | $7+/mo | $3+/mo | $7+/mo |
| Extra gateway/NAT fees | **None** | $3.50/1M + NAT | Varies | None | None | None | None |
| Setup time | **Minutes** | Hours | Hours | ~30 min | ~30 min | ~30 min | ~30 min |
| No cold starts | **Yes** | No | Yes | Yes | No | Yes | No |
| Stateful containers | **Yes** | No | Yes | No | No | Yes | No |
| Sleep/wake | **Yes** | No | No | No | No | Yes | No |
| Agent-first design | **Yes** | No | No | No | No | No | No |

**SafeMode column is visually highlighted** with a subtle accent background tint.

### 3.8 Testimonials

**Heading:** "Loved by developers."

**Layout:** 3-column grid (2 on tablet, 1 on mobile).

**6 testimonial cards**, each containing:
- Quote text
- Author avatar (gradient circle with initials)
- Author name and role/company

| Author | Role | Key Theme |
|--------|------|-----------|
| Jake Chen | Full-stack Developer | 5-minute CrewAI deployment |
| Sarah Rodriguez | CTO, DataPipe AI | $200/mo to $1/mo cost reduction |
| Michael Kim | ML Engineer | Long-running tasks work without hacks |
| Aisha Patel | AI Researcher | Hackathon notebook-to-demo speed |
| Daniel Lee | Security Engineer | Built-in secrets management |
| Emma Wilson | Founder, AgentOps | Running 12 agents cheaply |

### 3.9 Blog Preview

**Heading:** "From the blog."

**Layout:** 3-column grid of blog cards.

Each card shows: category tag, title, date (with calendar icon), read time (with clock icon).

**3 preview articles:**
1. Infrastructure: "Traditional Hosting Is Broken for AI Agents" (Mar 11, 8 min)
2. Guides: "LangGraph vs CrewAI: Choosing the Right Framework" (Mar 10, 5 min)
3. Security: "Security Best Practices for Production AI Agents" (Mar 4, 6 min)

### 3.10 Pricing Preview

Same 3-tier structure as the dedicated pricing page (see Section 4).

### 3.11 FAQ Accordion

**Heading:** "Frequently asked questions."

**Behavior:**
- Single-open accordion (opening one closes others)
- Smooth max-height animation (0.3s ease)
- Plus icon rotates 45 degrees when open
- Answer text fades in

**5 Questions:**

| Question | Answer Summary |
|----------|---------------|
| How does the $1/month pricing work? | Sleep/wake containers, flat fee regardless of wake frequency, no per-request/bandwidth charges |
| What frameworks do you support? | CrewAI, LangGraph, OpenAI Agents, AutoGen, any custom Python framework. First-class integrations with optimized templates. |
| How is this different from Heroku or Railway? | Purpose-built for agents vs. web apps. Sleep/wake, stateful containers, flat pricing. |
| Can I use my own domain? | Always-On tier ($10/mo). All tiers include free safemode.sh subdomain. |
| When will SafeMode be publicly available? | Private beta. Join waitlist for invite. Beta users get early features + priority support. |

### 3.12 Bottom CTA

**Heading:** "Ready to deploy your agent?"
**Subheading:** "Join the beta and get your first agent running in under 5 minutes."
**CTA:** "Join Beta" button (same style as hero)

---

## 4. Pricing Page Requirements

### 4.1 Hero

- Label: "Pricing" (accent, uppercase)
- Headline: "Simple, transparent pricing."
- Subheading: "Start at $1/month. Scale when you need to."

### 4.2 Pricing Tiers

**Layout:** 3-column grid on desktop, stacked on mobile.

#### Tier 1: Smart Agent -- $1/mo per agent

| Feature | Detail |
|---------|--------|
| Architecture | Sleep/wake |
| Invocations | 1,000/month |
| Gateway | Shared |
| Support | Community |
| Logs | Basic |
| Endpoint | HTTPS |
| Secrets | Built-in |

**CTA:** "Join waitlist" (outline button)

#### Tier 2: Extended -- $5/mo per agent (Popular)

| Feature | Detail |
|---------|--------|
| Invocations | 10,000/month |
| Gateway | Dedicated |
| Triggers | Webhooks |
| Logs | Priority + analytics |
| Support | Email |
| Config | Custom environment configs |
| Collaboration | Team features |

**Badge:** "Popular" in accent color
**CTA:** "Join waitlist" (filled accent button)

#### Tier 3: Always-On -- $10/mo per agent

| Feature | Detail |
|---------|--------|
| Invocations | Unlimited |
| Connection | Persistent |
| Support | Priority |
| Domain | Custom domain |
| SLA | Guarantee |
| Scaling | Advanced |
| Infrastructure | Dedicated |

**CTA:** "Join waitlist" (outline button)

### 4.3 Pricing FAQ

**5 accordion items:**
1. How does the $1/month pricing work?
2. What happens if I exceed the invocation limit? (Notification, upgrade prompt, no interruption)
3. Can I switch tiers at any time? (Yes, immediate, prorated)
4. Is there a free tier? (Not yet, exploring for OSS)
5. Do you offer volume discounts? (10+ agents, contact sales)

### 4.4 Bottom CTA

Same as homepage.

---

## 5. Documentation Page Requirements

### 5.1 Layout

**Two-panel layout:**
- **Left sidebar** (240px, sticky): Grouped navigation sections
- **Right content** (max 768px): Documentation prose

**Docs-specific navigation bar:**
- Logo icon (no wordmark) + "Documentation" label
- "Dashboard" link on the right
- No Features/Pricing/Blog links

### 5.2 Sidebar Navigation

| Section | Links |
|---------|-------|
| **Getting Started** | Quickstart (default/active), Configuration |
| **Reference** | CLI Reference, API Reference, Provisioning API |
| **Framework Guides** | CrewAI, LangGraph, OpenClaw, NemoClaw |

**Active state:** Full white text. Default: 40% opacity white. Hover: 70% opacity.

### 5.3 Quickstart Guide Content

**Title:** "Quickstart"
**Subtitle:** "Get your first AI agent deployed in under 5 minutes."

**5 numbered steps, each with:**
- H2 heading (numbered)
- Description paragraph
- Code block with filename label and copy button

| Step | Title | Code |
|------|-------|------|
| 1 | Install the CLI | `npm install -g @safemode/cli` |
| 2 | Authenticate | `safemode login` |
| 3 | Create a configuration | `safemode.toml` with [agent] and [triggers] sections |
| 4 | Deploy | `safemode deploy` with success output |
| 5 | Monitor | `safemode logs my-agent --follow` |

**Info card** at the end: "What happens next?" explaining sleep/wake behavior, wake triggers, and billing.

### 5.4 Configuration Reference

**Three config sections documented:**

**[agent]:**
- `name` -- Agent name (used in URLs)
- `framework` -- crewai | langgraph | openclaw | custom
- `tier` -- smart | extended | always-on
- `entrypoint` -- Path to main file (default: main.py)

**[triggers]:**
- `cron` -- Cron expression for scheduled runs
- `webhook` -- Enable webhook trigger (true/false)
- `api` -- Enable API invocation (true/false)

**[build]:**
- `python` -- Python version (default: "3.11")
- `install` -- Install command (default: "pip install -r requirements.txt")

### 5.5 CLI Reference

| Command | Description |
|---------|-------------|
| `safemode login` | Authenticate with GitHub |
| `safemode deploy` | Deploy current project |
| `safemode logs <name>` | View agent logs |
| `safemode status` | Check deployment status |
| `safemode secrets set` | Add environment variables |
| `safemode delete` | Remove an agent |
| `safemode list` | List all deployed agents |

### 5.6 API Reference

**Base URL:** `https://safemode.sh/<agent-name>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /invoke | Trigger agent execution |
| GET | /status | Get agent status |
| GET | /health | Health check |
| GET | /logs | Retrieve recent logs |
| POST | /secrets | Update environment variables |

**Authentication:** Bearer token (`$SAFEMODE_TOKEN`) in Authorization header.

**Example cURL provided** showing POST /invoke with JSON body.

### 5.7 Code Block Component

**Structure:**
- Header bar: filename/language label + "Copy" button
- Code area: monospace font, horizontal scroll on overflow

**Syntax highlighting colors:**
| Token Type | Color |
|-----------|-------|
| Keywords | Purple (#c084fc) |
| Strings | Green (#4ade80) |
| Comments | Dark gray (20% white) |
| Functions | Blue (#60a5fa) |
| Numbers | Yellow (#fbbf24) |

**Copy behavior:**
- Click "Copy" button
- Uses `navigator.clipboard.writeText()`
- Button text changes to "Copied!" for 2 seconds
- Reverts to "Copy"

---

## 6. Blog Page Requirements

### 6.1 Page Header

- Headline: "Blog" (3rem/3.75rem responsive)
- Description: "Insights on deploying AI agents, framework guides, and platform updates."
- Category tags displayed as bordered pills

**Tag categories:** Infrastructure, Architecture, Tutorials, Security, Guides

### 6.2 Featured Article (Full Width)

| Element | Detail |
|---------|--------|
| Category | Infrastructure |
| Badge | "Latest" (accent background, dark text) |
| Title | "Traditional Hosting Is Broken for AI Agents" |
| Excerpt | 2-line clamped description |
| Meta | Calendar icon + date, Clock icon + read time |
| Action | "Read article" with right-arrow icon |

**Hover:** Border brightens from 6% to 15% white opacity.

### 6.3 Blog Grid

**Layout:** 2-column grid on tablet+, 1-column on mobile. Gap: 1rem.

**6 article cards**, each containing:
- Category tag (uppercase, tracked)
- Title (semibold)
- Excerpt (2-line clamped)
- Metadata (date + read time with icons)

| # | Category | Title | Date | Read Time |
|---|----------|-------|------|-----------|
| 1 | Guides | LangGraph vs CrewAI: Choosing the Right Agent Framework | Mar 10, 2026 | 5 min |
| 2 | Security | Security Best Practices for Production AI Agents | Mar 4, 2026 | 6 min |
| 3 | Tutorials | Deploying CrewAI Agents to Production in 5 Minutes | Feb 25, 2026 | 4 min |
| 4 | Architecture | Why AI Agents Need Sleep/Wake Architecture | Feb 18, 2026 | 5 min |
| 5 | Tutorials | Building Event-Driven AI Agents with Webhook Triggers | Feb 10, 2026 | 6 min |
| 6 | Architecture | The Real Cost of Running AI Agents (And How to Cut It by 90%) | Jan 28, 2026 | 7 min |

---

## 7. Design System

### 7.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000000` | Page background |
| `--bg-secondary` | `#0a0a0a` | Docs header, subtle surfaces |
| `--text-primary` | `#ffffff` | Headings, primary text |
| `--accent` | `#00d4ff` | CTAs, labels, badges, highlights |
| `--accent-hover` | `#00b8e6` | Button hover state |
| `--border` | `rgba(255,255,255, 0.06)` | Card borders, dividers |
| `--border-hover` | `rgba(255,255,255, 0.15)` | Hovered card borders |
| `--border-medium` | `rgba(255,255,255, 0.08)` | Tags, secondary borders |
| `--card-bg` | `rgba(255,255,255, 0.01)` | Card backgrounds |
| `--card-bg-hover` | `rgba(255,255,255, 0.015)` | Card hover backgrounds |
| `--card-bg-alt` | `rgba(255,255,255, 0.02)` | Featured cards, blog cards |
| `--surface-secondary` | `rgba(255,255,255, 0.03)` | Code blocks, info panels |

**Text opacity scale:** 15% (faintest) / 20% / 25% / 30% / 40% / 50% / 60% / 70% / 80% / 100%

### 7.2 Typography

| Element | Font | Size | Weight | Letter Spacing |
|---------|------|------|--------|---------------|
| Body | Geist | 16px base | 400 | Normal |
| H1 (hero) | Geist | 2rem-3rem | 500 | -0.03em |
| H2 (section) | Geist | 1.75rem-2.25rem | 500 | -0.03em |
| H3 (card) | Geist | 0.9375rem-1.125rem | 600 | -0.02em |
| Label | Geist | 0.625rem | 600 | 0.1em (uppercase) |
| Body small | Geist | 0.875rem | 400 | Normal |
| Code | Geist Mono | 0.8125rem | 400 | Normal |
| Inline code | Geist Mono | 0.8125rem | 400 | Normal |

**Font loading:** CDN via `cdn.jsdelivr.net/npm/geist@1.3.1`

### 7.3 Spacing

| Context | Values |
|---------|--------|
| Container max-width | 1280px (default), 896px (narrow/blog) |
| Container padding | 1rem (mobile) / 1.5rem (tablet) / 2rem (desktop) |
| Section vertical padding | 2rem - 5rem |
| Card padding | 1.5rem - 3rem depending on card type |
| Grid gaps | 1rem - 1.5rem |
| Section heading bottom margin | 3rem |

### 7.4 Borders

| Context | Value |
|---------|-------|
| Default border | 1px solid rgba(255,255,255, 0.06) |
| Hover border | 1px solid rgba(255,255,255, 0.15) |
| Small radius | 4px (code inline, tags) |
| Medium radius | 6px (buttons, code blocks, stack logos) |
| Large radius | 8px (feature visuals, hero CTA) |
| XL radius | 12px (info cards) |

### 7.5 Shadows

None. The entire design relies on border opacity for depth, not box-shadows.

---

## 8. Interactive Behaviors

### 8.1 FAQ Accordion

**Trigger:** Click on question button
**Behavior:**
1. If another item is open, close it (set `max-height: 0`)
2. Toggle `.open` class on the clicked item
3. If opening: set `max-height` to `scrollHeight` of answer div
4. If closing: set `max-height` to `0`

**Animation:** `max-height 0.3s ease` CSS transition
**Icon:** Plus icon rotates 45 degrees on open (becomes X)

### 8.2 Mobile Navigation

**Trigger:** Click hamburger button (visible below 768px)
**Behavior:**
1. Toggle `.active` class on `.nav-links`
2. Toggle `.is-open` class on toggle button
3. Active state: Full-screen overlay with links stacked vertically
4. Clicking any link closes the menu

### 8.3 Scroll Reveal

**Implementation:** `IntersectionObserver`
**Configuration:**
- Threshold: 0.1 (10% visibility triggers)
- Root margin: `0px 0px -50px 0px` (triggers 50px before fully in view)

**Animation:**
- Initial state: `opacity: 0; transform: translateY(20px)`
- Revealed state: `opacity: 1; transform: translateY(0)`
- Duration: 0.6s ease
- Staggered delay: `(index % 3) * 100ms` for grouped items
- One-shot: Element is unobserved after reveal (no re-animation)

### 8.4 Code Block Copy

**Trigger:** Click "Copy" button in code block header
**Behavior:**
1. Get text content from the `<pre>` element
2. Write to clipboard via `navigator.clipboard.writeText()`
3. Change button text to "Copied!"
4. After 2 seconds, revert to "Copy"

### 8.5 Marquee Animation

**CSS animation:** `@keyframes marquee`
- From: `translateX(0)`
- To: `translateX(-50%)`
- Duration: 30s, linear, infinite
- Pauses on hover (`animation-play-state: paused`)

**DOM:** Items are duplicated to create seamless loop. Track uses `display: flex; width: max-content`.

### 8.6 Docs Sidebar (Mobile)

**Trigger:** Click sidebar toggle button (visible below 768px)
**Behavior:**
1. Toggle `.active` class on `.docs-sidebar`
2. Active: Fixed position, slides in from left, background overlay

---

## 9. Responsive Design

### 9.1 Breakpoints

| Breakpoint | Width | Changes |
|-----------|-------|---------|
| Mobile (default) | < 640px | Single column, small type, hamburger nav |
| Tablet | >= 640px | 2-column grids, increased font sizes |
| Desktop | >= 768px | Full nav, 3-column grids, sidebar visible |
| Large desktop | >= 1024px | 3-column testimonials |

### 9.2 Navigation Response

- **Desktop (>768px):** Horizontal nav links visible, hamburger hidden
- **Mobile (<=768px):** Links hidden, hamburger visible, overlay menu on toggle

### 9.3 Grid Responses

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Features grid | 1 col | 1 col | 3 col (bento) |
| Steps grid | 1 col stacked | 1 col | 3 col with borders |
| Problems grid | 1 col | 1 col | 3 col |
| Personas grid | 1 col | 2 col | 2 col |
| Blog grid (home) | 1 col | 3 col | 3 col |
| Blog grid (page) | 1 col | 2 col | 2 col |
| Pricing grid | 1 col | 1 col | 3 col |
| Testimonials | 1 col | 2 col | 3 col |
| Footer | 1 col | 4 col | 4 col |

### 9.4 Typography Response

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Hero h1 | 2rem | 2.5rem | 3rem |
| Section h2 | 1.75rem | 1.75rem | 2.25rem |
| Blog page h1 | 2.5rem | 3rem | 3rem |
| Featured blog h2 | 1.5rem | 1.75rem | 1.75rem |
| Featured card h2 | 1.75rem | 1.75rem | 2rem |

---

## 10. Technical Requirements

### 10.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Markup | Semantic HTML5 |
| Styling | Vanilla CSS with CSS custom properties |
| Interactivity | Vanilla JavaScript (no framework) |
| Fonts | Geist Sans + Geist Mono via jsdelivr CDN |
| Icons | Inline SVG (Lucide icon set) |
| Hosting | Vercel (static deployment) |
| Build | None (zero-build static files) |

### 10.2 Performance Requirements

- **No JavaScript frameworks** -- Pure vanilla JS for minimal bundle
- **No CSS frameworks** -- Custom CSS, no Tailwind/Bootstrap runtime
- **Font loading:** `preconnect` to CDN for faster font delivery
- **SVG icons:** Inline (no icon font or sprite sheet HTTP request)
- **Images:** None (all visuals are CSS/HTML-rendered)
- **Animations:** CSS-only where possible (marquee, transitions), JS only for IntersectionObserver

### 10.3 Browser Support

Modern browsers supporting:
- CSS Custom Properties
- `backdrop-filter`
- IntersectionObserver
- `navigator.clipboard`
- CSS Grid and Flexbox
- `@keyframes` animations

### 10.4 Accessibility

- Semantic HTML (`header`, `nav`, `main`, `footer`, `section`)
- `aria-label` on icon buttons (mobile toggle, social links)
- Keyboard-accessible FAQ (button elements)
- Sufficient color contrast (white on black)
- Responsive font sizing (rem units)

### 10.5 SEO

| Meta | Value |
|------|-------|
| Title | SafeMode \| Deploy AI Agents for $1/month |
| Description | Cloud hosting for AI agents. Sleep/wake architecture, instant API endpoints, and built-in secrets management. Starting at $1/month. |
| Favicon | Inline SVG data URI (cyan "M" on rounded square) |

Page-specific titles:
- Pricing: "Pricing \| SafeMode"
- Docs: "Docs -- Quickstart \| SafeMode"
- Blog: "Blog \| SafeMode"

---

## 11. Content Requirements

### 11.1 Tone of Voice

- **Technical but approachable:** Speaks to developers without being condescending
- **Concise:** Short sentences, minimal filler
- **Confident:** Makes clear claims ("$1/month", "under 5 minutes", "no DevOps")
- **Problem-aware:** Acknowledges pain points before presenting solutions
- **Code-forward:** CLI examples and code snippets throughout

### 11.2 Key Messaging Pillars

1. **Price:** "$1/month flat" -- repeated across hero, features, pricing, comparison table
2. **Speed:** "Under 5 minutes" / "in seconds" -- deployment speed
3. **Simplicity:** "No Dockerfile" / "No YAML" / "No DevOps" -- removal of complexity
4. **Purpose-built:** "Agent-first" / "not web apps" -- differentiation

### 11.3 Social Proof Types

1. **Logo marquee** -- Framework compatibility
2. **Testimonials** -- Developer quotes with real names/roles
3. **Comparison table** -- Feature-by-feature competitive analysis
4. **Blog content** -- Technical authority via tutorials and guides

---

## 12. Future Considerations

### 12.1 Pages Not Yet Built
- Individual blog post pages
- Framework-specific docs pages (CrewAI, LangGraph, OpenClaw, NemoClaw)
- Configuration reference as standalone page
- Dashboard / authenticated experience
- Login / signup flow

### 12.2 Features Mentioned but Not Implemented
- Actual "Join Beta" form / waitlist signup
- GitHub repo connection flow
- Secrets management dashboard
- Agent deployment pipeline
- Log streaming interface
- Billing / payment integration

### 12.3 Content Expansion Needed
- Blog post detail pages with full article content
- Framework-specific deployment guides
- API reference with interactive examples
- Changelog / release notes page
- Status page for platform uptime
