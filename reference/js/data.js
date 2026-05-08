// Seed leaves (notes). The prototype's "single file" — everything lives here.
// Markdown-lite + [[wikilinks]] + #tags. Mix of zettel, journal, project, recipe.

window.SEED_LEAVES = [
  {
    id: "welcome",
    title: "Welcome to Quire",
    tags: ["meta", "guide"],
    pinned: true,
    created: "2026-04-12T09:00",
    edited: "2026-05-08T08:14",
    body: `Quire is a **single-file notebook**. Open this very page, and everything you'll ever write lives inside it. No server, no database — just one HTML file that travels with you.

Every note is called a *leaf*. Leaves can be linked together with [[Wikilinks]], grouped with tags like #zettel, and arranged into a stream you can read like a river.

Try it:
- Click [[Wikilinks]] to open another leaf in the river.
- Press \`⌘K\` to fly through everything by name.
- Press \`⌘N\` to start a new leaf — the cursor lands where you'd expect.
- Use the *Today* button in the sidebar to jump into your daily journal.

The whole app is a single HTML file. To extend it, drop a \`<style>\` or \`<script>\` block at the bottom and reload. Themes, plugins, even custom render hooks all work that way.

— see also [[How plugins work]] · [[Keyboard shortcuts]]`,
  },
  {
    id: "wikilinks",
    title: "Wikilinks",
    tags: ["meta", "syntax"],
    created: "2026-04-12T09:30",
    edited: "2026-04-30T11:02",
    body: `Wrap any phrase in double brackets to link to another leaf:

\`[[Compounding interest]]\`
\`[[Today]]\`

Clicking a wikilink **opens** the target leaf in the river beside this one — it doesn't navigate away. That's the whole trick. Notes accumulate horizontally; you can read three at once and follow a thought without losing your place.

If the target doesn't exist yet, the link is rendered dim. Click it and Quire creates the leaf for you.

Backlinks are computed automatically — see the panel on the right when a leaf is focused.`,
  },
  {
    id: "today",
    title: "Today · May 8",
    tags: ["journal"],
    isJournal: true,
    created: "2026-05-08T07:00",
    edited: "2026-05-08T08:42",
    body: `## Morning

Slept poorly. Read twenty pages of [[The Beginning of Infinity]] over coffee. Deutsch's argument that *good explanations are hard to vary* keeps stuck in my head — applies to design too. A good layout has every piece in its only possible place.

## To do
- [ ] Reply to Marcus about the [[Q3 retro]]
- [x] Walk
- [ ] Pull request review for [[Ribbon search]]
- [ ] Pick up sourdough starter from Yann

## Notes
- Ran into Priya at the market. She mentioned the [[Pomodoro variant]] she's been using — 52/17 instead of 25/5. Worth trying.
- The [[Sourdough]] is still flat. Hydration too low?

#journal`,
  },
  {
    id: "zettel-method",
    title: "Zettelkasten, briefly",
    tags: ["zettel", "method"],
    pinned: true,
    created: "2026-03-02T14:11",
    edited: "2026-04-22T16:30",
    body: `One idea per leaf. Make it small enough to be **atomic** but complete enough to stand alone. Title it like a claim, not a topic.

Three kinds of leaves, after Ahrens:
1. **Fleeting** — captured in [[Today]], later promoted or deleted.
2. **Literature** — what a source said, in your own words. Tag with the source: #book/deutsch.
3. **Permanent** — your own thought, written for your future self. The good stuff.

Linking is the work. A leaf with no links is a dead leaf.

Related: [[Wikilinks]] · [[Compounding interest]]`,
  },
  {
    id: "compounding",
    title: "Compounding interest",
    tags: ["zettel", "ideas"],
    created: "2026-02-18T10:14",
    edited: "2026-04-01T09:09",
    body: `A note you write today pays interest forever. The first time you reach for it might be three years out. Most filing systems are built around *finding things you remember filing*. A zettelkasten is built around the opposite — being surprised by something you'd forgotten you knew.

The math: if a single leaf saves you ten minutes once, in a year, it has paid for itself. Most leaves never get re-read. A few get re-read constantly. You can't predict which.

Implication: write more leaves than you think are warranted. The cost of a bad leaf is low; the cost of a missing one is unknowable.

See [[Zettelkasten, briefly]].`,
  },
  {
    id: "plugins",
    title: "How plugins work",
    tags: ["meta", "extending"],
    created: "2026-04-15T11:00",
    edited: "2026-05-02T13:28",
    body: `A plugin is just a \`<script>\` or \`<style>\` block at the bottom of the Quire file. There is no build step, no package manager, no API key.

\`\`\`html
<script>
  Quire.registerPlugin('word-count', {
    leafFooter(leaf) {
      const w = leaf.body.split(/\\s+/).length;
      return \`\${w} words\`;
    }
  });
</script>
\`\`\`

Plugin hooks available:
- \`leafFooter(leaf)\` — render at the bottom of every card
- \`renderInline(token)\` — handle a custom \`{{token}}\` syntax
- \`onSave(leaf)\` — fire when a leaf is edited
- \`command(name, fn)\` — add an entry to ⌘K

Toggle plugins on/off in the *Plugins* section of the sidebar. Disabled plugins are still in the file — they just don't run.

Built-in: [[Backlinks]], [[Graph view]], [[Math (KaTeX)]], [[Code highlight]].`,
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    tags: ["meta", "reference"],
    created: "2026-04-12T10:00",
    edited: "2026-04-25T08:00",
    body: `\`⌘K\` — command palette / fuzzy find
\`⌘N\` — new leaf
\`⌘E\` — toggle edit / preview on the focused leaf
\`⌘W\` — close focused leaf
\`⌘[\` / \`⌘]\` — move focused leaf left / right in the river
\`⌘.\` — open Tweaks
\`Esc\` — close palette / blur editor

The palette also accepts:
- \`>\` to run a command (e.g. \`>theme: ink\`)
- \`#\` to filter by tag
- \`/\` to search inside leaf bodies`,
  },
  {
    id: "ribbon-search",
    title: "Ribbon search",
    tags: ["project", "design"],
    created: "2026-05-01T15:42",
    edited: "2026-05-07T17:11",
    body: `Working name for the search affordance pinned to the top of the river. Notes:

- Should feel less like a *search box* and more like a *cursor* — always there, always blinks, takes you somewhere on Enter.
- ⌘K opens it from anywhere.
- Tokens: \`#tag\`, \`@person\`, \`>command\`, plain text searches body.
- Empty state: recently-edited, then pinned.

Rejected: a separate "search results" page. The river *is* the result. Filtering it in place keeps the user grounded.

Open question: how to present a query that returns 200 leaves without overwhelming. Probably collapse to titles after the first 10.

Related: [[Compounding interest]] (search is a re-discovery tool).`,
  },
  {
    id: "q3-retro",
    title: "Q3 retro",
    tags: ["project", "team"],
    created: "2026-04-28T16:00",
    edited: "2026-05-06T09:14",
    body: `## What worked
- Daily standups dropped to 8 minutes after we cut status updates and replaced them with [[Async standup format]].
- Shipping the editor rewrite in a single PR — risky but kept review focused.

## What didn't
- Two reorgs in a quarter ate three weeks. We need a "no reorg" window before launches.
- On-call burned Marcus out. Rotation is too small.

## Bets for Q4
1. Plugin marketplace ship date.
2. Mobile editor.
3. Hire two more on infra.

cc [[People · Marcus]] [[People · Priya]]`,
  },
  {
    id: "sourdough",
    title: "Sourdough",
    tags: ["recipe", "ongoing"],
    created: "2026-01-08T07:00",
    edited: "2026-05-08T07:30",
    body: `Working hydration: **74%**. Anything higher and the crumb collapses in our oven.

| Ingredient | Weight |
|---|---|
| Bread flour | 500g |
| Whole wheat | 50g |
| Water | 410g |
| Starter (100% hyd) | 110g |
| Salt | 11g |

Schedule that's been working:
- 09:00 — autolyse 45 min
- 09:45 — add starter + salt, slap & fold 8 min
- 10:00–13:00 — bulk, four sets of stretch & folds at 30 min intervals
- 13:00 — pre-shape, rest 30 min, shape, into banneton
- Cold retard overnight in the fridge
- 09:00 next day — bake 250°C lid on 22 min, lid off 18 min

Latest loaf was flat (see [[Today]]). Suspect under-fermented bulk. Try +30 min next time.

#recipe`,
  },
  {
    id: "deutsch",
    title: "The Beginning of Infinity",
    tags: ["book", "reading"],
    created: "2026-04-20T19:00",
    edited: "2026-05-08T07:55",
    body: `David Deutsch, 2011.

> Good explanations are hard to vary while still accounting for what they're meant to account for.

That's the whole book in a sentence. Bad theories are flexible — you can wiggle their parts to fit any data. Good theories snap into place; change one piece and the whole thing falls apart.

Implications I keep coming back to:
- Applies to design — see [[Compounding interest]] for a related thought.
- Applies to plans — a plan with too many fallbacks is a plan that doesn't really claim anything.
- Applies to code — the ugliest signal that a system is wrong is that it's *easy* to refactor in any direction.

#book/deutsch`,
  },
  {
    id: "pomodoro",
    title: "Pomodoro variant",
    tags: ["method", "ongoing"],
    created: "2026-05-07T11:30",
    edited: "2026-05-08T08:00",
    body: `Priya: **52 minutes on, 17 off**. From a DeskTime study, supposedly the rhythm of the most productive 10%.

I've been on classic 25/5 for a year and the breaks feel ritualistic at this point — I check Slack and come back. 52/17 forces a real pause.

Trying it this week. Day 1 (today): one block done before 09:00, second underway. The 17-minute gap is uncomfortably long. Walked.

If it sticks, retire [[Compounding interest]]'s assumption that micro-breaks beat macro-breaks.`,
  },
  {
    id: "backlinks",
    title: "Backlinks",
    tags: ["meta", "plugin"],
    created: "2026-04-13T10:00",
    edited: "2026-04-29T12:00",
    body: `Built-in plugin. When a leaf is focused, the right-hand panel shows every other leaf that links *to* it. Click any backlink to open it in the river.

This is the single most important feature of a notes system, and the cheapest to build. A bidirectional link is just a forward link, indexed.

See also: [[How plugins work]].`,
  },
  {
    id: "graph",
    title: "Graph view",
    tags: ["meta", "plugin"],
    created: "2026-04-14T10:00",
    edited: "2026-04-30T12:00",
    body: `Built-in plugin. Renders the link graph as nodes and edges. Useful for spotting *orphans* (leaves nobody links to) and *hubs* (leaves everybody links to).

Toggle in the *Plugins* sidebar section.

Honest take: graph views are admired more than used. The river is the one you'll touch every day. The graph is for monthly housekeeping.`,
  },
  {
    id: "async-standup",
    title: "Async standup format",
    tags: ["team", "method"],
    created: "2026-03-15T09:00",
    edited: "2026-04-10T09:00",
    body: `Three lines, in #standup, by 10:00 local:

1. **Yesterday** — what shipped, not what you did.
2. **Today** — the *one* thing you'll finish.
3. **Stuck** — empty most days. When it isn't, someone replies in-thread.

No "in progress." No status percentages. If it didn't ship, it doesn't count.

Used in [[Q3 retro]].`,
  },
];

window.SEED_OPEN = ["welcome", "today", "zettel-method"];
