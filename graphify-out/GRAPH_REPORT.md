# Graph Report - toza  (2026-11-27)

## Corpus Check
- 16 files · ~16,090 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .ico 2, .example 1)

## Summary
- 264 nodes · 683 edges · 12 communities (9 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea557f01`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.ts
- core.ts
- hooks.ts
- tools.ts
- ArchiveStore
- Sync
- brand.mjs
- ghost.ts
- MemoryStore
- Toza
- make_icons.py
- railway.json

## God Nodes (most connected - your core abstractions)
1. `openTozaBackup()` - 36 edges
2. `startTozaBackup()` - 19 edges
3. `viewOn()` - 18 edges
4. `Sync` - 17 edges
5. `isBlobKey()` - 14 edges
6. `Archive` - 14 edges
7. `openTozaProfile()` - 14 edges
8. `isEnabled()` - 13 edges
9. `ArchiveStore` - 12 edges
10. `MemoryStore` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Qo'shimcha imkoniyatlar (Toza zaxira oynasida)` --references--> `computeStats()`  [INFERRED]
  README.md → overlay/src/lib/toza/tools-core.ts
- `seed()` --calls--> `MemoryStore`  [EXTRACTED]
  tests/core.test.mjs → overlay/src/lib/toza/core.ts
- `seed()` --calls--> `Archive`  [EXTRACTED]
  tests/core.test.mjs → overlay/src/lib/toza/core.ts
- `canAlert()` --calls--> `alertsOn()`  [EXTRACTED]
  overlay/src/lib/toza/hooks.ts → overlay/src/lib/toza/alerts.ts
- `startTozaBackup()` --calls--> `setAlertOpener()`  [EXTRACTED]
  overlay/src/lib/toza/hooks.ts → overlay/src/lib/toza/alerts.ts

## Import Cycles
- None detected.

## Communities (12 total, 3 thin omitted)

### Community 0 - "ui.ts"
Cohesion: 0.12
Nodes (47): alertsOn(), fmtDuration(), setAlertsOn(), normalizeCode(), applyProfileTheme(), chatUsage(), checkGap(), disableBackup() (+39 more)

### Community 1 - "core.ts"
Cohesion: 0.09
Nodes (33): AAD, Archive, b32decode(), CODE_CHARS, decryptChunk(), deriveKeys(), encryptChunk(), formatCode() (+25 more)

### Community 2 - "hooks.ts"
Cohesion: 0.12
Nodes (29): Alert, cut(), describe(), notice(), pushAlert(), queue, setAlertOpener(), system() (+21 more)

### Community 3 - "tools.ts"
Cohesion: 0.12
Nodes (32): archive, store, allMessages(), chatChoices(), chatSelect(), chatMessages(), ChatStat, computeStats() (+24 more)

### Community 4 - "ArchiveStore"
Cohesion: 0.15
Nodes (7): ArchivedMessage, ArchiveStore, counts(), IdbStore, Row, strip(), wrap()

### Community 6 - "brand.mjs"
Cohesion: 0.18
Nodes (5): card, html, intro, lang, build.sh script

### Community 7 - "ghost.ts"
Cohesion: 0.35
Nodes (10): b64bytes(), bubbleList(), buildGhost(), containerPeer(), fmtTime(), GHOST_ATTR, GhostDeps, injectGhosts() (+2 more)

### Community 9 - "Toza"
Cohesion: 0.20
Nodes (9): Kalitlar, Ko'rinish va ishonch, Qoidalar (Telegram API shartlari), Railway, Sharpa ichida ochish, Toza, Toza profilim, Toza zaxirasi (o'chirilgan xabarlarni saqlash va tiklash) (+1 more)

### Community 11 - "railway.json"
Cohesion: 0.29
Nodes (6): build, builder, dockerfilePath, deploy, restartPolicyType, $schema

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `computeStats()` connect `tools.ts` to `core.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `ui.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12408163265306123 - nodes in this community are weakly interconnected._
- **Why does `Sync` connect `Sync` to `ui.ts`, `core.ts`, `hooks.ts`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `core.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Why does `Qo'shimcha imkoniyatlar (Toza zaxira oynasida)` connect `tools.ts` to `Toza`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `hooks.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11942959001782531 - nodes in this community are weakly interconnected._
- **Should `tools.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12299465240641712 - nodes in this community are weakly interconnected._