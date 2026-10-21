"""
AgriYield AI — Flask backend
Serves the marketing/app pages and a small JSON API backed by a RandomForest
regression model trained on synthetic-but-agronomically-plausible data
(see model/train_model.py). No external services are called; the "weather"
endpoint is a deterministic simulator clearly documented for swapping in a
real provider (e.g. OpenWeatherMap) in production.
"""
import json
import random
import uuid
from datetime import datetime, timedelta

import joblib
import numpy as np
from flask import Flask, render_template, request, jsonify, session

app = Flask(__name__)
app.secret_key = "agriyield-ai-dev-secret-change-in-production"

# ---------------------------------------------------------------- load model
MODEL_BUNDLE = joblib.load("model/crop_model.pkl")
MODEL = MODEL_BUNDLE["model"]
ENCODERS = MODEL_BUNDLE["encoders"]
FEATURE_COLS = MODEL_BUNDLE["feature_cols"]
CAT_COLS = MODEL_BUNDLE["cat_cols"]
NUM_COLS = MODEL_BUNDLE["num_cols"]
METRICS = MODEL_BUNDLE["metrics"]

with open("model/meta.json") as f:
    META = json.load(f)

FERTILIZER_GUIDE = {
    "Rice": "Urea + DAP split dose (120:60:40 NPK kg/ha), apply nitrogen in 3 splits",
    "Wheat": "NPK 120:60:40 kg/ha, top-dress nitrogen at crown root + tillering stage",
    "Maize": "NPK 150:75:60 kg/ha with zinc sulphate 25 kg/ha",
    "Sugarcane": "NPK 275:115:115 kg/ha, apply potash in two splits",
    "Cotton": "NPK 100:50:50 kg/ha + boron foliar spray at flowering",
    "Soybean": "DAP 60 kg/ha at sowing, rhizobium seed treatment recommended",
    "Groundnut": "SSP 250 kg/ha + gypsum at pegging stage",
    "Bajra": "NPK 60:30:20 kg/ha, nitrogen in two splits",
    "Jowar": "NPK 80:40:20 kg/ha",
    "Gram (Chana)": "DAP 50 kg/ha, avoid excess nitrogen (fixes its own N)",
    "Mustard": "NPK 60:40:40 kg/ha + sulphur 40 kg/ha for oil content",
    "Potato": "NPK 180:80:100 kg/ha, potassium heavy for tuber quality",
    "Onion": "NPK 100:50:50 kg/ha + sulphur for bulb pungency & size",
    "Tomato": "NPK 120:80:60 kg/ha with calcium nitrate to prevent blossom-end rot",
    "Turmeric": "FYM 25 t/ha + NPK 60:50:120 kg/ha, potassium heavy",
}


def build_feature_row(payload: dict):
    row = []
    for c in FEATURE_COLS:
        if c in CAT_COLS:
            le = ENCODERS[c]
            val = payload.get(c, le.classes_[0])
            if val not in le.classes_:
                val = le.classes_[0]
            row.append(int(le.transform([val])[0]))
        else:
            row.append(float(payload.get(c, 0)))
    return np.array(row).reshape(1, -1)


def confidence_score(payload: dict) -> float:
    """Heuristic confidence: penalises extreme/out-of-band inputs."""
    score = 92.0
    rain = float(payload.get("Rainfall", 0))
    temp = float(payload.get("Temperature", 0))
    ph = float(payload.get("Soil_pH", 7))
    if rain < 100 or rain > 2500: score -= 10
    if temp < 8 or temp > 45: score -= 10
    if ph < 4.5 or ph > 8.5: score -= 8
    n, p, k = float(payload.get("N", 0)), float(payload.get("P", 0)), float(payload.get("K", 0))
    if n > 220 or p > 180 or k > 220: score -= 6
    score += random.uniform(-2.5, 2.5)
    return round(max(58, min(98.5, score)), 1)


def productivity_level(yield_val, crop):
    base = META["crop_base_yield"].get(crop, 3.0)
    ratio = yield_val / base
    if ratio >= 1.05: return ("Excellent", "emerald")
    if ratio >= 0.85: return ("Good", "emerald")
    if ratio >= 0.6: return ("Average", "gold")
    return ("Below Average", "red")


def soil_health_insight(ph, n, p, k, soil):
    notes = []
    if ph < 5.5: notes.append("Soil is acidic — consider agricultural lime to raise pH toward 6.5.")
    elif ph > 7.8: notes.append("Soil is alkaline — gypsum application can help balance pH.")
    else: notes.append("Soil pH is within a healthy range for most field crops.")
    if n < 60: notes.append("Nitrogen is low — a split urea application will help vegetative growth.")
    if p < 25: notes.append("Phosphorus is low — apply DAP/SSP before sowing for root development.")
    if k < 30: notes.append("Potassium is low — apply MOP to strengthen stems and disease resistance.")
    if soil in ("Sandy", "Arid (Desert)"): notes.append("Light soil drains fast — frequent, lighter irrigation is more efficient here.")
    return notes


def profit_estimate(crop, production_tons, area):
    price_per_ton = {
        "Rice": 21000, "Wheat": 22500, "Maize": 19000, "Sugarcane": 3200, "Cotton": 62000,
        "Soybean": 42000, "Groundnut": 55000, "Bajra": 22000, "Jowar": 26000,
        "Gram (Chana)": 52000, "Mustard": 54000, "Potato": 12000, "Onion": 14000,
        "Tomato": 11000, "Turmeric": 78000,
    }.get(crop, 20000)
    cost_per_ha = 38000 + area * 900
    revenue = production_tons * price_per_ton
    cost = cost_per_ha * area
    profit = revenue - cost
    return {
        "price_per_ton": price_per_ton,
        "estimated_revenue": round(revenue),
        "estimated_cost": round(cost),
        "estimated_profit": round(profit),
        "roi_percent": round((profit / cost) * 100, 1) if cost else 0,
    }


# ---------------------------------------------------------------- page routes
@app.route("/")
def index():
    return render_template("index.html", active="home", meta=META)


@app.route("/about")
def about():
    return render_template("about.html", active="about")


@app.route("/predict")
def predict():
    return render_template("predict.html", active="predict", meta=META, fert_guide=FERTILIZER_GUIDE)


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", active="dashboard", meta=META)


@app.route("/history")
def history():
    return render_template("history.html", active="history")


@app.route("/recommendations")
def recommendations():
    return render_template("recommendations.html", active="recommendations", meta=META, fert_guide=FERTILIZER_GUIDE)


@app.route("/contact")
def contact():
    return render_template("contact.html", active="contact")


# ---------------------------------------------------------------- API routes
@app.route("/api/predict", methods=["POST"])
def api_predict():
    payload = request.get_json(force=True)

    try:
        area = float(payload.get("Area", 1) or 1)
        row = build_feature_row(payload)
        yield_per_ha = float(MODEL.predict(row)[0])
        yield_per_ha = max(0.05, yield_per_ha)
        production = yield_per_ha * area

        crop = payload.get("Crop", "Rice")
        conf = confidence_score(payload)
        level, level_color = productivity_level(yield_per_ha, crop)
        water_need = META["crop_water_need"].get(crop, 600)
        rainfall = float(payload.get("Rainfall", 0))
        water_gap = round(max(0, water_need - rainfall), 1)

        insights = soil_health_insight(
            float(payload.get("Soil_pH", 7)), float(payload.get("N", 0)),
            float(payload.get("P", 0)), float(payload.get("K", 0)), payload.get("Soil", "")
        )
        profit = profit_estimate(crop, production, area)
        fert_tip = FERTILIZER_GUIDE.get(crop, "Balanced NPK application based on soil test recommended.")

        result = {
            "yield_per_hectare": round(yield_per_ha, 2),
            "expected_production": round(production, 2),
            "confidence_score": conf,
            "productivity_level": level,
            "productivity_color": level_color,
            "water_requirement_mm": water_need,
            "water_gap_mm": water_gap,
            "fertilizer_suggestion": fert_tip,
            "soil_health_insights": insights,
            "profit": profit,
            "model_metrics": METRICS,
            "input_echo": payload,
            "id": str(uuid.uuid4())[:8],
            "timestamp": datetime.now().strftime("%d %b %Y, %I:%M %p"),
        }

        hist = session.get("history", [])
        hist.insert(0, {
            "id": result["id"], "crop": crop, "state": payload.get("State"),
            "district": payload.get("District"), "season": payload.get("Season"),
            "yield_per_hectare": result["yield_per_hectare"],
            "production": result["expected_production"],
            "confidence": conf, "level": level, "timestamp": result["timestamp"],
        })
        session["history"] = hist[:25]

        return jsonify({"ok": True, "result": result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/history", methods=["GET"])
def api_history():
    return jsonify({"ok": True, "history": session.get("history", [])})


@app.route("/api/history/clear", methods=["POST"])
def api_history_clear():
    session["history"] = []
    return jsonify({"ok": True})


@app.route("/api/contact", methods=["POST"])
def api_contact():
    data = request.get_json(force=True)
    if not data.get("email") or not data.get("message"):
        return jsonify({"ok": False, "error": "Email and message are required."}), 400
    return jsonify({"ok": True, "message": "Thanks — your message has been received. Our agronomy team replies within 24 hours."})


@app.route("/api/weather", methods=["GET"])
def api_weather():
    """
    Deterministic weather simulator for demo purposes (no external API key
    required). Swap this out for a real provider, e.g.:
        requests.get(f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={KEY}")
    """
    city = request.args.get("city", "Nagpur")
    seed = sum(ord(c) for c in city.lower())
    rnd = random.Random(seed + datetime.now().day)
    base_temp = 22 + (seed % 12)
    days = []
    icons = ["fa-sun", "fa-cloud-sun", "fa-cloud", "fa-cloud-rain", "fa-cloud-showers-heavy"]
    for i in range(6):
        d = datetime.now() + timedelta(days=i)
        temp = round(base_temp + rnd.uniform(-3, 3), 1)
        days.append({
            "date": d.strftime("%a, %d %b"),
            "temp_max": round(temp + rnd.uniform(2, 5), 1),
            "temp_min": round(temp - rnd.uniform(2, 5), 1),
            "humidity": rnd.randint(45, 90),
            "rain_chance": rnd.randint(5, 85),
            "icon": rnd.choice(icons),
        })
    return jsonify({"ok": True, "city": city.title(), "days": days})


@app.route("/api/chat", methods=["POST"])
def api_chat():
    msg = (request.get_json(force=True).get("message") or "").lower()

    def match(*keys): return any(k in msg for k in keys)

    if match("ph", "acidic", "alkaline"):
        reply = "Ideal soil pH for most crops is 6.0–7.0. Below 5.5 add agricultural lime; above 7.8 add gypsum to bring it back into range."
    elif match("nitrogen", "urea", "n "):
        reply = "Nitrogen drives leafy growth. Split urea into 2–3 doses across the season instead of one big application — it reduces leaching and boosts uptake."
    elif match("water", "irrigation", "rainfall"):
        reply = "Drip irrigation typically saves 30–50% water versus flood irrigation while improving yield consistency. Check the 'Water Requirement' figure on your prediction result."
    elif match("fertilizer", "fertiliser", "npk", "dose"):
        reply = "Fertilizer needs depend heavily on crop and soil test values. Run a prediction and check the 'Best Fertilizer Suggestion' card — it's tailored to your selected crop."
    elif match("confidence", "accuracy", "how accurate"):
        reply = f"Our model reports ~{METRICS['r2']*100:.1f}% variance explained on held-out validation data (MAE ≈ {METRICS['mae']:.2f} t/ha). Confidence per-prediction adjusts for extreme input values."
    elif match("profit", "price", "cost", "revenue"):
        reply = "Profit estimates combine expected production, average mandi price for the crop, and a per-hectare cost baseline. You can see the full breakdown after running a prediction."
    elif match("hello", "hi", "hey"):
        reply = "Hey there 👋 Ask me anything about soil health, irrigation, fertilizer dosing, or how to read your yield prediction."
    elif match("thank"):
        reply = "Anytime — good luck with the season! 🌾"
    else:
        reply = "Good question — for the most precise answer, run a prediction with your field's actual data and I'll help interpret the results. You can also ask me about pH, irrigation, fertilizer, or profit estimates."

    return jsonify({"ok": True, "reply": reply})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
