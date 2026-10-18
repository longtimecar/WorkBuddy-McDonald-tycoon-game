import json, sys
sys.path.insert(0, ".")
from mcdmcp.client import MCDMCPClient

c = MCDMCPClient()
c.connect()
menu, source = c.load_game_menu(city="上海市")
events = json.load(open("data/events.json", encoding="utf-8"))
taunts = json.load(open("data/taunts.json", encoding="utf-8"))
coupons = json.load(open("data/coupons.snapshot.json", encoding="utf-8"))

payload = {
    "menu": menu,
    "menuSource": source,
    "events": events,
    "taunts": taunts,
    "coupons": coupons,
}
js = ("// 麦当劳大亨 Web 版数据层 —— 由 scripts/build_web_data.py 生成，请勿手改\n"
      "// 菜单来源：" + source + "\n"
      "(function (root, factory) {\n"
      "  var d = factory();\n"
      "  if (typeof module === 'object' && module.exports) { module.exports = d; }\n"
      "  else { root.MCD_DATA = d; }\n"
      "})(typeof self !== 'undefined' ? self : this, function () {\n"
      "  return " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n"
      "});\n")
with open("docs/data.js", "w", encoding="utf-8") as f:
    f.write(js)
print("docs/data.js written |", source, "| menu", len(menu), "events", len(events), "coupons", len(coupons))
