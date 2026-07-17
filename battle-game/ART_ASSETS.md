# Wordfront 美術素材紀錄

> 2026-07-18 更新：初代平滑線條稿已直接替換為一致的 8-bit／16-bit 時代點陣風格。下方初代 prompt 保留作為設計歷程，不代表目前遊戲載入的素材。

## 1. 文件目的

本文件記錄 Wordfront AI 原型美術的實際產出、存放位置、共用生成規格、角色 prompt 與後續姿勢製作順序。遊戲企劃與程式素材契約分別以 [GAME_DESIGN.md](./GAME_DESIGN.md) 和 [ARCHITECTURE.md](./ARCHITECTURE.md) 為準。

## 2. 目前使用的點陣素材

| 角色 | 專案路徑 | 朝向 | 主色 | 狀態 |
| --- | --- | --- | --- | --- |
| 單字魔法師待機 | `assets/player/mage-base.png` | 右 | 藍色／奶油色 | 已替換為點陣圖 |
| 單字魔法師攻擊 | `assets/player/mage-cast-01.png` ～ `mage-cast-06.png` | 右 | 藍色／奶油色 | 已生成六影格 |
| 普通墨水怪 | `assets/enemies/normal/normal-base.png` | 左 | 青綠色／薄荷色 | 已替換為點陣圖 |
| 強力書頁怪 | `assets/enemies/strong/strong-base.png` | 左 | 紫色／淡紫色 | 已替換為點陣圖 |
| Boss 混沌怪 | `assets/enemies/boss/boss-base.png` | 左 | 深紅色／珊瑚色 | 已替換為點陣圖 |

所有遊戲用圖均為 1024 × 1024 RGBA PNG，四角完全透明，角色腳底 alpha 邊界統一對齊 y = 922。顏色經有限色盤量化、alpha 採硬邊界，CSS 使用 `image-rendering: pixelated`／`crisp-edges`，避免縮放後變模糊。

玩家攻擊影格順序為：待機準備、後仰蓄力、最大蓄力、向前施法、延伸收招、回復待機。每格 115ms，整段 690ms；圖片在遊戲 intro 階段預載，避免第一次攻擊閃空。

影格表切割後必須執行 `scripts/clean-pixel-components.py`，只保留每張圖最大的 alpha 連通主體。2026-07-18 的檢查在第 5 格找到 434、116 像素的兩塊殘片，第 6 格找到 187、46 像素的兩塊殘片，均已移除；清理後六格各自只有一個角色主體。

## 3. 共用生成規格

- 使用 built-in image generation 產生角色原圖。
- 風格：簡單、乾淨的 2D 卡通線條，深海軍藍描邊、平面填色、極少陰影。
- 構圖：單一角色、全身、方形畫布、置中、保留安全邊距。
- 玩家朝右；所有怪物朝左。
- 不產生文字、字母、符號、UI、血條、邊框、水印、背景場景或地面陰影。
- 生成階段使用純色 chroma-key 背景，再以本機工具移除背景。
- 青綠色普通怪使用 `#ff00ff` key，其他角色使用 `#00ff00` key，避免 key 色出現在角色本體。
- 背景移除後統一縮放到 1024 × 1024，並將腳底 alpha 邊界對齊共同基準線。
- 角色基準圖是後續姿勢的一致性參考，不直接重新設計角色。

## 4. Prompt 規格

### 4.1 共用 prompt

```text
Use case: stylized-concept
Asset type: 2D game character base asset for Wordfront
Style/medium: minimal 2D game illustration, crisp dark navy outlines, flat color fills, extremely limited details, no painterly rendering, no pixel art
Composition/framing: exactly one character, centered on a square canvas, full body fully visible, generous even padding, feet aligned near a consistent bottom baseline
Lighting/mood: readable and suitable for an educational game, almost no shading
Constraints: one closed silhouette; no cast or contact shadow; no text; no letters; no readable writing; no UI; no border; no watermark; preserve the shared proportions, outline weight, viewing angle, and visual polish
```

### 4.2 單字魔法師

```text
Primary request: create one full-body young word mage character in a very simple clean line-art style
Subject: a friendly small cartoon mage with a short blue robe, simple pointed hood, small closed book held near the waist, compact rounded proportions, standing in a neutral idle pose, facing right
Color palette: blue, dark navy, and pale cream
Backdrop: perfectly flat solid #00ff00 chroma-key background; do not use #00ff00 in the character
```

### 4.3 普通墨水怪

```text
Input image: mage-base.png as style reference only
Primary request: create exactly one small friendly ink monster matching the mage's clean cartoon line style
Subject: a compact teal-green ink blob creature with two short feet, two tiny arms, one curled ink-drop crest, expressive mischievous eyes, neutral idle pose, facing left
Color palette: teal green, dark navy, and pale mint
Backdrop: perfectly flat solid #ff00ff chroma-key background; do not use #ff00ff in the monster
```

### 4.4 強力書頁怪

```text
Input images: mage-base.png and normal-base.png as style references only
Primary request: create exactly one strong book-page chaos monster, clearly stronger and larger than the normal monster
Subject: a purple creature built from a chunky closed enchanted book body, folded page-like shoulders, a short page crest, sturdy feet, compact arms, determined eyes, neutral idle pose, facing left
Color palette: violet, dark navy, and pale lavender
Backdrop: perfectly flat solid #00ff00 chroma-key background; do not use #00ff00 in the monster
```

### 4.5 Boss 混沌怪

```text
Input images: mage-base.png, normal-base.png, and strong-base.png as style references only
Primary request: create exactly one large chaos-book boss, visually the strongest enemy while matching the shared clean cartoon line style
Subject: a deep crimson magical tome-and-ink boss with a broad heavy book torso, two curved ink horns, layered torn page shoulders, thick arms, sturdy feet, stern eyes, and a small central gem without symbols, neutral idle pose, facing left
Color palette: deep red, burgundy, dark navy, and pale coral
Backdrop: perfectly flat solid #00ff00 chroma-key background; do not use #00ff00 in the boss
```

## 5. 品質檢查

- 四張素材都具有 RGBA alpha channel。
- 四角 alpha 均為 0，沒有殘留實色背景。
- 角色輪廓完整，沒有碰到畫布邊界。
- 玩家與怪物朝向符合橫向戰鬥需求。
- 四張素材使用一致的線條、眼睛、比例語言與平面色彩風格。
- 角色腳底基準線已統一，可直接由 CSS 使用相同 bottom anchor。
- 普通、強力與 Boss 的輪廓及主色能在縮小後明確區分。

## 6. 後續姿勢順序

每個姿勢都必須使用對應的 base 圖作為 identity／style reference，保留角色臉部、比例、服裝或書本結構、主色與描邊。

1. 玩家：`mage-idle.png`、`mage-cast.png`、`mage-hurt.png`、`mage-defeated.png`。
2. 普通怪：`normal-idle.png`、`normal-attack.png`、`normal-hurt.png`、`normal-defeated.png`。
3. 強力怪：`strong-idle.png`、`strong-attack.png`、`strong-hurt.png`、`strong-defeated.png`。
4. Boss：`boss-idle.png`、`boss-attack.png`、`boss-hurt.png`、`boss-defeated.png`。

姿勢圖仍使用 1024 × 1024 透明 PNG 與 y = 922 腳底基準線。每次只改變姿勢和表情，不改角色設計。
