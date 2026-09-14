# AppHatchery Brain — Audit & Production Plan

Produced from a full read-through of this repo as it stood in early August 2026 (`scripts/`, `Projects/Fabla/`, configs, README, Dockerfile) — before any implementation work toward a production version. Covers: how the current four source connectors work today, a refined product definition, target architecture, a generalized connector pattern, a Slack/email integration plan, rollout milestones, and open risks.

**Product framing this plan assumes** (confirmed with the project owner before writing Sections 2–7):
- The brain is meant to eventually become a product other organizations could use, not just an AppHatchery-internal tool — so v1 is planned with real multi-tenant isolation in mind, with AppHatchery as tenant #1 throughout.
- Slack and email connect via one shared, admin-authorized account per organization (a workspace-level Slack app install; one shared mailbox), not per-user OAuth.
- Sync freshness is admin-configurable per source, defaulting to a weekly schedule, with on-demand manual resync always available — not real-time/webhook-driven for v1.

---

## 1. Current State Audit

### Repo shape

This is a single monorepo, not a set of services. Everything lives under `Projects/<Name>/` (currently only `Fabla`), with five subfolders per project (`repo/`, `github/`, `zulip/`, `notion/`, `docs/`, `qa/`) plus a hand-written `README.md`. There's no database, no message queue, no background worker process — just markdown files on disk, one Python script per source, and a shared query function that shells out to an LLM agent at request time.

### The four "connectors" — how each actually works today

**1. Local docs / code — not really a connector, the least automated of the four.** The project's source lands via `git submodule add`, and the orientation doc (`Projects/Fabla/README.md`) is entirely hand-written and hand-maintained (it even timestamps itself against a specific commit SHA: "As of commit `a43da8d`... clean working tree"). There is no script that keeps this current — someone has to run `git submodule update` and manually notice when the README has drifted from the code. This is the connector most obviously incompatible with adding "projects to be identified" at scale.

**2. Zulip (`sync_zulip.py`, 169 lines).** Pull-based batch script. Per configured stream, lists topics, fetches raw (non-rendered) markdown messages, and writes one file per topic to `zulip/<stream>/<topic>.md`. Incremental sync is done by storing `last_message_id` in each file's own frontmatter and resuming from `+1` — no separate state store. This works because Zulip messages are immutable (append-only). Auth is a bot-owned `zuliprc` credentials file kept outside the repo (`~/.zuliprc`), one shared bot identity per project, not per-user. Known unfixed gap: pasted-image links are rewritten to absolute URLs but still require an authenticated Zulip session to actually view — "fixed" only in the sense of not being a broken relative path.

**3. GitHub (`sync_github.py`, 232 lines).** Pull-based batch script. Auth comes from whatever `gh auth token` returns locally (or a `GITHUB_TOKEN` env var fallback) — no credential file, but also no token rotation/refresh strategy of its own. Because issues/PRs are mutable, it re-fetches anything changed `since` a watermark — and that watermark isn't stored anywhere; it's recomputed each run as the max `updated_at` already written to disk. That's elegant for a single-writer hackathon setup, but it's a real fragility: if the output directory is ever partially deleted, moved, or written to by two runs concurrently, the watermark silently drifts with no error. Releases are simply refetched and rewritten in full every run — an explicit, reasonable-for-now assumption that release counts stay small; it would need revisiting for a project with a long release history.

**4. Notion (`sync_notion.py`, 706 lines — by far the largest script, because Notion returns a block tree, not markdown, so most of the file is a block→markdown renderer).** This is the one connector the author has explicitly and repeatedly flagged as not production-ready in the code itself: a `"WIRING THIS INTO A REAL NOTION WORKSPACE"` docstring block, five tagged `WIRE-UP A–E` TODOs (rate-limit tuning, unhandled block types, frontmatter bloat from real database columns, expiring signed asset URLs, a deliberately-pinned old API version), and a status line reading "not yet pointed at real content — only run against a throwaway sample." The config file's own comments show what happened the one time it was pointed at a real workspace: `--list` returned 183 objects with heavy title duplication and ambiguous parent/child structure, meaning **picking sync roots is an inherently manual, human-curation step per workspace** — there's no way to automate "find me the real top-level pages" from Notion's API alone.

### The query layer — "the brain" itself

This is the most important structural finding: **there is no retrieval or indexing layer at all.** `brain_core.py` doesn't build an index, embed anything, or query a database. `ask_brain()` and `search_brain()` each spin up a fresh Claude Agent SDK session per question, `cwd`-scoped to the repo (or one project subdirectory), restricted to `Read`/`Glob`/`Grep` tools, and let the model itself live-search the flat files on disk for every single question. "Retrieval" is entirely delegated to the model's own grep/glob behavior, guided only by a system-prompt note disambiguating project content from the tool's own infrastructure.

Two things about this are genuinely well-built and worth preserving:
- `resolve_resource()` never trusts the model's self-reported file paths — it recomputes each source's real URL from the file's own frontmatter or git state, so a hallucinated path just silently fails to resolve rather than becoming a broken link.
- Both Q&A and pure search share one core function used identically by the Zulip bot and the HTTP gateway, so there's exactly one place this logic lives, not two divergent implementations.

But the underlying model doesn't scale: every question costs a live LLM agent loop with an unbounded number of tool calls over the *entire* multi-project working tree, cost and latency grow with total corpus size, there's no caching or relevance ranking, and none of it is observable until the agent finishes. This is the one piece that cannot simply be "generalized" for Slack/email — it needs an actual retrieval layer.

### Deployment and operational shortcuts

- The Cloud Run gateway image bundles a full git checkout (submodule included) at build time; it explicitly requires manual rebuild+redeploy whenever repo content changes, and the README says this isn't automated yet. That means the live gateway can silently serve stale answers indefinitely.
- Because Cloud Run's filesystem is ephemeral, `log_qa()` commits each answered question straight to GitHub's Contents API as its own commit — clever, but it means every Q&A interaction becomes a commit on the main branch, which won't hold up once usage grows.
- Rate limiting (`slowapi`) is in-memory per process. Cloud Run can and does scale out to multiple instances under load, which would silently make the documented "20/minute per user" limit unenforceable across instances — not called out anywhere in the code or docs.
- No credentials are committed to git — `.env` and `zuliprc*` are properly gitignored and genuinely untracked. That's a real positive, not a shortcut.

### An inconsistency found by reading history, not from comments

The `qa/` log frontmatter schema has silently drifted with no migration: earlier logged files use a `zulip_url` field and a flat list of path strings for `sources`; current code writes `source_url` and a list of `{path, title, url, type}` objects. Nothing reads these files back in structured form today, but the moment a "search past answers" feature is built, both shapes will need handling by hand.

### The biggest cross-cutting gap: no connector abstraction

Each of the three sync scripts is a fully independent, standalone program. They agree only by convention — similar frontmatter fields (`source`, `synced_at`), a similar per-project `output:` key in their respective YAML configs — not by sharing a base class, a common retry/backoff helper, or a common "write markdown + frontmatter" utility. Today, adding Slack or email means writing a fifth from-scratch script and eyeballing which conventions to copy. There's also no test suite or CI for any of this code (`--dry-run` flags are the only verification mechanism), and the entire system currently assumes a single GitHub org / single tenant (`github_org: AppHatchery` hardcoded into the gateway's own config).

---

## 2. Refined Idea & Scope

**What the brain is:** a connector-based knowledge layer that continuously ingests an organization's scattered tools — chat, docs, issues/PRs, code, and (soon) Slack and email — into one normalized, source-attributed store, and lets that org's members ask natural-language questions or discover relevant resources across all of it, with real links back to the origin, faster than manually searching each tool one at a time.

**Core value proposition:** the time-to-context problem. Today, answering "what's the history on X" means a human manually checking Zulip, then GitHub, then Notion, then the code, then asking around. The brain collapses that into one question, answered with citations the asker can verify and follow, not a black-box summary.

**Assumptions flagged (not guessed silently):**
- "Other teams/orgs" means genuinely separate organizations (other companies), not just other internal AppHatchery teams — the latter is basically already supported by the existing `Projects/<Name>/` pattern and wouldn't require multi-tenant isolation at all. This plan targets the harder, real-multi-tenant case.
- AppHatchery remains tenant #1 throughout — the plan doesn't onboard a second real org before the multi-tenant foundation is proven end-to-end on the org that already exists.
- "Shared account per source" is per-tenant: each org's admin authorizes their own Slack workspace install and their own shared mailbox, not one global shared credential across all future tenants.

### v1 scope (in priority order)

1. **Multi-tenant data model** — every ingested item, credential, and sync job scoped by `org_id`, even though there's exactly one org today. Retrofitting this later, after data exists without it, is the expensive way to learn this lesson.
2. **Generalized connector interface** — refactor the existing Zulip, GitHub, and Notion sync scripts onto one shared abstraction *before* adding new sources, so the abstraction is validated against real, working code rather than designed in the abstract and then bent to fit.
3. **Slack connector** — shared workspace-level OAuth app, batch sync.
4. **Email connector** — shared mailbox OAuth (Gmail API or Microsoft Graph), batch sync.
5. **A real retrieval/index layer** — replacing "the model greps the whole checkout live" with actual indexed search. This is the change that makes the other four viable at any real scale; see Section 3.
6. **Admin-configurable sync scheduling** — per-source, per-org cadence, defaulting to weekly, with on-demand manual resync always available.
7. **Generalized gateway auth** — today's `github_org: AppHatchery` hardcoded membership check becomes a per-org configuration, not a code constant.

### Later-phase scope (explicitly deferred, not forgotten)

- Per-user account linking (if a tenant later wants private DMs/personal inboxes searchable — explicitly deferred for now).
- Near-real-time sync via webhooks (Slack Events API, GitHub webhooks) as an upgrade path over polling.
- Self-serve admin console for managing connections (replacing hand-edited YAML + `.env`).
- Fine-grained per-channel/per-repo access control mapped to the asking user's own permissions — today, anyone in the GitHub org sees everything synced; a real multi-tenant product will eventually need row-level permissioning, but that's a substantial feature on its own.
- Additional source types (Drive/Docs, Confluence, Linear/Jira, etc.).
- Per-tenant usage metering/billing.

---

## 3. Proposed Architecture

The central architectural change is retiring "git-committed markdown files are both the storage layer and the query mechanism" as the long-term model. It has real virtues worth keeping (human-readable diffs, git history as an audit trail, dead-simple to inspect) but it does not survive multi-tenant scale or added sources: every Slack message and email as its own git-committed file would bloat a repo without bound, and per-question git commits (today's `qa/` logging workaround) already don't scale past light usage.

```
 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 │   Zulip     │   │   GitHub    │   │   Notion    │   │ Slack/Email │  ← source APIs
 └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
        │                 │                 │                 │
        └─────────────────┴─────────────────┴─────────────────┘
                              │  (each via a Connector)
                     ┌────────▼─────────┐
                     │  Ingestion layer  │  fetch → normalize → chunk
                     │  (scheduler +     │
                     │   connector runs) │
                     └────────┬─────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
        ┌────────▼────────┐      ┌─────────▼─────────┐
        │  Canonical store │      │   Retrieval index  │
        │  (Postgres:      │      │  (embeddings, e.g. │
        │   normalized docs│      │   pgvector) fed     │
        │   + metadata,    │      │   from canonical    │
        │   per org_id)    │      │   store             │
        └────────┬────────┘      └─────────┬──────────┘
                 │                          │
                 └────────────┬─────────────┘
                    ┌──────────▼──────────┐
                    │   Query layer        │  retrieve → (optionally) agent
                    │  ask_brain() /       │  synthesizes over retrieved,
                    │  search_brain()      │  cited chunks — not a live grep
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
       ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
       │ Zulip bot   │  │ HTTP gateway│  │  (Slack bot,│
       │ (existing)  │  │ (existing)  │  │  later)     │
       └─────────────┘  └─────────────┘  └─────────────┘
```

**Ingestion layer:** a scheduler triggers connector runs per org/per source on its configured cadence (default weekly, admin-overridable, plus on-demand). Each run: fetch since last watermark → normalize into a common document schema → chunk → upsert into both the canonical store and the retrieval index. This replaces the "run the script by hand" model with an actual job.

**Storage/indexing layer:** a canonical Postgres store (or equivalent) holds normalized documents with full metadata (org, source, external id, url, author, timestamps) — this is what `resolve_resource()`'s job becomes: computing a trustworthy source URL from stored metadata, not from a live git/filesystem lookup. A vector index (pgvector is the pragmatic starting point given the current lightweight stack; a managed vector DB is a later option if scale demands it) is built from the same normalized documents for semantic retrieval. Code and hand-written docs are the one case where keeping git as the source of truth still makes sense (their versioning *is* valuable, and volume is low) — sync them into the same canonical store as read-through metadata rather than duplicating storage.

**Retrieval/query layer:** `ask_brain()`/`search_brain()` change from "let the agent grep the whole checkout" to "retrieve the top-K relevant chunks from the index, then let the agent read/reason only over those, with tool access as a fallback for exact lookups." This keeps the parts that work today (never trusting the model's own path text, structured output for search) while bounding cost/latency by retrieval quality instead of corpus size.

---

## 4. Connector Extensibility Pattern

Today, each sync script independently open-codes: getting a token, paginating an API, deciding what's new, rendering to markdown, and writing frontmatter. A shared interface should factor out everything that's genuinely the same across sources and leave only the source-specific parts to each connector.

```python
class NormalizedDocument:
    org_id: str
    source_type: str        # "zulip" | "github" | "notion" | "slack" | "email" | "code" | "doc"
    source_id: str           # e.g. repo name, channel id, mailbox address
    external_id: str         # id in the source system, stable across renames
    title: str
    body: str                 # markdown, using each source's existing rendering conventions
    url: str | None
    author: str | None
    participants: list[str]
    created_at: str
    updated_at: str
    labels: list[str]
    raw_metadata: dict        # source-specific extras, not queried on directly

class Connector(Protocol):
    source_type: str

    def authenticate(self, credentials: dict) -> None: ...

    def discover(self) -> list[SourceUnit]:
        """What CAN be synced — streams/channels/repos/databases/mailboxes
        the credential can see. Powers an admin 'pick what to sync' UI,
        replacing today's --list-and-hand-edit-YAML pattern."""

    def fetch_since(self, unit: SourceUnit, watermark: str | None) -> Iterator[RawItem]:
        """Incremental pull. Each connector owns its own watermark semantics
        (message id, updated_at, delta token) but always returns new/changed
        raw items since the given watermark."""

    def normalize(self, raw_item: RawItem) -> NormalizedDocument: ...
```

A shared **runner** (not each connector) owns: calling `fetch_since` with the last stored watermark, calling `normalize`, chunking, upserting into the canonical store + index, updating the watermark, retry/backoff on transient errors, and structured logging of what ran and what changed. This is exactly the boilerplate that's currently duplicated (with subtle differences) across all three existing scripts.

Retrofitting the existing three: Zulip's `last_message_id`-per-topic, GitHub's `updated_at`-derived watermark, and Notion's `last_edited_time`-derived watermark all become `watermark` values behind the same interface — the incremental-sync *idea* each script already has is sound and reusable; only the ad hoc "derive it from files on disk" mechanic goes away in favor of a stored watermark per `(org_id, source_type, source_id)` in the canonical store.

---

## 5. Slack & Email Integration Plan

### Slack

- **Auth:** one Slack app, installed at the workspace level by an org's admin (a `xoxb-` bot token via OAuth), matching the "shared account per source" decision. Required scopes: `channels:read`, `channels:history` (`groups:read`/`groups:history` only if the bot is deliberately invited into private channels), `users:read`. Store the token per `org_id` in a real secrets store — never in a config YAML, matching the existing `.env`/env-var pattern for `NOTION_TOKEN` etc.
- **Sync strategy (v1, batch):** for each channel the bot is a member of, paginate `conversations.history` (and `conversations.replies` for threads) incrementally from a stored `oldest` timestamp watermark — the same idea as Zulip's per-topic watermark, one document per thread.
- **A real new complexity Zulip's sync never had to handle:** Slack messages *can* be edited or deleted (`message_changed`/`message_deleted` subtypes). Zulip's append-only assumption doesn't hold here — normalization needs to treat a thread as mutable (closer to how the GitHub/Notion connectors already rewrite-on-change) rather than pure append.
- **Later phase:** Slack's Events API for near-real-time push, deferred since batch is fine for v1.

### Email

- **Auth:** Gmail API or Microsoft Graph API against one shared mailbox per org (e.g. `research@company.com`), authorized via admin consent (Gmail domain-wide delegation to a service account, or a Graph app registration with application-level `Mail.Read` permission) — not per-employee OAuth, matching the "shared account" decision. This also avoids ever storing raw IMAP passwords.
- **Sync strategy:** both APIs have a purpose-built incremental mechanism — Gmail's History API (`historyId`-based delta) and Graph's `/messages/delta` — which is a better fit than inventing another watermark scheme by hand.
- **Normalization:** one logical document per thread, individual messages preserved within it, same pattern as Slack threads and Zulip topics.
- **Flag:** email is meaningfully more sensitive (PII-heavy) than the other four sources. Access control and retention policy for the email connector should be an explicit decision before it goes live with real content, not something defaulted silently (see Section 7). Attachments carry the same "expiring/binary asset" problem Notion already has unresolved (`WIRE-UP D`) — worth solving once, in the canonical store, rather than per-connector.

---

## 6. Rollout Milestones (priority order)

| # | Milestone | Why it's positioned here |
|---|---|---|
| M0 | Multi-tenant data model + `Connector`/`NormalizedDocument` abstraction, retrofitted onto **existing** Zulip/GitHub/Notion sync (no new sources yet) | Proves the abstraction against real, working connectors before trusting it for new ones; establishes `org_id` scoping before any second tenant exists |
| M1 | Retrieval/index layer (canonical store + vector index) replacing live-grep querying; `ask_brain()`/`search_brain()` migrated to retrieve-then-reason | The single largest scale blocker; do this before adding sources, since more sources make the old live-grep model worse, not better |
| M2 | Scheduler + admin-configurable sync cadence (default weekly, manual trigger), sync run history/status | Replaces "someone remembers to run the script and redeploy" with an actual operational model |
| M3 | Slack connector | First new source, batch sync, shared workspace auth |
| M4 | Email connector | Second new source; explicitly gate on resolving the access-control/retention open question first |
| M5 | Credential/config hardening — move source credentials into a real per-org secrets store; authenticated admin API for managing connections, replacing hand-edited YAML | Needed before a second real tenant is onboarded |
| M6 (later phase) | Webhook-based near-real-time sync (Slack, GitHub); per-user account linking; per-channel/per-repo access control; additional source types; admin console UI | Genuinely separable from getting a working multi-tenant v1 out |

---

## 7. Risks & Open Questions

### Risks

- The retrieval-layer rewrite (M1) is a genuine architecture change, not an incremental patch — it's the highest-risk item for scope creep and deserves to be scoped and estimated on its own before committing to a timeline for the rest.
- Multi-tenant ambition raises v1 complexity meaningfully beyond "just add two more sync scripts" — mitigated by keeping AppHatchery as the only real tenant until M0–M2 are proven.
- Carried-over technical debt that must be *resolved*, not just inherited: Notion's five self-flagged `WIRE-UP` gaps, Slack's message-edit/delete handling (new, not present in any existing connector), email's PII/retention posture, and the git-repo-as-datastore model not scaling past light usage.
- The Cloud Run gateway's "rebuild+redeploy to see new content" model and its in-memory (non-shared) rate limiter both break as soon as there's more than one instance or one tenant — both need to be addressed as part of M1/M2, not bolted on after the fact.

### Open questions

- Vector store choice: pgvector alongside the existing Postgres-shaped stack (simple, cheap, good enough at current scale) vs. a managed vector DB (less ops, but a new dependency and cost line) — default recommendation is pgvector unless there's a reason to prefer otherwise.
- Should git-backed markdown be retired entirely, or kept as a human-browsable mirror for code/docs specifically (where versioning has real value and volume is low), while chat/email/issues live DB-only? Leaning toward the latter.
- Email retention/access policy: who *should* be able to see synced email content once it's searchable org-wide — same access as everything else, or does it need its own tighter access control from day one?
- Admin experience for v1: is hand-edited YAML + env vars acceptable a while longer (given "shared account per source" keeps auth relatively simple), or does the "product for other orgs" ambition mean a minimal admin API/UI should move earlier in the milestone order?
