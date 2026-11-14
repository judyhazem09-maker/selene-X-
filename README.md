# LunaSight

LunaSight is a static React/Vite lunar south-pole mission-planning website. It can be built and hosted on GitHub Pages without a Python server or private API keys.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```powershell
cd .\frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. To create and preview the production site:

```powershell
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. In **Settings → Pages**, choose **GitHub Actions** as the deployment source.
3. Push to `main` or `master`, or start the **Deploy LunaSight to GitHub Pages** workflow manually.

The workflow builds `frontend/` and publishes `frontend/dist/`. Vite uses relative asset paths, so the launch page, application, and data files also work at a repository subpath.

## Included features and data

- The animated launch page remains `frontend/index.html`; its **Start** button opens the interactive application at `frontend/app.html`.
- The React application retains the lunar explorer, site selection, mission controls, Sun/Earth charts, power model, scenario comparison, terrain profiles, NASA image search, and Selene-X iframe.
- `frontend/public/science/manifest.json` and the binary files beside it contain original NASA/JPL Horizons DE441 hourly Sun/Earth observer ephemerides and original NASA PDS LRO LOLA 40 m DEM tiles. The frontend verifies each downloaded data file against its SHA-256 checksum.
- Mission calculations work locally for Shackleton Rim, Malapert Massif, and Connecting Ridge. Ephemeris starts must be on a whole UTC hour from 2026-01-01 through 2030-12-31; windows are 6–48 hours. LOLA profiles cover up to 10 km within the DEM's 85°S-to-pole coverage.
- `scripts/generate-static-science-data.mjs` regenerates the source archive using Node.js and the public JPL/PDS downloads. It is not needed to install dependencies or build the checked-in site.

## Static-hosting limitations

No values are fabricated when a requested coordinate, date, or terrain ray is outside the archive; the application reports the limitation. Arbitrary coordinates and dates outside the included archive require a separate server or a CORS-enabled data source.

NASA image search calls NASA's public Images API from the browser. Selene-X remains an externally hosted iframe. Those two features require an internet connection and availability of their respective services. Neither requires a LunaSight secret key.

Mission outputs are engineering estimates, not validated landing-safety results. LOLA checks a 10 km sampled ray and does not provide a complete viewshed or correct mission totals for terrain blockage. Solar output uses a 1 AU reference model; battery calculations use fixed efficiency and constant load. Geometric Earth visibility is not a communication link budget. Review the displayed source and limitations before using results.
