"""
AgriYield AI — synthetic training pipeline
Trains a RandomForestRegressor on agronomically-plausible synthetic data
(no public dataset ships with this project, so the training distribution
is generated from domain heuristics: optimal rainfall/temperature/pH bands
per crop, NPK sufficiency curves, irrigation & soil multipliers, plus noise).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import json
import os

rng = np.random.default_rng(42)
N = 9000

STATES = ["Maharashtra"]

DISTRICTS = ["Ahmednagar", "Akola", "Amravati", "Chhatrapati Sambhajinagar (Aurangabad)",
             "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia",
             "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban",
             "Nagpur", "Nanded", "Nandurbar", "Nashik", "Dharashiv (Osmanabad)", "Palghar",
             "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
             "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"]

CROPS = {
    # crop: (base_yield t/ha, opt_rain_mm, opt_temp_c, opt_ph, water_need mm)
    "Rice":        (4.2, 1200, 28, 6.2, 1250),
    "Wheat":       (3.6, 550,  20, 6.8, 550),
    "Maize":       (3.9, 700,  26, 6.0, 600),
    "Sugarcane":   (70.0, 1500, 27, 6.5, 1800),
    "Cotton":      (2.1, 700,  28, 6.8, 750),
    "Soybean":     (2.4, 650,  27, 6.3, 550),
    "Groundnut":   (1.9, 600,  27, 6.2, 500),
    "Bajra":       (1.6, 450,  30, 6.5, 400),
    "Jowar":       (1.5, 450,  28, 6.5, 400),
    "Gram (Chana)":(1.4, 400,  22, 7.0, 350),
    "Mustard":     (1.5, 350,  18, 6.8, 350),
    "Potato":      (22.0, 500, 18, 5.8, 500),
    "Onion":       (18.0, 600, 22, 6.3, 550),
    "Tomato":      (28.0, 600, 24, 6.3, 600),
    "Turmeric":    (6.5, 1200, 27, 6.0, 1400),
}

SEASONS = ["Kharif", "Rabi", "Zaid", "Summer", "Whole Year"]
SOILS = ["Alluvial", "Black (Regur)", "Red", "Laterite", "Arid (Desert)", "Loamy", "Clay", "Sandy"]
IRRIGATION = ["Drip", "Sprinkler", "Canal", "Borewell/Tube well", "Rain-fed", "Flood"]
IRRIGATION_EFF = {"Drip": 1.18, "Sprinkler": 1.10, "Canal": 1.02, "Borewell/Tube well": 1.05,
                   "Rain-fed": 0.80, "Flood": 0.95}
SOIL_FACTOR = {"Alluvial": 1.12, "Black (Regur)": 1.08, "Red": 0.92, "Laterite": 0.85,
               "Arid (Desert)": 0.72, "Loamy": 1.15, "Clay": 0.95, "Sandy": 0.80}
FERT_USED = ["Yes", "No"]

rows = []
for _ in range(N):
    crop = rng.choice(list(CROPS.keys()))
    base, opt_rain, opt_temp, opt_ph, water_need = CROPS[crop]
    state = rng.choice(STATES)
    district = rng.choice(DISTRICTS)
    season = rng.choice(SEASONS)
    area = round(float(rng.uniform(0.5, 12.0)), 2)
    rainfall = max(50, rng.normal(opt_rain, opt_rain * 0.35))
    temperature = max(5, rng.normal(opt_temp, 4.5))
    humidity = float(np.clip(rng.normal(62, 15), 15, 98))
    soil = rng.choice(SOILS)
    soil_ph = float(np.clip(rng.normal(opt_ph, 0.6), 4.0, 9.0))
    n = float(np.clip(rng.normal(90, 35), 0, 200))
    p = float(np.clip(rng.normal(45, 20), 0, 150))
    k = float(np.clip(rng.normal(55, 25), 0, 200))
    irrigation = rng.choice(IRRIGATION)
    fert_used = rng.choice(FERT_USED, p=[0.78, 0.22])

    # --- agronomic response curves ---
    rain_score = np.exp(-((rainfall - opt_rain) ** 2) / (2 * (opt_rain * 0.55) ** 2))
    temp_score = np.exp(-((temperature - opt_temp) ** 2) / (2 * 6.0 ** 2))
    ph_score = np.exp(-((soil_ph - opt_ph) ** 2) / (2 * 0.9 ** 2))
    humidity_score = np.exp(-((humidity - 65) ** 2) / (2 * 25.0 ** 2))
    npk_score = np.clip((0.4 * (n / 120) + 0.3 * (p / 60) + 0.3 * (k / 70)), 0.25, 1.4)
    fert_bonus = 1.10 if fert_used == "Yes" else 0.90
    irr_mult = IRRIGATION_EFF[irrigation]
    soil_mult = SOIL_FACTOR[soil]

    yield_val = (base * (0.20 + 0.30 * rain_score + 0.20 * temp_score + 0.12 * ph_score
                          + 0.08 * humidity_score + 0.10 * npk_score)
                 * irr_mult * soil_mult * fert_bonus)
    yield_val *= rng.normal(1.0, 0.06)
    yield_val = max(0.15 * base, yield_val)

    rows.append(dict(State=state, District=district, Crop=crop, Season=season, Area=area,
                      Rainfall=round(rainfall, 1), Temperature=round(temperature, 1),
                      Humidity=round(humidity, 1), Soil=soil, Soil_pH=round(soil_ph, 2),
                      N=round(n, 1), P=round(p, 1), K=round(k, 1), Irrigation=irrigation,
                      Fertilizer_Used=fert_used, Yield=round(yield_val, 3)))

df = pd.DataFrame(rows)

cat_cols = ["State", "District", "Crop", "Season", "Soil", "Irrigation", "Fertilizer_Used"]
num_cols = ["Area", "Rainfall", "Temperature", "Humidity", "Soil_pH", "N", "P", "K"]

encoders = {}
X = df.copy()
for c in cat_cols:
    le = LabelEncoder()
    X[c] = le.fit_transform(X[c])
    encoders[c] = le

feature_cols = cat_cols + num_cols
X_train, X_test, y_train, y_test = train_test_split(X[feature_cols], df["Yield"], test_size=0.15, random_state=42)

model = RandomForestRegressor(n_estimators=150, max_depth=12, min_samples_leaf=4,
                               n_jobs=-1, random_state=42)
model.fit(X_train, y_train)

pred = model.predict(X_test)
mae = mean_absolute_error(y_test, pred)
r2 = r2_score(y_test, pred)
print(f"MAE: {mae:.3f} t/ha | R2: {r2:.4f}")

os.makedirs("/home/claude/agriyield-ai/model", exist_ok=True)
joblib.dump({"model": model, "encoders": encoders, "feature_cols": feature_cols,
             "cat_cols": cat_cols, "num_cols": num_cols,
             "metrics": {"mae": mae, "r2": r2}}, "/home/claude/agriyield-ai/model/crop_model.pkl",
            compress=3)

meta = {
    "states": STATES, "districts": DISTRICTS, "crops": list(CROPS.keys()),
    "seasons": SEASONS, "soils": SOILS, "irrigation": IRRIGATION,
    "crop_water_need": {c: v[4] for c, v in CROPS.items()},
    "crop_base_yield": {c: v[0] for c, v in CROPS.items()},
    "metrics": {"mae": round(mae, 3), "r2": round(r2, 4), "trees": 150, "samples": N}
}
with open("/home/claude/agriyield-ai/model/meta.json", "w") as f:
    json.dump(meta, f, indent=2)

print("Saved model + meta.json")
