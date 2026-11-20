"""Independent data checks for the shipped historical public-filing sample."""
import json
import argparse
from decimal import Decimal
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("evidence",nargs="?",type=Path,default=Path(__file__).resolve().parents[1]/"data"/"evidence.json",help="Path to evidence.json")
args=parser.parse_args()
p=args.evidence
d=json.loads(p.read_text(encoding="utf-8"))
assert d["point_in_time_supported"] is False
assert len(d["stocks"])==6
assert len({s["code"] for s in d["stocks"]})==6
passes=[]
for s in d["stocks"]:
    m=s["metrics"]
    for key in ("revenue_growth_yoy","profit_growth_yoy"):
        v=m[key]
        assert v["source_url"].startswith("https://")
        assert v["page"]>=1 and v["published_at_precision"]=="date"
        assert v["available_at"] is None
        assert v["report_period"]=="2024-12-31" and v["unit"]=="%"
        current,prev=Decimal(v["raw_current"]),Decimal(v["raw_previous"])
        assert prev>0
        calc=(current/prev-1)*100
        assert abs(calc-Decimal(str(v["value"])))<Decimal("0.015"),(s["name"],key,calc,v["value"])
    assert m["pe_ttm"]["value"] is None
    assert m["volatility_60d"]["value"] is None
    if all(m[k]["value"]>=5 for k in ("revenue_growth_yoy","profit_growth_yoy")):
        passes.append(s["name"])
assert set(passes)=={"美的集团","贵州茅台","比亚迪"}
relaxed=[s["name"] for s in d["stocks"] if s["metrics"]["revenue_growth_yoy"]["value"]>=4 and s["metrics"]["profit_growth_yoy"]["value"]>=5]
assert set(relaxed)-set(passes)=={"海尔智家"}
print("PASS: 6 issuers, 12 financial metrics, amount-derived growth checks, provenance, null preservation, default and changed threshold results")

