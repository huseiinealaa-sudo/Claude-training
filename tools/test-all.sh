#!/usr/bin/env bash
# يشغّل مجموعات الاختبار كلّها على خادمٍ محلّيّ مؤقّت.
#   ./tools/test-all.sh
# متغيّرات اختياريّة: PORT (افتراضيّاً 8099)
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8099}"
BASE="http://127.0.0.1:${PORT}"
export BASE

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 2

fail=0
run() { printf '\n═══ %s ═══\n' "$1"; shift; "$@" || fail=1; }

run "تدقيق المحتوى"        python3 tools/validate.py
run "الانحدار"             node tools/test-app.mjs
run "قفل التسلسل"          node tools/test-lock.mjs
run "المدقّق والنسخة"       node tools/test-features.mjs
run "الشاشة الرئيسة"       node tools/test-home.mjs
run "المسح الشامل"         node tools/test-layout.mjs

printf '\n'
[ $fail -eq 0 ] && echo "✅ كلّ المجموعات ناجحة" || echo "❌ أخفقت مجموعةٌ أو أكثر"
exit $fail
