# Data sources: how each one is scraped, and how to reconnect it

This document is derived from the code in [scripts/](scripts/). It describes, for each external system this repo pulls from, **what is fetched**, **how the connection is authenticated**, **how incremental updates work**, and **the exact steps to set the connection up from scratch** on a new machine or for a new project.

## The model in one paragraph

Nothing here is a live query. Every source is pulled on demand by a script, flattened into markdown with YAML frontmatter, and written under `Projects/<Name>/<source>/`. Git is the database: the committed markdown *is* the synced state, and each script derives "what's new" by reading what is already on disk rather than keeping a separate state/cursor file. The Q&A layer ([scripts/brain_core.py](scripts/brain_core.py)) then answers questions by reading those files with `Read`/`Glob`/`Grep` — so a source that has not been synced simply does not exist as far as the app is concerned.

## At a glance

| Source | Script | Config | Credential | Transport | Output | Update strategy |
|---|---|---|---|---|---|---|
| Zulip | [sync_zulip.py](scripts/sync_zulip.py) | [zulip_sync_config.yaml](scripts/zulip_sync_config.yaml) | `zuliprc` file (default `~/.zuliprc`) | `zulip` Python client | `Projects/<N>/zulip/<stream>/<topic>.md` | Append-only, per-topic cursor |
| GitHub | [sync_github.py](scripts/sync_github.py) | [github_sync_config.yaml](scripts/github_sync_config.yaml) | `gh auth token`, else `GITHUB_TOKEN` | REST v3 via `requests` | `Projects/<N>/github/{issues,prs,releases}/` | Re-fetch + rewrite since watermark |
| Notion | [sync_notion.py](scripts/sync_notion.py) | [notion_sync_config.yaml](scripts/notion_sync_config.yaml) | `NOTION_TOKEN` in repo-root `.env` | REST v1 via `requests` | `Projects/<N>/notion/<label>/` | Re-fetch + rewrite since watermark |
| Project source code | — (git) | [.gitmodules](.gitmodules) | Git/GitHub access to the upstream repo | Git submodule | `Projects/<N>/repo/` | `git submodule update --remote` + commit the new SHA |
| Q&A history | [brain_core.py](scripts/brain_core.py) | — | — | Generated locally, not scraped | `Projects/<N>/qa/` | Written once per answered question |

Shared prerequisites for all three sync scripts:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
```

All three take `--config <path>` and `--dry-run` (fetch and print, write nothing). All three are safe to re-run; none of them require a clean working tree.

## Conventions every sync script follows

Worth knowing before reading any individual section, because they explain the shape of the output:

- **One file per unit of content** — a Zulip topic, a GitHub issue/PR/release, a Notion page.
- **YAML frontmatter carries the identity and the sync state.** There is no `.state` file, no database, no cursor stored anywhere else. `find_watermark()` / `load_existing()` reconstruct where the last run stopped by reading frontmatter off disk. Delete a file and the next run re-fetches it; delete the folder and the next run does a full backfill.
- **Config is keyed by project** (`projects: { Fabla: { ... } }`), and every project block carries its own `output:` path. Adding a second project means adding a second block, never editing the script.
- **Deterministic filenames from a stable id plus a readable slug**, so a retitle changes the filename but not the identity — each script deletes the stale file rather than leaving a duplicate behind.
- **`synced_at`** (UTC ISO timestamp) is stamped on every written file.

---

## 1. Zulip — `scripts/sync_zulip.py`

### What it pulls

For each stream listed in the config, every topic in that stream, and for each topic every message not already on disk. Message bodies are requested as **raw Zulip markdown**, not rendered HTML ([`apply_markdown: False`](scripts/sync_zulip.py#L62)).

### How the connection works

It uses the official `zulip` Python client rather than raw HTTP. The client is constructed once from a **`zuliprc` credentials file** ([sync_zulip.py:153](scripts/sync_zulip.py#L153)):

```python
client = zulip.Client(config_file=config["zuliprc"])
```

A `zuliprc` is an INI file containing `site`, `email`, and `api_key`. The path comes from the `zuliprc:` key in [zulip_sync_config.yaml](scripts/zulip_sync_config.yaml) — currently `~/.zuliprc`. It must never be committed; [.gitignore](.gitignore) blocks `zuliprc`, `*.zuliprc`, and `zuliprc-qa-bot`.

Three API calls per run, in this order ([sync_zulip.py:157-164](scripts/sync_zulip.py#L157-L164)):

1. `get_stream_id(stream)` → numeric stream id (also used to build the deep link back into Zulip).
2. `get_stream_topics(stream_id)` → every topic name in the stream.
3. `get_messages({...})` per topic, paginated 200 at a time, with a narrow of `[{stream}, {topic}]`.

### Incremental behaviour — append-only

Each topic file's frontmatter records `last_message_id`. The next run sets the fetch anchor to `last_message_id + 1`, so only genuinely new messages come back and they are appended to the existing body ([`fetch_new_messages`](scripts/sync_zulip.py#L49-L71)). A topic with nothing new is left byte-identical. This is the one source that appends rather than rewrites — Zulip messages are treated as immutable.

**Consequence to be aware of:** because it only ever fetches ids above the watermark, **message edits and deletions made after a sync are never picked up**, and a topic renamed in Zulip starts a *new* file under the new slug, leaving the old file in place.

### Output

`Projects/<Name>/zulip/<stream-slug>/<topic-slug>.md`, e.g. `Projects/Fabla/zulip/fabla-pod/<topic>.md`.

Frontmatter: `source`, `stream`, `topic`, `url`, `first_message_id`, `last_message_id`, `message_count`, `participants`, `first_message_at`, `last_message_at`, `synced_at`.

Two rendering details:
- `url` is built by [`build_topic_url()`](scripts/sync_zulip.py#L98-L101) to mirror Zulip's own URL hashing (`encodeURIComponent`, then `%XX` → `.XX`), so the link opens the exact same narrow the web app would.
- Pasted files arrive as relative `](/user_uploads/...)` links; [`absolutize_uploads()`](scripts/sync_zulip.py#L85-L90) rewrites them to absolute URLs. They still require an authenticated Zulip session to open — this fixes the path, not the access.

### Steps to replicate the connection

1. **Create the identity.** Preferred: a dedicated **bot user** in Zulip (Settings → Organization → Bots → Add a new bot, type *Generic*). A bot is revocable independently of anyone's login and only sees what it is subscribed to. Fallback: a personal API key from Settings → Personal settings → Account & privacy → API key.
2. **Download its `zuliprc`** and save it to `~/.zuliprc` (`chmod 600` it). Never place it inside the repo.
3. **Subscribe the bot to every stream you intend to sync.** This is the step that is easy to miss — a valid key with no subscription returns no topics and the script reports a failure to list topics rather than an auth error. Private streams additionally require someone already in the stream to add the bot.
4. **Declare the streams** in [scripts/zulip_sync_config.yaml](scripts/zulip_sync_config.yaml):
   ```yaml
   zuliprc: ~/.zuliprc
   projects:
     Fabla:
       streams: ["fabla pod"]
       output: Projects/Fabla/zulip
   ```
   Stream names must match Zulip exactly, including spaces and case.
5. **Verify, then run:**
   ```bash
   python3 scripts/sync_zulip.py --dry-run
   python3 scripts/sync_zulip.py
   ```
   A dry run prints one line per topic (`+N messages -> path` or `unchanged`). If the client cannot find the credentials file, replace the `~` in the config with an absolute path.

### Second Zulip connection: the Q&A bot

[scripts/zulip_qa_bot.py](scripts/zulip_qa_bot.py) opens a *separate* Zulip connection to answer `@mentions` and DMs. It deliberately uses a **different bot identity** — `~/.zuliprc-qa-bot`, configured in [zulip_qa_bot_config.yaml](scripts/zulip_qa_bot_config.yaml) — because that bot posts publicly while the sync bot only reads. Set it up the same way as above, with its own bot user.

---

## 2. GitHub — `scripts/sync_github.py`

### What it pulls

Issues, pull requests, and releases for the repo configured per project, plus every issue comment on each item.

### How the connection works

Plain REST calls with `requests` against `https://api.github.com` ([sync_github.py:58-65](scripts/sync_github.py#L58-L65)):

```
Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

**No credentials file is ever written to disk.** [`get_token()`](scripts/sync_github.py#L46-L55) prefers the `GITHUB_TOKEN` env var and otherwise shells out to `gh auth token`, borrowing the GitHub CLI's existing login.

Endpoints used:

| Call | Purpose |
|---|---|
| `GET /repos/{repo}/issues?state=all&sort=updated&direction=asc&since=<watermark>` | Issues **and** PRs — GitHub returns both here; an item is a PR when it has a `pull_request` key ([sync_github.py:118](scripts/sync_github.py#L118)) |
| `GET <item.comments_url>` | Comments, fetched only when `item["comments"] > 0` |
| `GET /repos/{repo}/releases` | Releases |

All list calls page at 100 via [`paginated_get()`](scripts/sync_github.py#L68-L79).

### Incremental behaviour — rewrite, not append

Issues and PRs are mutable (relabelled, reopened, edited), so each run re-fetches anything touched since the watermark and **overwrites** the file. The watermark is the newest `updated_at` found across the existing markdown ([`find_watermark()`](scripts/sync_github.py#L87-L95)) — no state file. If the title changed since last time, the old slug's file is deleted and replaced, matched by issue number rather than filename ([sync_github.py:152-153](scripts/sync_github.py#L152-L153)).

Releases are few and rarely edited after publishing, so **every run re-fetches and rewrites all of them** with no watermark at all.

State is normalised to `open` / `closed` / `merged`, with `merged` derived from `pull_request.merged_at` ([`item_state()`](scripts/sync_github.py#L109-L113)).

### Output

- `Projects/<Name>/github/issues/<number>-<slug>.md`
- `Projects/<Name>/github/prs/<number>-<slug>.md`
- `Projects/<Name>/github/releases/<id>-<tag>.md` — the numeric release id leads because two releases can share a tag (an orphaned draft alongside the release that superseded it); the tag follows for readability.

Issue/PR frontmatter: `source`, `repo`, `number`, `type`, `title`, `state`, `author`, `labels`, `created_at`, `updated_at`, `closed_at`, `comment_count`, `url`, `synced_at`.
Release frontmatter: `source`, `repo`, `tag`, `name`, `draft`, `prerelease`, `target_commitish`, `author`, `created_at`, `published_at`, `asset_count`, `url`, `synced_at`.

### Steps to replicate the connection

1. **Authenticate.** Either:
   ```bash
   gh auth login && gh auth status     # needs `repo` scope for private repos
   ```
   or export a fine-grained/classic PAT as `GITHUB_TOKEN` (Contents: read, Issues: read, Pull requests: read). The env var wins if both are present.
2. **Point the config at the repo** in [scripts/github_sync_config.yaml](scripts/github_sync_config.yaml):
   ```yaml
   projects:
     Fabla:
       repo: AppHatchery/Fabla-Front-end
       output: Projects/Fabla/github
   ```
   `repo` is `owner/name` exactly as it appears in the URL.
3. **Run:**
   ```bash
   python3 scripts/sync_github.py --dry-run
   python3 scripts/sync_github.py
   ```
   A first run on a busy repo is the expensive case — every item is new and each one with comments costs an extra call.

### Known gaps in this connector

Documented here because they are properties of the code, not bugs to be surprised by later:

- **Only issue-level comments are synced.** PR *review* comments and review threads live on different endpoints that are not called, so inline code-review discussion does not reach the repo.
- **No retry/backoff.** Unlike the Notion sync, responses go straight to `raise_for_status()` — a secondary rate limit aborts the run. Re-running resumes from the watermark, so this is recoverable, not destructive.
- **The `since` boundary is inclusive**, so the most recently updated item is re-fetched and rewritten on every run. Harmless, but it means "nothing changed" runs are not always zero-write.

---

## 3. Notion — `scripts/sync_notion.py`

The largest connector, because Notion returns page bodies as a tree of *block* objects rather than markdown — most of the file is a block → markdown renderer.

### What it pulls

Two source types, because Notion supports incremental fetching for one and not the other:

- **`database`** — every row becomes one file. The query endpoint accepts a `last_edited_time` filter, so unchanged rows are never fetched. Cheap to re-run.
- **`page`** — the page plus its `child_page` subtree when `recurse: true` (optionally capped by `max_depth`). Notion has no tree-diff API, so the whole tree must be walked every run just to *discover* children; unchanged pages are still skipped on write, so a no-op run leaves the working tree clean and git sees nothing.

### How the connection works

REST calls with `requests` against `https://api.notion.com/v1`, authenticated with a bearer token read from `NOTION_TOKEN` — loaded from a repo-root `.env` via `python-dotenv` at import time ([sync_notion.py:91](scripts/sync_notion.py#L91)). The API version is **pinned to `2022-06-28`** ([sync_notion.py:77](scripts/sync_notion.py#L77)); newer versions restructure databases into "data sources" and move querying to a different endpoint, which would require code changes rather than a bumped string.

| Call | Purpose |
|---|---|
| `POST /v1/search` | `--list`: everything the token can see. Matches **title text only** — it has no concept of ancestry, so it cannot answer "everything under page X" |
| `GET /v1/databases/{id}` | Database title, used for the default folder label |
| `POST /v1/databases/{id}/query` | Rows, filtered server-side on `last_edited_time` after the watermark, sorted ascending |
| `GET /v1/pages/{id}` | A page's properties |
| `GET /v1/blocks/{id}/children` | The block tree, walked recursively to render the body and discover child pages |

Everything goes through [`api()`](scripts/sync_notion.py#L154-L183), which adds the behaviour that makes long tree walks survivable:

- **Throttle:** a minimum 0.34s between requests (~3/sec, Notion's documented average).
- **Retries:** up to 5 attempts, honouring `Retry-After` on `429` and backing off exponentially on `5xx`.
- **`404` → `NotionNotFound`.** Notion returns 404 rather than 403 for objects a token may not read, so "deleted" and "no access" are indistinguishable. Either way it is caught per-page and per-subtree so one unreachable object cannot abort a run; the gap is recorded in the markdown as `<!-- notion subtree unavailable: ... -->` and printed as a `[warn]`. A 404 on a *configured root* is treated as a config error and reported as one.
- **`401`/`403`** raises an explicit "the token is probably expired or revoked" message instead of a raw traceback — relevant because a Personal Access Token can expire, unlike an internal integration secret.

### Incremental behaviour

Same watermark-from-disk pattern as GitHub: the newest `last_edited_time` across existing files. Page identity is resolved by reading `notion_id` out of frontmatter, **never** by matching filenames ([`scan_directory()`](scripts/sync_notion.py#L481-L496)) — Notion ids are time-prefixed rather than random, so pages created in the same batch share leading hex digits and a filename glob would happily match the wrong page. Pages archived or trashed in Notion get their local file deleted on the next run.

### Output

`Projects/<Name>/notion/<label>/<slug>-<32-char-id>.md`. The slug leads and the full id trails (inverting the GitHub convention) for the prefix-collision reason above; it also matches how Notion builds its own URLs, so the id is pasteable into `notion.so/<id>`.

Frontmatter: `source`, `notion_id`, `title`, `url`, `parent`, `notion_path` (breadcrumb of ancestor titles), `properties` (database columns flattened to scalars — select/status/multi-select/people/date/formula/rollup/relation/unique-id all handled), `created_time`, `last_edited_time`, `synced_at`.

Block types the renderer does not know leave a visible `<!-- unrendered notion block: <type> -->` marker rather than vanishing, which is the intended discovery mechanism after a first real sync:

```bash
grep -rho "unrendered notion block: .*" Projects/*/notion/ | sort | uniq -c | sort -rn
```

### Steps to replicate the connection

1. **Create an internal integration** at <https://www.notion.so/profile/integrations> → **New integration**. Pick the workspace, set **Type: Internal**, and under **Capabilities** enable only **Read content** — this script never writes to Notion.
2. **Copy the Internal Integration Secret** (starts with `ntn_`) into a repo-root `.env` (gitignored):
   ```
   NOTION_TOKEN=ntn_your_secret_here
   ```
3. **Grant access to each page or database.** A fresh integration can see *nothing*, even with a valid token — Notion has no "read my whole workspace" permission. For each top-level page: open it, click the **•••** in the top-right of the window (the page menu, not a block's `•••` and not **Share**), scroll to **Connections** / **Add connections** / **Connect to**, pick the integration, and **Confirm**. Access is inherited by child pages, so connecting the highest ancestor covers the subtree.
   - You need **Full access** on the page to add a connection.
   - If the integration doesn't appear in the search box, a workspace admin has restricted installs and must approve it under Settings → Connections.
   - For a database, connect it on the database's **own** full page, not a page embedding a linked view (use ⤢ *Open as full page* first).
   - Teamspaces cannot be connected in one shot — do it per top-level page.
4. **Confirm access and collect ids:**
   ```bash
   python3 scripts/sync_notion.py --list          # everything the token can see
   python3 scripts/sync_notion.py --list audio    # narrowed by title text
   ```
   Empty output means the token is valid but step 3 hasn't taken effect.
5. **Add sources to [scripts/notion_sync_config.yaml](scripts/notion_sync_config.yaml)**, one at a time:
   ```yaml
   projects:
     Fabla:
       output: Projects/Fabla/notion
       sources:
         - type: page
           id: "ed2a084a-e8ec-48b4-97d5-c7f6a8f0ff19"
           label: audio-diaries
           recurse: true
           max_depth: 2
   ```
   Keys: `type` (`database`|`page`, required), `id` (required, dashed or undashed), `label` (folder name; defaults to a slug of the Notion title — set it explicitly, because renaming in Notion would otherwise silently start a *new* folder and orphan the old one), plus `recurse` and `max_depth` for pages.
6. **Dry-run before committing to a source.** `--list` is flat and carries no parent information, so it cannot tell you which of the returned objects are roots. **Add roots only** — a child added as its own source while an ancestor is synced with `recurse: true` gets written twice into two folders. `--dry-run` walks `child_page` blocks for real and shows you exactly what a source pulls.
   ```bash
   python3 scripts/sync_notion.py --dry-run
   python3 scripts/sync_notion.py
   ```

### Two things to revisit once real content is flowing

The script tags its open decisions in place — `grep -n WIRE-UP scripts/sync_notion.py` for the map. The two that bite first:

- **Expiring asset URLs.** Files and images *uploaded* into Notion come back as signed S3 URLs that expire roughly an hour after the sync, so those links are already dead in the committed markdown. Externally-hosted (pasted-URL) images are fine. Fixing it means downloading the bytes into the repo, which is a decision about committing binaries.
- **Frontmatter noise.** Every non-empty database column currently lands in frontmatter. Real databases often have 20+ columns including formulas and rollups nobody will query, which bloats files and makes diffs noisy when an unrelated column changes. The fix is a per-source `properties:` allowlist.

---

## 4. Project source code — git submodule

Not a script. Each project's upstream repo is mounted as a git submodule, declared in [.gitmodules](.gitmodules):

```
[submodule "Projects/Fabla/repo"]
	path = Projects/Fabla/repo
	url = https://github.com/AppHatchery/Fabla-Front-end.git
```

### Steps to replicate

```bash
# First clone of this repo — without this, Projects/<Name>/repo/ is an empty directory
git submodule update --init --recursive

# Add a new project's code
git submodule add https://github.com/<org>/<repo>.git Projects/<Name>/repo

# Refresh to upstream's latest
git submodule update --remote Projects/<Name>/repo
git add Projects/<Name>/repo && git commit -m "Bump <Name> submodule"
```

**The pinned SHA is load-bearing.** [`code_blob_base()`](scripts/brain_core.py#L240-L249) runs `git rev-parse HEAD` inside the submodule and builds every code link as `https://github.com/<org>/<repo>/blob/<sha>/<path>`. That means links returned by `POST /search` always point at the exact revision the answer was read from — and equally, that the app's view of the code is frozen until someone bumps the submodule and commits the new SHA. In a deployed container this can be overridden with `CODE_BLOB_BASE_<PROJECT>`.

---

## 5. Q&A history — generated, not scraped

Listed for completeness because it lives alongside the synced folders and is searched the same way. Every question answered through the Zulip bot or the HTTP gateway is written by [`log_qa()`](scripts/brain_core.py#L145-L171) to `Projects/<Name>/qa/<timestamp>-<slug>.md` (or root `qa/` when no project matches), with frontmatter `source`, `project`, `asker`, `channel`, `source_url`, `question`, `session_id`, `sources`, `answered_at`.

In a deployed, stateless environment (`GITHUB_WRITE_TOKEN` + `GITHUB_WRITE_REPO` set) it commits through the GitHub API instead of writing to a container disk that will not survive a recycle — which is why `Log Q&A: ...` commits appear in this repo's history without anyone running a script.

---

## Onboarding a new project end to end

```bash
# 1. Code
git submodule add <upstream-url> Projects/<Name>/repo

# 2. Add a projects: block to each sync config, pointing output at Projects/<Name>/<source>
#    - scripts/github_sync_config.yaml   (repo: owner/name)
#    - scripts/zulip_sync_config.yaml    (streams: [...]; subscribe the bot first)
#    - scripts/notion_sync_config.yaml   (sources: [...]; share the pages with the integration first)

# 3. Dry-run each, then run for real
python3 scripts/sync_github.py --dry-run && python3 scripts/sync_github.py
python3 scripts/sync_zulip.py  --dry-run && python3 scripts/sync_zulip.py
python3 scripts/sync_notion.py --dry-run && python3 scripts/sync_notion.py

# 4. Write Projects/<Name>/README.md as the orientation anchor, and use
#    Projects/<Name>/docs/ for anything handwritten
```

Then commit the synced markdown — an unsynced or uncommitted source is invisible to the Q&A layer.
