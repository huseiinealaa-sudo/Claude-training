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

## Repository status

This is a training/learning repository (`Claude-training`) for practicing with Claude Code. It contains four files — `README.md`, `CLAUDE.md`, `.gitignore`, and `.claude/settings.json` — and no source code, build system, test suite, or dependency manifest. The README describes the repo in Arabic: "مستودع تدريبي لتعلّم Claude Code" ("A training repository for learning Claude Code").

`.claude/settings.json` carries project-scoped permission rules and hooks. Its Bash allowlist deliberately omits `cat` and similar file readers: a prefix rule such as `Bash(cat:*)` places no limit on the file argument, so it would bypass the path-based deny rules — read files with the Read tool instead.

There are consequently no build, lint, or test commands to document. When code is added, update this file with the relevant commands (build, run, test a single test) and an architecture overview.

## Working conventions

- Development happens on feature branches (e.g. `claude/init-ijaegr`); the default branch is `main`. Changes reach `main` via pull requests (see the merged PRs #1 and #2 in the history), not direct commits.
- The README contains Arabic content. Preserve existing Arabic text and its right-to-left context when editing documentation.
