// Per-event rich content (speakers, schedule, sponsors, long description)
// keyed by Supabase events.id. The dynamic event detail page
// (/events/detail/?id=N) merges this with the row from the events table.
//
// To add rich content for an event: find its id, add an entry below.
// Everything is optional — omit a key and that section won't render.

window.EVENT_EXTRAS = {
  // ClawCamp June 1 Campfire (id 173 — Frontier Tower)
  // NOTE: ids here are examples; the page falls back gracefully if an id
  // has no entry. Update ids to match production rows as needed.
  173: {
    fullDescription:
      "The OpenClaw movement is not just an evolution — it's a revolution.\n\n" +
      "Every week, we host an amazing group of orgs and mentors to provide the support and tools to get you to the next level. Beginners will leave with their own personal agents and powerful skills to achieve almost any goal.\n\n" +
      "This week's agenda: Vibe Coding Nights — Get Your Agent Running + Build Your Second Brain: Memory for Your Agent.",
    speakers: [
      { name: 'Colin Lowenberg', role: 'Developer Relations', org: 'Nebius' },
      { name: 'Dave Nielsen', role: 'Advisor & Head of DevRel', org: 'Cognee AI' },
      { name: 'Marko Calvo-Cruz', role: 'Founder', org: 'UBI Studio' },
      { name: 'Rayyan Zahid', role: 'Co-Founder', org: 'Vibe Coding Nights' },
      { name: 'Phillip Wessels', role: 'Facilitator', org: 'ClawCamp' },
      { name: 'Aditya Advani', role: 'Founder', org: 'MoltPod' }
    ],
    schedule: [
      { time: '6:00–6:15 PM', title: 'Welcome + Intros', speaker: 'Steven Echtman — Aiify.io' },
      { time: '6:15–6:30 PM', title: 'Talk', speaker: 'Dave Nielsen' },
      { time: '6:30–6:45 PM', title: 'Nebius — Tools for Personal Agents', speaker: 'Colin Lowenberg' },
      { time: '6:45–7:00 PM', title: 'Harness Your Harness', speaker: 'Marko Calvo-Cruz' },
      { time: '7:00–7:15 PM', title: 'Move to Breakout Sessions', speaker: '' },
      { time: '7:15–8:45 PM', title: 'Concurrent Workshops (Second Brain, Nebius, Docker, Moltpod, VPS)', speaker: '' },
      { time: '8:45–9:00 PM', title: 'Wrap Up & Networking', speaker: '' }
    ],
    sponsors: [
      { name: 'Aiify.io', url: 'https://aiify.io' }
    ]
  }
};
