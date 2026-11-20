# WuWa Pull Planner

A pull planner and team builder for Wuthering Waves. Fan-made, not affiliated with Kuro Games.

- **Quick setup** on the first visit: server, inventory, pity and a first target. No personal values are built in.
- **Overview:** your targets in pull order, each with its own banner end (phase 1 / phase 2), chance for each, guarantee and how much you need to farm per day
- **Resources / Analysis / Scenarios:** inventory, income, chance curve and what-if comparisons
- **Teams:** your roster with sequences and signature weapons, best teams from the 3.8 tier list, your own teams with a clear chance
- **History:** Convene history import like WuWa Tracker, luck rating and 50/50 rate

Everything runs in the browser. Plan, roster and history are stored in the visitor's own browser (localStorage).
The history import talks directly to Kuro's official Convene API, no other server is involved.

## Importing the Convene history

1. Open **Convene > History** in the game.
2. On the Import page click **Pick Client.log** (game folder `Client\Saved\Logs\Client.log`). The browser reads the link from the log, also the obfuscated newer version. Nothing is uploaded.
   The old way still works: `irm "https://<your-name>.github.io/<repo>/import.ps1" | iex` in PowerShell copies the link.
3. The link is only stored if you tick **Remember the link**.

## Publishing on GitHub Pages

1. On github.com click **New repository**, name it for example `wuwa-planner`, set it to **Public**, create it.
2. Click **uploading an existing file** and drag in everything from this folder (the files and the folders `assets`, `fonts`, `images`). Click **Commit changes**.
3. Open **Settings > Pages**. Under **Build and deployment** choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute or two the site is live at `https://<your-name>.github.io/wuwa-planner/`.

To update later, upload the changed files again in the same way.

## Images

Without images the cards show silhouettes. You can add PNGs to `images/resonators`, `images/weapons` and `images/currency`.
The file names are listed in the `README.md` inside each folder (lower case, letters and digits only, e.g. `yangyangxuanling.png`).
Only upload images you are allowed to publish.

**Easy way:** `prepare_images.bat` (needs Python and `py -m pip install pillow` once) sorts, renames and shrinks your own images for you.

**Rover:** one picture is enough. Name it `Rover` (or put it in `raw_images/resonators` as `Rover.png`). The site uses it for Rover (Aero / Electro / Havoc / Spectro) and marks each one with its element icon and colour. A picture with a Rover for every element (`roveraero.png`, ...) still wins if you add it.

1. Run it once. It creates `raw_images/resonators`, `raw_images/weapons` and `raw_images/currency`.
2. Put your original files in there, any file names ("Jinhsi.png", "Jinhsi Splash Art.jpg" ...).
3. Run it again. The finished files (300x400 px for resonators, small icons for the rest) land in `images/`, and it lists everything it could not recognise or that is still missing.

`raw_images` is in `.gitignore`, so the big originals are not uploaded. Add `--dry-run` to only preview.

## Updating the data

- `data.js`: banner calendar (phases with end dates), servers, standard 5★ pool, income estimates, team tier sources. Update it every phase.
- `teams.js`: resonator list and team tiers (`RESONATORS`, `TEAM_TEMPLATES`, Version 3.8).
- `calc.js`: the probability engine. `node tests/check.js` compares it with a simulation (run it after changes).

## Pull model

Default: 0.8% base rate, soft pity from pull 66 (+5% per pull), hard pity 80, 50/50 on the featured resonator banner,
weapon banner always featured. Kuro publishes base rate and hard pity, the soft pity curve is a community estimate,
so it can be changed on the Resources page. Chances are estimates, guarantee values are exact (worst case).
Days are counted with the daily reset at 04:00 server time of the chosen server.
