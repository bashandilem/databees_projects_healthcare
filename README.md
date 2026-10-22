# ASTHMA DIGITAL TWIN

Real-Time Respiratory System Simulation. An interactive educational prototype built with React, TypeScript, Vite, interactive Three.js anatomy and Recharts. Runs entirely in the browser; no backend, credentials or paid API.

## Run

With Node.js 22.12+ (or 24) installed:

```sh
npm ci
npm run dev
```

The development server listens on port 5173. `npm run build` creates `dist/`; `npm run preview` serves the production build. `npm test` runs physiology tests.

## Demonstration

Start Healthy, select a scenario or adjust the sliders, then trigger an attack. All metrics, airway diameter, wall thickness, mucus, airflow particles, charts and rule-based assessment share one physiology model. Administer Bronchodilator starts an illustrative recovery transition. Each transition uses elapsed time rather than frame count, so low frame rates do not slow the physiology. Hidden tabs suspend the simulation. Each transition lasts eight real seconds and represents twenty simulated minutes. The timeline lets you inspect that transition; Pause freezes the simulation clock, breathing and airflow particles, and Reset clears telemetry and restores baseline.

## Model and limitations

A weighted burden combines constriction, inflammation, mucus, activity and exposure. Relative radius determines resistance using `1/radius^4`, capped at 24×. Normalized airflow decreases with burden, while saturation decreases at higher burden. The respiratory-rate slider sets the base rate; compensatory response and activity can raise the displayed rate, capped at 35/min. Baseline diameter is normalized to the healthy demo twin. Charts retain the last sixty active simulation seconds; airflow oscillates with the breathing cycle.

This is a simplified single-compartment visual model, not a validated physiological predictor. Patient DT-001 is fictional. Oxygen, peak flow, severity, thresholds and confidence are illustrative. The AI panel is a transparent rule-based demonstration, not an ML service. Bronchodilator is a simulated parameter transition, with no drug or dose recommendation. Never use this prototype for diagnosis or treatment. The 3D anatomy is a procedural educational illustration, not a clinical reconstruction. It shows 1,205 representative branches across nine generations; real lungs contain far more microscopic airways and patient-specific variation.

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


## Explore the anatomy (v2)

- **3D anatomy:** drag to rotate, scroll to zoom, or focus the canvas and use arrow keys / + / −. Change lung opacity, toggle the rib cage and air particles, or use Reset view. On touch screens, drag with one finger and pinch to zoom.
- **Inspect:** select a lobar bronchus, a small bronchiole or the cartilage-supported trachea. Cyan points in the main model select the five lobar regions.
- **Wall cutaway:** inspect connective tissue, smooth muscle, submucosa, folded epithelium and an uneven mucus film. Each layer can be hidden; Separate layers spreads them apart for explanation.
- **Inside airway:** look down the selected lumen. Mucus occupies space and narrows the opening, inflammation thickens submucosa and contraction tightens the wall. The larger transverse sections below use the same layer geometry and show healthy versus current open area.
- **Expand:** enlarges the viewer; Escape closes it.

The full tree uses a normalized average radius; the local wall illustration adds circumferential folds and irregular mucus thickness. The area readout integrates the local radial profile, so it is not the same as the linear airflow score. Tracheal contraction is attenuated to illustrate its supporting cartilage. Layer dimensions, microscopic textures and generation layout are illustrative and not reconstructed from a person's scan. This is not a complete histology or airway atlas.

3D needs WebGL 2 / browser hardware acceleration. If unavailable, the live SVG layer comparison and all simulation controls continue to work. No remote model downloads or paid APIs are used. Geometry, tissue textures and fonts are generated or bundled locally.

`npm test` runs eleven physiology, anatomy and body-surface tests. `npm run test:anatomy` exercises the 3D view, actual canvas changes, mucus geometry, layer visibility, region selection and mobile layout. Both browser scripts accept `TEST_URL` and `CHROMIUM_PATH`. Headless Chromium uses its software WebGL renderer for validation.

## Respiratory studio (v3)

The default atlas places the breathing lungs inside a continuous, translucent human upper body. The body is an implicit surface with connected shoulders, arms, neck and head; rim lighting keeps the organ model visible. The lungs use asymmetric contours, a left cardiac indentation, surface-aligned fissures, a procedural pleural microtexture and cartilage-supported central airways. Lung tissue moves with respiration while the surrounding body stays stable.

Use **Human context** for the torso overview or **Focus lungs** for a closer inspection. **Tissue detail** emphasizes the lung surface; **Bronchial tree** reduces tissue opacity to expose branching. These presets share the existing opacity slider and do not change simulation inputs. Rotation, zoom, layer inspection, endoscopy and region selection remain available. The studio uses a graphite/lavender interface and adapts to mobile screens.

Rendering uses Three.js/WebGL in the browser. It is a procedural educational model, not a Unity build or patient-derived clinical twin. No remote assets or services are required. The anatomy browser test covers both camera framings and tissue presets; the body geometry test verifies a single connected, closed surface.
