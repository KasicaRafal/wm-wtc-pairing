import json
from datetime import datetime, timezone
from pathlib import Path
import random

ROOT = Path(__file__).parent
TEAM_ID = "Australia Fairy Penguins"
OUT = ROOT / "samples" / "fairy-penguins"

data = json.loads((ROOT / "data" / "teams.json").read_text(encoding="utf-8"))
teams = data["teams"]
our = next(t for t in teams if t["id"] == TEAM_ID)
opponents = [p for t in teams if t["id"] != TEAM_ID for p in t["players"]]

# Complementary biases so pairings have a clear "best" assignment.
# Values are added to a base of 3 on the 1–5 scale, then jittered.
ARMY_BIAS = {
    "Brian Woods": {
        "Grymkin": 3,
        "Khador": 2,
        "Orgoth": 2,
        "Cygnar": -2,
        "Khymaera": -2,
        "Mercenaries": -1,
        "Dusk": 1,
    },
    "Tony Javelin Dijkstra": {
        "Khymaera": 3,
        "Cygnar": 2,
        "Southern Kriels": 2,
        "Grymkin": -3,
        "Khador": -2,
        "Cryx": -1,
        "Dusk": 1,
    },
    "CaptBooyah - Mitch": {
        "Cygnar": 3,
        "Convergence of Cyriss": 2,
        "Three Crown Alliance": 2,
        "Dusk": -2,
        "Orgoth": -2,
        "Khador": 1,
        "Mercenaries": -1,
    },
    "Rafal Kasica": {
        "Dusk": 3,
        "Mercenaries": 2,
        "Cryx": 2,
        "Southern Kriels": -3,
        "Grymkin": -2,
        "Orgoth": 1,
        "Khador": -1,
    },
    "Shane War Daddy Germain": {
        "Khador": 3,
        "Orgoth": 2,
        "Southern Kriels": 2,
        "Dusk": -3,
        "Cygnar": -2,
        "Khymaera": 1,
        "Grymkin": -1,
    },
}


def slug(value: str) -> str:
    import unicodedata
    import re

    n = unicodedata.normalize("NFD", value)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-zA-Z0-9]+", "_", n).strip("_")
    return n[:60]


# Crafted 5×5: Maximize total takes 5+5+5+5+1=21 (min 1).
# Avoid-worst takes 5+5+5+3+2=20 (min 2).
TRADEOFF_MATRIX = [
    [5, 2, 2, 2, 3],
    [2, 5, 2, 2, 3],
    [2, 2, 5, 2, 3],
    [2, 2, 2, 5, 3],
    [2, 2, 2, 2, 1],
]
TRADEOFF_TEAMS = ["USA Pinnacles", "Team Poland Tytus", "Flemish Giant"]


def set_score(payload: dict, opp_id: str, score: int) -> None:
    payload["ratings"][opp_id] = score
    key = payload["listChoice"].get(opp_id)
    if not key or key == "any":
        key = "0"
        payload["listChoice"][opp_id] = key
    for bucket in payload["listRatings"].values():
        bucket.pop(opp_id, None)
    payload["listRatings"].setdefault(key, {})[opp_id] = score


OUT.mkdir(parents=True, exist_ok=True)
exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
payloads = []

for player in our["players"]:
    rng = random.Random(f"wtc-sample|{player['id']}")
    biases = ARMY_BIAS[player["name"]]
    ratings = {}
    list_choice = {}
    list_ratings = {}
    list_count = max(1, len(player.get("lists") or []))
    for opp in opponents:
        army = opp.get("army") or (opp.get("faction") or "").split(" - ")[0]
        bias = max(-2, min(2, biases.get(army, 0)))
        score = 3 + bias + rng.choice([-1, 0, 0, 0, 1])
        score = max(1, min(5, score))
        list_key = str(rng.randrange(list_count))
        ratings[opp["id"]] = score
        list_choice[opp["id"]] = list_key
        list_ratings.setdefault(list_key, {})[opp["id"]] = score

    payloads.append({
        "version": 3,
        "type": "wtc-matchup-ratings",
        "team": our["name"],
        "teamId": our["id"],
        "player": player["name"],
        "playerId": player["id"],
        "faction": player["faction"],
        "exportedAt": exported_at,
        "sample": True,
        "ratings": ratings,
        "listRatings": list_ratings,
        "listChoice": list_choice,
    })

for team_name in TRADEOFF_TEAMS:
    team = next(t for t in teams if t["name"] == team_name)
    for i, payload in enumerate(payloads):
        for j, them in enumerate(team["players"]):
            set_score(payload, them["id"], TRADEOFF_MATRIX[i][j])
    print(f"Tradeoff overlay -> {team_name}")

for payload in payloads:
    filename = f"wtc-ratings-{slug(our['name'])}-{slug(payload['player'])}.json"
    (OUT / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{filename}  ({len(payload['ratings'])} ratings)")

print(f"Wrote {len(payloads)} files -> {OUT}")
