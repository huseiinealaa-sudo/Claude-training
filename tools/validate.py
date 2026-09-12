#!/usr/bin/env python3
"""تدقيقٌ شامل للمحتوى مقابل ما يرسمه app.js فعلاً."""
import json, io, glob, re, sys

BLOCKS = {
    "note":     {"req": ["title", "html"]},
    "examples": {"req": ["title", "rows"], "rows": ["en", "ar"]},
    "ear":      {"req": ["title", "hint", "rows"], "rows": ["w", "s", "ar"]},
    "pron":     {"req": ["title", "hint", "rows"], "rows": ["w", "s", "ar"]},
    "vocab":    {"req": ["title", "items"]},
    "dialogue": {"req": ["title", "titleAr", "lines"], "rows": ["sp", "en", "ar"]},
    "reading":  {"req": ["title", "titleAr", "en", "ar", "keys"]},
    "writing":  {"req": ["title", "prompt", "phrases", "model", "modelAr", "checklist"]},
    "watch":    {"req": ["title", "items"]},
    "quiz":     {"req": ["title", "qs"]},
}
QKINDS = {"mcq", "gap", "order", "dict", "correct", "hear"}
err = []
stats = {"units": 0, "days": 0, "blocks": 0, "qs": 0, "vocab": 0, "reading": 0, "dialogue": 0}

course = json.load(io.open("content/course.json", encoding="utf-8"))
ready = [u for u in course["units"] if u["status"] == "ready"]
ids = [u["id"] for u in ready]

for uid in ids:
    p = "content/%s.json" % uid
    try:
        d = json.load(io.open(p, encoding="utf-8"))
    except Exception as e:
        err.append("%s: لا يُقرأ — %s" % (p, e)); continue
    stats["units"] += 1
    if d.get("id") != uid:
        err.append("%s: معرّف داخليّ مخالف (%s)" % (uid, d.get("id")))
    for k in ("icon", "title", "days"):
        if k not in d: err.append("%s: مفتاح ناقص %s" % (uid, k))
    for day in d.get("days", []):
        stats["days"] += 1
        if "n" not in day or "type" not in day or "title" not in day:
            err.append("%s: يومٌ بمفاتيح ناقصة" % uid)
        for b in day.get("blocks", []):
            stats["blocks"] += 1
            t = b.get("type")
            if t not in BLOCKS:
                err.append("%s/يوم%s: نوع كتلةٍ مجهول '%s'" % (uid, day.get("n"), t)); continue
            spec = BLOCKS[t]
            for k in spec["req"]:
                if k not in b: err.append("%s/يوم%s/%s: مفتاح ناقص %s" % (uid, day.get("n"), t, k))
            rowkey = {"examples": "rows", "ear": "rows", "pron": "rows", "dialogue": "lines"}.get(t)
            if rowkey and rowkey in b:
                for i, r in enumerate(b[rowkey]):
                    for k in spec.get("rows", []):
                        if k not in r or not str(r[k]).strip():
                            err.append("%s/يوم%s/%s صفّ%d: %s فارغ" % (uid, day.get("n"), t, i, k))
            if t == "vocab":
                for it in b.get("items", []):
                    stats["vocab"] += 1
                    for k in ("w", "pos", "ar", "ex"):
                        if k not in it: err.append("%s: مفردة بلا %s (%s)" % (uid, k, it.get("w")))
                    allowed = ("w", "pos", "ar", "ex") + (("id",) if uid == "bank" else ())
                    extra = [k for k in it if k not in allowed]
                    if extra: err.append("%s: مفردة %s بمفاتيح زائدة %s" % (uid, it.get("w"), extra))
                    for e in it.get("ex", []):
                        if "en" not in e or "ar" not in e:
                            err.append("%s: مثال ناقص عند %s" % (uid, it.get("w")))
            if t == "reading":
                stats["reading"] += 1
                words = len(re.sub(r"<[^>]+>", " ", b.get("en", "")).split())
                floor = 50 if uid == "bank" else 150
                if words < floor: err.append("%s: نصّ القراءة قصير (%d كلمة)" % (uid, words))
                for kp in b.get("keys", []):
                    if not isinstance(kp, list) or len(kp) != 2:
                        err.append("%s: مفتاح قراءةٍ غير ثنائيّ" % uid)
            if t == "dialogue":
                stats["dialogue"] += 1
                if len(b.get("lines", [])) < 10:
                    err.append("%s: حوارٌ قصير (%d سطراً)" % (uid, len(b.get("lines", []))))
            if t == "watch":
                for it in b.get("items", []):
                    for k in ("t", "d", "task"):
                        if k not in it: err.append("%s: عنصر watch بلا %s" % (uid, k))
            if t == "quiz":
                for i, q in enumerate(b.get("qs", [])):
                    stats["qs"] += 1
                    kind = q.get("t")
                    if kind not in QKINDS:
                        err.append("%s/%s س%d: نوع سؤالٍ مجهول '%s'" % (uid, day.get("n"), i, kind)); continue
                    if "why" not in q: err.append("%s/%s س%d: بلا تفسير why" % (uid, day.get("n"), i))
                    if kind in ("mcq", "hear"):
                        opts = q.get("opts")
                        if not opts or len(opts) < 2:
                            err.append("%s/%s س%d: mcq بلا خيارات" % (uid, day.get("n"), i))
                        elif not isinstance(q.get("a"), int) or not (0 <= q["a"] < len(opts)):
                            err.append("%s/%s س%d: فهرس إجابةٍ خارج النطاق (a=%s, خيارات=%d)"
                                       % (uid, day.get("n"), i, q.get("a"), len(opts)))
                        elif len(set(opts)) != len(opts):
                            err.append("%s/%s س%d: خياراتٌ مكرّرة" % (uid, day.get("n"), i))
                        if kind == "mcq" and "q" not in q:
                            err.append("%s/%s س%d: mcq بلا نصّ سؤال" % (uid, day.get("n"), i))
                    if kind in ("gap", "correct", "dict"):
                        a = q.get("a")
                        if not isinstance(a, list) or not a or not all(isinstance(x, str) and x.strip() for x in a):
                            err.append("%s/%s س%d: %s بإجاباتٍ غير سليمة" % (uid, day.get("n"), i, kind))
                    if kind == "dict" and not q.get("say"):
                        err.append("%s/%s س%d: dict بلا say" % (uid, day.get("n"), i))
                    if kind == "order":
                        ws, a = q.get("ws"), q.get("a")
                        if not ws or not isinstance(a, str):
                            err.append("%s/%s س%d: order ناقص" % (uid, day.get("n"), i))
                        elif sorted(ws) != sorted(a.split()):
                            err.append("%s/%s س%d: كلمات order لا تطابق الإجابة" % (uid, day.get("n"), i))
                if b.get("isTest") and len(b.get("qs", [])) < 20:
                    err.append("%s: اختبار الوحدة أقلّ من ٢٠ سؤالاً (%d)" % (uid, len(b["qs"])))

# فحص وسوم HTML معطوبة ونصوص غير عربيّة/إنجليزيّة
BAD = re.compile(r'class=[؀-ۿ]|<span class=n-ar>\s*</span>|[Ѐ-ӿ]')
for p in sorted(glob.glob("content/*.json")):
    s = io.open(p, encoding="utf-8").read()
    for m in BAD.finditer(s):
        err.append("%s: نصٌّ مشبوه عند الموضع %d: %r" % (p, m.start(), s[max(0,m.start()-30):m.start()+40]))

print("📊 %d وحدة | %d يوماً | %d كتلة | %d سؤالاً | %d مفردة | %d نصّ قراءة | %d حواراً"
      % (stats["units"], stats["days"], stats["blocks"], stats["qs"],
         stats["vocab"], stats["reading"], stats["dialogue"]))
if err:
    print("\n❌ %d مشكلة:" % len(err))
    for e in err[:60]: print("  •", e)
    sys.exit(1)
print("\n✅ لا أخطاء — المحتوى كلّه مطابقٌ لما يرسمه التطبيق.")
