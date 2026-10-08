# ASTHMA DIGITAL TWIN

Real-Time Respiratory System Simulation. An interactive educational prototype built with React, TypeScript, Vite, animated SVG anatomy and Recharts. Runs entirely in the browser; no backend, credentials or paid API.

## Run

With Node.js 22.12+ (or 24) installed:

```sh
npm ci
npm run dev
```

The development server listens on port 5173. `npm run build` creates `dist/`; `npm run preview` serves the production build. `npm test` runs physiology tests.

## Demonstration

Start Healthy, select a scenario or adjust the sliders, then trigger an attack. All metrics, airway diameter, wall thickness, mucus, airflow particles, charts and rule-based assessment share one physiology model. Administer Bronchodilator starts an illustrative recovery transition. Each transition lasts eight real seconds and represents twenty simulated minutes. The timeline lets you inspect that transition; Pause freezes the simulation clock and breathing, and Reset clears telemetry and restores baseline.

## Model and limitations

A weighted burden combines constriction, inflammation, mucus, activity and exposure. Relative radius determines resistance using `1/radius^4`, capped at 24×. Normalized airflow decreases with burden, while saturation decreases at higher burden. The respiratory-rate slider sets the base rate; compensatory response and activity can raise the displayed rate, capped at 35/min. Baseline diameter is normalized to the healthy demo twin. Charts retain the last sixty active simulation seconds; airflow oscillates with the breathing cycle.

This is a simplified single-compartment visual model, not a validated physiological predictor. Patient DT-001 is fictional. Oxygen, peak flow, severity, thresholds and confidence are illustrative. The AI panel is a transparent rule-based demonstration, not an ML service. Bronchodilator is a simulated parameter transition, with no drug or dose recommendation. Never use this prototype for diagnosis or treatment. An SVG anatomical illustration is used rather than a clinical 3D reconstruction.

Fonts are bundled locally. No runtime network service is needed, and no patient data leaves the browser.

`npm run test:browser` validates actual Chromium interactions with a running server. It uses `/usr/bin/chromium` by default; override with `CHROMIUM_PATH`. Set `TEST_URL` to test another server (for example a production preview). Screenshots are saved outside the repository in `/tmp/asthma-validation/`.

## Publish with GitHub Pages

Open the repository's **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The `.github/workflows/pages.yml` workflow tests and builds the application on each push to `main`, then deploys `dist/` to Pages. No Netlify account or external API is needed.

If the first run happened before Pages was enabled, open **Actions → Deploy to GitHub Pages → Run workflow**, select `main`, and run it again. Wait for both build and deploy jobs to succeed. The site is then available at `https://bashandilem.github.io/databees_projects_healthcare/`.

The workflow passes Vite's `--base=/databees_projects_healthcare/` (derived from the repository name) so scripts, styles and bundled fonts work at the project URL. The ordinary development and Netlify builds still use `/`. To validate the Pages build locally:

```sh
npm run build -- --base=/databees_projects_healthcare/
npm run preview -- --port 4173 --base=/databees_projects_healthcare/
# In a second terminal:
TEST_URL=http://127.0.0.1:4173/databees_projects_healthcare/ npm run test:browser
```

Publishing makes the demonstration accessible to visitors. If Pages is unavailable for this repository, check repository visibility and GitHub plan support in Settings → Pages.
