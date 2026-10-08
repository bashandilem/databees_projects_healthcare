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
