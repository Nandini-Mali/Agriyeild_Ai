# 🌾 AgriYield AI — Smart Crop Yield Prediction

A premium, full-stack AgriTech web app: Flask backend + a RandomForest crop-yield
model, wrapped in a glassmorphic, animated, Apple/Tesla-inspired UI.

## Pages
- **Landing** — animated hero, live counters, features, process, testimonials, CTA
- **About** — mission, model methodology, team
- **AI Crop Yield Prediction** — 15-input form → yield, production, confidence,
  fertilizer plan, water requirement, soil-health insights, profit estimate
- **Smart Analytics Dashboard** — Chart.js: rainfall vs yield, NPK balance, crop
  comparison, temperature radar, district performance, yearly trend, weather outlook
- **Prediction History** — session-based list of past predictions
- **AI Recommendations** — fertilizer plan per crop, irrigation & soil-pH reference
- **Contact** — animated form with success state

## Tech stack
Flask · scikit-learn (RandomForestRegressor) · pandas/numpy · Tailwind CSS (CDN) ·
Chart.js · Font Awesome · jsPDF · AOS scroll animations · vanilla ES6 JS.

## Quick start

```bash
cd agriyield-ai
python3 -m venv venv && source venv/bin/activate      # optional but recommended
pip install -r requirements.txt

# (already generated, but to regenerate the model)
python3 model/train_model.py

python3 app.py
```

Open **http://localhost:5000**

## Project structure
```
agriyield-ai/
├── app.py                  # Flask routes + JSON API (/api/predict, /api/chat, /api/weather, ...)
├── model/
│   ├── train_model.py      # synthetic data + RandomForest training pipeline
│   ├── crop_model.pkl      # trained model + label encoders (generated)
│   └── meta.json           # crop lists, base yields, water needs, metrics
├── templates/               # Jinja2 pages (base.html + 7 pages)
├── static/
│   ├── css/style.css        # design system: glassmorphism, neumorphism, motion
│   └── js/                  # main.js, predict.js, dashboard.js
└── requirements.txt
```

## Notes on the ML model
No public labelled dataset ships with this project. `model/train_model.py`
generates ~9,000 synthetic-but-agronomically-plausible samples: each crop has
published optimal rainfall/temperature/pH bands, and yield is produced from a
response-curve formula (Gaussian falloff around the optimum × NPK sufficiency ×
irrigation efficiency × soil-type factor) plus noise, then a `RandomForestRegressor`
(300 trees) is trained on the encoded features. Swap in a real dataset (e.g. ICAR /
Kaggle "Crop Yield Prediction") by keeping the same column names in
`train_model.py` and re-running it — `app.py` doesn't need to change.

## Notes on integrations
- **Weather** (`/api/weather`) is a deterministic simulator so the app runs with
  zero API keys. Swap the function body in `app.py` for a real call to
  OpenWeatherMap/WeatherAPI — the response shape is already normalized.
- **AI Chat Assistant** (`/api/chat`) is rule-based for zero-dependency operation.
  Swap in an LLM call (Anthropic/OpenAI SDK) inside `api_chat()` for open-ended answers.
- **Voice input** uses the browser's Web Speech API (Chrome/Edge support is best).
- **Auth** (login/register) is scaffolded as a UI pattern but not wired to a
  database in this build — add Flask-Login + a users table to productionize.

## Production checklist
- Set a real `app.secret_key` via environment variable
- Swap `app.run(debug=True)` for `gunicorn app:app`
- Replace synthetic training data with real regional yield records
- Add HTTPS, rate limiting, and CSRF protection on POST routes
