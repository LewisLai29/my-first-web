# Wordfront 實作說明

Wordfront 已依照 [GAME_DESIGN.md](./GAME_DESIGN.md) 與 [ARCHITECTURE.md](./ARCHITECTURE.md) 完成第一版可遊玩 MVP。它以獨立外掛方式加入首頁，並作為目前唯一啟用的遊戲外掛。

## 目前完成範圍

- 首頁獨立 `Wordfront` 入口與全螢幕遊戲層。
- TypeScript 遊戲核心、狀態 reducer、可暫停遊戲時鐘與 DOM 介面。
- 三波共 10 隻怪物、29 點總血量，玩家初始 100 HP 且整局不回血。
- 中文解釋搭配四個英文選項；每局從完整題庫建立 29 道不重複題目。
- 答對攻擊、答錯鎖定 3 秒、10 秒超時後前排怪物前進並攻擊。
- 波次轉場、勝利／失敗、錯題去重回顧與戰鬥統計。
- 手動暫停、分頁失焦／隱藏自動暫停，以及手機直向暫停提示。
- AI 產生的透明背景 8-bit 點陣玩家、普通怪、強怪與 Boss 圖像。
- 玩家六張施法攻擊影格，依 `01` 至 `06` 順序逐格播放並預先載入。
- CSS／Web Animations 蓄力施法、揮杖、單字魔法彈、命中、受傷、移動與死亡表現。

## 主要目錄分工

```text
battle-game/
├─ assets/                 # 實際遊戲圖片，依玩家與怪物種類分開
├─ src/entities/           # 玩家／怪物資料、設定與狀態操作
├─ src/features/combat/    # 玩家與怪物攻擊規則
├─ src/features/questions/ # 出題、選項與同詞性干擾答案
├─ src/features/waves/     # 三波怪物建立與統計
├─ src/game/               # 遊戲型別、設定、reducer 與 engine
├─ src/platform/           # 可暫停時鐘與瀏覽器生命週期
├─ src/ui/                 # 畫面、輸入、素材對照與動畫
├─ dist/                   # TypeScript 編譯結果，供網站載入
└─ test/                   # 規則與 DOM 整合測試
```

## 建置與測試

在 `battle-game` 目錄執行：

```powershell
npm install
npm run build
npm test
```

`npm test` 會先重新編譯，再驗證題庫、戰鬥規則、波次、暫停、勝利流程、DOM 畫面與首頁外掛入口。

## 在網站中啟用

根目錄的 `plugins.json` 已加入：

```json
"battle-game/plugin.json"
```

因此網站透過本機 HTTP server 開啟後，首頁只會顯示 Wordfront 遊戲入口。遊戲讀取既有的 `pte_vocab.json`，不另複製題庫。

## 美術替換方式

目前 8-bit 基礎圖與攻擊影格放在角色各自的資料夾：

- `assets/player/mage-base.png`
- `assets/player/mage-cast-01.png` 至 `mage-cast-06.png`
- `assets/enemies/normal/normal-base.png`
- `assets/enemies/strong/strong-base.png`
- `assets/enemies/boss/boss-base.png`

檔案命名與後續狀態圖規格記錄在 [ART_ASSETS.md](./ART_ASSETS.md)。未來可在相同角色資料夾加入怪物 `attack`、`hurt`、`defeated` 影格；戰鬥規則不需要跟著改寫。

## 首版刻意不包含

分數、星等、排行榜、永久升級、進度保存與單字發音仍維持企劃中的首版排除範圍。關閉遊戲即放棄當局，再次開啟會從第一波開始。
