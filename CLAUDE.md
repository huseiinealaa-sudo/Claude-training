# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## قواعد التعامل معي

هذه القواعد لها الأولوية على كل ما يليها في هذا الملف.

- اشرح دائماً بالعربية.
- اعرض الـ diff قبل حفظ أي تعديل، وانتظر موافقتي قبل الكتابة إلى القرص.
- لا تنشئ commit قبل موافقتي على الـ diff.
- لا تدفع (push) إلى GitHub قبل موافقتي الصريحة. موافقتي على commit ليست موافقة على push.
- لا تفتح Pull Request ولا تدمج مع `main` قبل طلبي الصريح. موافقتي على push ليست موافقة على فتح PR.
- كل موافقة تخصّ خطوة واحدة بعينها، ولا تمتدّ إلى الخطوة التي تليها ولا إلى مرة قادمة.

## What this repository is

A single-page **English course web app** (`تحدّي الإنجليزية الشامل`), built for one Arabic-speaking learner going from CEFR A2 to B2. It is installed as a PWA on an iPad/iPhone home screen and served from GitHub Pages on the `main` branch.

The repository name (`Claude-training`) predates the app and no longer describes it.

**Scale:** 26 units · 182 lessons · 1307 questions · 640 vocabulary items · ~1.2 MB of content JSON.

**Design constraints that drove the architecture:**

- **The installed PWA must keep updating.** Never rename `English-A2-to-B2.html` — that filename is the installed app's identity. Renaming it silently orphans the user's home-screen icon.
- **Progress lives only in `localStorage`.** There is no backend and no sync. Any change to the storage shape must migrate, never discard (see `migrate()` in `assets/app.js`). The `#/backup` screen is the only recovery path the user has.
- **The app shell is fixed-size, content is lazy.** The shell is ~114 KB; each unit (40–57 KB) loads only when opened. Never bundle content into the shell.
- **Offline-first.** The service worker is network-first with a cache fallback. Bump `V` in `sw.js` on any change to `assets/` or `content/`, or the installed app keeps the old cached version.

## Commands

There is no build step, no bundler, and no dependency manifest. The app is plain ES2020, served as static files.

```bash
# تشغيل محلّيّ
python3 -m http.server 8099
# ثمّ افتح http://127.0.0.1:8099/English-A2-to-B2.html

# كلّ الاختبارات (يشغّل خادماً مؤقّتاً ويوقفه)
./tools/test-all.sh
PORT=8097 ./tools/test-all.sh     # منفذٌ آخر إن كان 8099 مشغولاً

# مجموعةٌ واحدة — شغّل خادماً أوّلاً، ثمّ:
python3 tools/validate.py         # بنية المحتوى مقابل ما يرسمه app.js
node tools/test-app.mjs           # انحدار: تنقّل · تكرار متباعد · كتابة · أخطاء (٤٨)
node tools/test-lock.mjs          # قفل التسلسل، بما فيه تخطّي العنوان (١٦)
node tools/test-features.mjs      # مدقّق الكتابة والنسخة الاحتياطيّة (٣٧)
node tools/test-home.mjs          # الشاشة الرئيسة: ٣ مقاسات × ٣ حالات قفل
node tools/test-layout.mjs        # مسح ٦١٥ صفحة: تجاوز العرض وأخطاء JS

# فحصٌ سريع بعد أيّ تعديل
node --check assets/app.js
python3 -c "import json,glob;[json.load(open(f)) for f in glob.glob('content/*.json')]"
```

Playwright and Chromium are pre-installed at `/opt/node22/lib/node_modules/playwright`; the test files import that path directly. Adjust the import if your Playwright lives elsewhere.

## Architecture

```
English-A2-to-B2.html   هيكل التطبيق — وسوم PWA، أيقونات base64، البيان، الهيكل الفارغ
index.html              تحويلٌ من جذر الموقع
sw.js                   عامل الخدمة — شبكةٌ أوّلاً ثمّ ذاكرة؛ V تُرفع مع كلّ تغيير
assets/app.js           المنطق كلّه (~53 KB)
assets/app.css          التنسيق كلّه (~24 KB)
content/course.json     خريطة الدورة: مستويان، ٢٦ وحدة، لكلٍّ status
content/<unit>.json     وحدةٌ كاملة: ٧ أيّام لكلٍّ blocks
tools/                  مجموعات الاختبار ومدقّق المحتوى
```

### `assets/app.js` — the sections that matter

| القسم | ما فيه |
|---|---|
| الحالة والتخزين | `S` هو كلّ شيء؛ `KEY="en-course-v2"`؛ `migrate()` ينقل من `en-a2-b2-progress-v1` |
| التكرار المتباعد | ٧ صناديق، فواصل `[0,1,3,7,16,35,75]` يوماً؛ `dueNow()` |
| النطق | Web Speech مع التفافات iOS: فكّ القفل بلمسة، `resume()` كلّ ٨ ثوانٍ، إلغاء عند `visibilitychange` |
| المحمّل | `get(id)` يجلب من `content/` ويخزّن في `cache` |
| الموجّه | تجزئة العنوان: `#/unit/<id>[/<day>]` · `#/review` · `#/errors` · `#/backup` |
| `unitLock(u)` | قفل التسلسل — يعيد `null` أو رسالة؛ مطبَّقٌ في `guard()` داخل الموجّه لا على البطاقة وحدها |
| راسمات الكتل | `rNote` `rExamples` `rPron` `rVocab` `rDialogue` `rReading` `rWriting` `rWatch` `rQuiz` |
| محرّك الأسئلة | ستّة أنواع؛ `match()` يقبل صيغاً بديلة ويتجاهل الترقيم |
| `WRULES` | ٢٦ قاعدةً لمدقّق الكتابة — أخطاء الناطقين بالعربيّة التي يعالجها المنهج |
| النسخة الاحتياطيّة | `backupBlob()` · `viewBackup()` — تصدير واستعادة كلّ التقدّم |

### Content schema

Every unit is `{id, icon, title, subtitle, intro, goals[], days[]}` with exactly **7 days** (except `phonetics`: 10 lessons, `bank`: flat).

Day types in order: `grammar` · `vocab` · `listening` · `reading` · `function` · `writing` · `test`.

Block types and their required keys — **`tools/validate.py` enforces every one of these**, so add a rule there before inventing a new shape:

| النوع | المفاتيح |
|---|---|
| `note` | `title` `html` |
| `examples` | `title` `rows[{en,ar}]` |
| `ear` / `pron` | `title` `hint` `rows[{w,s,ar}]` |
| `vocab` | `title` `items[{w,pos,ar,ex[{en,ar}]}]` |
| `dialogue` | `title` `titleAr` `lines[{sp,en,ar}]` |
| `reading` | `title` `titleAr` `en` `ar` `keys[[en,ar]]` |
| `writing` | `title` `prompt` `phrases[]` `model` `modelAr` `checklist[]` |
| `watch` | `title` `items[{t,d,task}]` |
| `quiz` | `title` `qs[]` (+ `isTest` ليوم الاختبار) |

Question kinds: `mcq` / `hear` (`q`,`opts`,`a` فهرس, `why`) · `gap` / `correct` / `dict` (`a` مصفوفة إجاباتٍ مقبولة, `why`; و`say` لـ`dict`) · `order` (`ws`,`a`,`why`).

**Never give a `gap` an empty-string answer** — the failure feedback renders `a[0]`, so an empty one shows «الصواب:» followed by nothing. Use a `correct` question instead.

### Conventions in the content

- **Level 1 (units 1–12)** explains in Arabic. **Level 2 (units 13–24)** explains in English with `<span class=n-ar>سند عربيّ</span>` — that span renders as a dashed-rule footnote with a «عربيّاً:» prefix.
- Every day carries a 🎧 `ear` block (American connected speech). Every unit ends with a 🎬 `watch` block pointing outside the app.
- Word-count targets are written inside the writing `prompt` itself — Arabic numerals in level 1 (`٦٠–٨٠ كلمة`), ASCII in level 2 (`120–140 words`). `wordTarget()` reads both.
- `unit.pinned` (phonetics, bank) means always unlocked and shown first.
- The UI is RTL Arabic; English content sits in `dir="ltr"` islands.

### Adding a unit

1. Write `content/unit-NN.json` following the schema above.
2. Flip its `status` to `"ready"` in `content/course.json`.
3. Add `"./content/unit-NN.json"` to `CORE` in `sw.js` and bump `V`.
4. `./tools/test-all.sh`.

## Working conventions

- Development happens on a feature branch; `main` is the default branch and **GitHub Pages serves it** — so work is not delivered until it is merged. Changes reach `main` via pull requests.
- The README and this file contain Arabic. Preserve existing Arabic text and its right-to-left context when editing documentation.
- `.claude/settings.json` carries project-scoped permission rules and hooks. Its Bash allowlist deliberately omits `cat` and similar file readers: a prefix rule such as `Bash(cat:*)` places no limit on the file argument, so it would bypass the path-based deny rules — read files with the Read tool instead.
- Test artifacts (`v2-*.png`, `final-*.png`, `shot*.png`) are git-ignored; do not commit screenshots.
