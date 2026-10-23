# guranshdeol/guranshdeol: GitHub profile README

The README is a terminal / Nutanix NCC health-check theme. It is a "trailer" for the portfolio at
https://guranshdeol.tech, so it doesn't list projects or repeat what the portfolio already shows.
Almost everything on the page is a generated SVG in `assets/`, each in a `-dark` and a `-light`
version, shown with `<picture>` and `prefers-color-scheme`.

## Page order

1. Name banner + health-check terminal (`assets/health-check-*.svg`), links to guranshdeol.tech
2. `$ ssh dc-blr-01`: data centre with a homelab bench (`assets/datacenter-*.svg`)
3. `$ lsmod`: skills in three rows: core infra (Nutanix tile + Skill Icons), AI tools (`assets/ai-*.svg`), the rest
4. `$ tail activity.log`: 5 numbered lines between `<!-- ACTIVITY:START -->` and `<!-- ACTIVITY:END -->`
5. `$ ncc stats`: github-readme-stats and streak cards, recoloured to match
6. `$ ncc topology`: contribution skyline (`assets/topology-*.svg`)
7. Footer terminal (`assets/footer-*.svg`) with plain text links under it

The Holopin board is commented out in the README, kept for later.

## Scripts (`scripts/`, plain Node, no dependencies)

| Script | Writes | When |
| --- | --- | --- |
| `health-check.mjs` | `health-check-*.svg` (latest video from the YouTube feed, uptime since 2021-10-01) | workflow |
| `update-readme.mjs` | activity log in README.md, `topology-*.svg`, `footer-*.svg` (weekly fortune) | workflow |
| `datacenter.mjs` | `datacenter-*.svg` | by hand |
| `tiles.mjs` | `nutanix-*.svg`, `ai-*.svg` (logos from simple-icons and lobe-icons) | by hand |

Shared modules: `terminal.mjs` (terminal palette and window frame), `iso.mjs` (isometric/oblique
renderer and the scene card), `sections.mjs` (replaces text between README markers).

```bash
node scripts/health-check.mjs        # pass --force to build even if the YouTube feed is down
node scripts/update-readme.mjs       # GITHUB_TOKEN is optional; the topology reads the public calendar
node scripts/datacenter.mjs
node scripts/tiles.mjs
```

## Workflow

`.github/workflows/update-readme.yml` runs every 6 hours (and on demand) on `main` only. It runs the
two workflow scripts, commits `README.md` and `assets/` as github-actions[bot] if anything changed,
and makes an empty commit after 50 quiet days so GitHub doesn't pause the schedule.

- If a feed or API is down, the scripts keep the last good output instead of writing a partial one.
- The topology comes from the public calendar at github.com/users/guranshdeol/contributions, which
  includes private-repo counts. GraphQL is only a fallback and counts public work only.
- Activity is newest first across GitHub events, YouTube and Hashnode, with no slots kept per source.
  A burst of PRs in one repo on one day is one line, and "opened" is dropped when the merge is listed.

## Rules for this repo

- No `Co-Authored-By: Claude` lines in commits, and no Claude attribution in PR descriptions.
- Ask Guransh before adding or removing skills, tools or logos. Only list tools he actually uses.
- Keep the slow intro: name, then subtitle, each appearing whole; then the command types out and the
  check lines appear about 1.2 s apart.
- Every image needs both a dark and a light version, and the same width as the others (860px).
- README links can't open in a new tab (GitHub strips `target`), and pictures can't be interactive.
- After changing a script, run it, check the SVGs in a browser in both themes, then commit the
  script and its output together.
- Squash-merge pull requests into `main`. The pre-redesign README is kept as the
  `readme-v1-backup` branch and the `readme-v1` tag.
