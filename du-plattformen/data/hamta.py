"""Hämtar öppen data för D&U plattformens prototyp, Kungälvs tätort.

Källor: OpenStreetMap via Overpass API (ODbL) och Kungälvs kommuns öppna data (CC0).
Körs av GitHub Actions (.github/workflows/du-data.yml) och skriver JSON i samma mapp.
"""
import json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

UT = os.path.dirname(os.path.abspath(__file__))
BBOX = (57.845, 11.945, 57.895, 12.030)  # syd, väst, nord, öst
UA = {"User-Agent": "dinkonsult.se D&U plattformen prototyp (info@dinkonsult.se)"}
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
TAGG = {"highway", "name", "ref", "surface", "lit", "bridge", "tunnel", "layer", "width", "bicycle", "foot",
        "segregated", "footway", "cycleway", "sidewalk", "step_count", "handrail", "ramp", "incline", "barrier",
        "wall", "height", "material", "waterway", "natural", "leisure", "landuse", "amenity", "place", "man_made",
        "kerb", "crossing", "crossing:markings", "operator", "start_date", "lanes", "maxspeed", "area", "species",
        "genus", "leaf_type", "lamp_type", "light:method", "bridge:name", "tunnel:name", "description", "access",
        "service", "railway", "covered", "smoothness"}


def hamta(url, data=None, forsok=4, timeout=240):
    for i in range(forsok):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            print(f"  misslyckades {url[:80]} ({e}), försök {i + 1}", file=sys.stderr)
            time.sleep(10 * (i + 1))
    raise RuntimeError("gav upp: " + url)


def overpass():
    s, w, n, e = BBOX
    bb = f"({s},{w},{n},{e})"
    q = f"""[out:json][timeout:240];
(
  way["highway"]{bb};
  way["barrier"~"^(retaining_wall|wall|noise_barrier)$"]{bb};
  way["wall"="noise_barrier"]{bb};
  way["waterway"]{bb};
  way["natural"="water"]{bb};
  relation["natural"="water"]{bb};
  way["waterway"="riverbank"]{bb};
  way["leisure"~"^(park|playground|pitch|garden)$"]{bb};
  relation["leisure"="park"]{bb};
  way["landuse"~"^(grass|recreation_ground|cemetery)$"]{bb};
  way["place"="square"]{bb};
  way["railway"="rail"]{bb};
  node["natural"="tree"]{bb};
  node["highway"~"^(street_lamp|crossing|bus_stop)$"]{bb};
  node["amenity"~"^(bench|waste_basket|waste_disposal|recycling)$"]{bb};
  node["leisure"="playground"]{bb};
  node["place"~"^(suburb|neighbourhood|quarter|hamlet|village|town)$"]{bb};
  node["man_made"="manhole"]{bb};
  node["kerb"]{bb};
);
out geom qt;
relation["boundary"="administrative"]["admin_level"="7"]["name"="Kungälvs kommun"];
out geom qt;"""
    for url in OVERPASS:
        try:
            raw = hamta(url, data=urllib.parse.urlencode({"data": q}).encode(), forsok=2)
            j = json.loads(raw)
            if j.get("elements"):
                print(f"Overpass ok via {url}: {len(j['elements'])} element")
                return j, url
        except Exception as e:  # noqa
            print("Overpass fel", url, e, file=sys.stderr)
    raise RuntimeError("ingen Overpass svarade")


def kompakt(j):
    ut = []
    for el in j["elements"]:
        t = {k: v for k, v in (el.get("tags") or {}).items() if k in TAGG}
        o = {"t": el["type"][0], "i": el["id"], "g": t}
        if el["type"] == "node":
            o["p"] = [round(el["lat"], 6), round(el["lon"], 6)]
        elif el["type"] == "way":
            o["p"] = [[round(p["lat"], 6), round(p["lon"], 6)] for p in el.get("geometry", []) if p]
        else:
            o["m"] = [{"r": m.get("role", ""), "p": [[round(p["lat"], 6), round(p["lon"], 6)] for p in m.get("geometry", []) if p]}
                      for m in el.get("members", []) if m.get("type") == "way"]
        ut.append(o)
    return ut


def kungalv():
    bas = "https://catalog.kungalv.se/store"
    q = urllib.parse.quote('rdfType:http\\://www.w3.org/ns/dcat#Dataset')
    sok = json.loads(hamta(f"{bas}/search?type=solr&limit=100&query={q}"))
    dataset = []
    for ch in sok["resource"]["children"]:
        md = ch.get("metadata", {})
        subj = next((k for k in md if "http://purl.org/dc/terms/title" in md[k]), None)
        if not subj:
            continue
        titel = md[subj]["http://purl.org/dc/terms/title"][0]["value"]
        andrad = (md[subj].get("http://purl.org/dc/terms/modified") or [{}])[0].get("value")
        rowstores = set()
        for d in md[subj].get("http://www.w3.org/ns/dcat#distribution", []):
            duri = d["value"]
            try:
                dent = json.loads(hamta(duri.replace("/resource/", "/entry/") + "?format=application/json&includeAll", forsok=2))
                s = json.dumps(dent)
                for part in s.split('"'):
                    if "/rowstore/dataset/" in part and "swagger" not in part:
                        rowstores.add(part.split("?")[0].rstrip("/").replace("/json", ""))
            except Exception as e:  # noqa
                print("  distribution fel", duri, e, file=sys.stderr)
        rader = []
        for rs in sorted(rowstores)[:1]:
            url = rs + "?_limit=500"
            while url:
                sida = json.loads(hamta(url))
                rader += sida.get("results", [])
                url = sida.get("next")
        print(f"Kungälv: {titel}: {len(rader)} rader")
        dataset.append({"titel": titel, "andrad": andrad, "licens": "CC0 1.0", "kalla": sorted(rowstores)[0] if rowstores else None, "rader": rader})
    return dataset


def main():
    nu = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    j, url = overpass()
    osm = kompakt(j)
    with open(os.path.join(UT, "kungalv-osm.json"), "w", encoding="utf-8") as f:
        json.dump({"hamtad": nu, "kalla": url, "osm_tid": j.get("osm3s", {}).get("timestamp_osm_base"), "bbox": BBOX,
                   "licens": "ODbL, © OpenStreetMap-bidragsgivare", "element": osm}, f, ensure_ascii=False, separators=(",", ":"))
    kom = kungalv()
    with open(os.path.join(UT, "kungalv-kommun.json"), "w", encoding="utf-8") as f:
        json.dump({"hamtad": nu, "utgivare": "Kungälvs kommun", "katalog": "https://catalog.kungalv.se", "dataset": kom},
                  f, ensure_ascii=False, separators=(",", ":"))
    print("klart", nu)


if __name__ == "__main__":
    main()
