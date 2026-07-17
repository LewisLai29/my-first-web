# Wordfront Battle Game 架構入門

這份文件是給第一次接觸 Wordfront Battle Game 的使用者與工程師閱讀的。

內容會先說明遊戲怎麼運作，再介紹程式放在哪裡，以及修改功能時應該從哪個檔案開始。

如果需要更完整的型別、狀態與設計決策，可以再閱讀 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 1. 這是什麼遊戲？

Wordfront 是一個單字戰鬥遊戲。

玩家會看到一個中文意思，以及四個英文單字選項：

1. 在 10 秒內選出正確的英文單字。
2. 答對時，玩家會攻擊怪物並造成 1 點傷害。
3. 答錯時，錯誤選項會被排除，並暫時鎖定作答 3 秒。
4. 超過 10 秒沒有答對，怪物就會攻擊玩家。
5. 清除三個波次的怪物後獲勝。
6. 玩家 HP 降到 0 時失敗。

目前一局共有 10 隻怪物，怪物總 HP 是 29，所以每局會準備 29 道題目。

## 2. 先用一張圖看懂整體流程

```text
使用者點擊首頁的 Wordfront
              │
              ▼
        plugin.ts
  建立遊戲視窗、進入全螢幕
              │
              ▼
       controller.ts
  載入單字並組裝一局遊戲
              │
              ▼
         engine.ts
  接收操作、管理時間、播放效果
              │
              ▼
        reducer.ts
  根據規則算出新的遊戲狀態
              │
              ▼
          view.ts
      把最新狀態顯示到畫面
```

最重要的概念是：

> 畫面不直接決定遊戲結果。畫面只回報玩家做了什麼，真正的傷害、勝負與波次推進都由 Reducer 計算。

## 3. 專案目錄

```text
battle-game/
├─ assets/                 # 玩家與怪物圖片
├─ src/                    # TypeScript 原始碼
│  ├─ data/                # 單字資料載入與整理
│  ├─ entities/            # 玩家、怪物及其基本數值
│  ├─ features/            # 戰鬥、題目與波次邏輯
│  ├─ game/                # 設定、狀態、Reducer 與 Engine
│  ├─ platform/            # 遊戲時鐘與瀏覽器生命週期
│  ├─ ui/                  # 畫面、輸入與動畫
│  ├─ controller.ts        # 組裝和銷毀每局遊戲
│  └─ plugin.ts            # 首頁外掛入口
├─ dist/                   # TypeScript 編譯後的瀏覽器程式
├─ test/                   # 自動化測試
├─ plugin.json             # 外掛入口與 CSS 設定
├─ wordfront.css           # 遊戲樣式
└─ package.json            # build 與 test 指令
```

平常應該修改 `src/` 裡的 TypeScript，再執行 build 產生 `dist/`。不要直接把 `dist/` 當成原始碼維護。

## 4. 各層負責什麼？

### 4.1 Plugin：把遊戲接到首頁

檔案：[src/plugin.ts](./src/plugin.ts)

Plugin 是 Wordfront 和主網站之間的入口，負責：

- 在首頁加入 Wordfront 功能圖塊。
- 建立遊戲 Overlay。
- 使用者點擊時開啟遊戲。
- 進入遊戲時請求瀏覽器全螢幕。
- 關閉遊戲時退出全螢幕。
- 外掛卸載時移除 DOM 和事件監聽器。
- 需要遊戲時才動態載入 Controller，減少首頁初始載入量。

這一層只處理「網站如何開啟遊戲」，不處理怪物傷害或答題規則。

### 4.2 Controller：建立一局可以玩的遊戲

檔案：[src/controller.ts](./src/controller.ts)

Controller 可以想成組裝中心。每次開啟或重新開始遊戲時，它會建立：

- 整理過的單字資料。
- 29 道題目。
- 三個怪物波次。
- 可暫停的遊戲時鐘。
- DOM View。
- Game Engine。
- 瀏覽器失焦、分頁隱藏與螢幕方向監聽。

Controller 也負責收尾。關閉遊戲時，它會停止 Engine、動畫與事件監聽器，並中止尚未完成的資料載入。

單字載入成功後會保留在記憶體中，不必每次重開都重新下載；但是題目、敵人和玩家狀態每局都會重新建立。

### 4.3 Engine：讓遊戲持續運轉

檔案：[src/game/engine.ts](./src/game/engine.ts)

Engine 是執行中的遊戲協調者，負責：

- 保存目前的 `GameState`。
- 接收開始、作答、暫停與恢復操作。
- 把操作轉成 `GameAction` 交給 Reducer。
- 把 Reducer 回傳的新狀態交給 View。
- 執行攻擊動畫、提示訊息與焦點移動。
- 使用 `requestAnimationFrame` 更新倒數。
- 題目超時或波次倒數結束時，自動送出對應 Action。
- 等待攻擊動畫完成後，再讓遊戲進到下一步。

Engine 負責「什麼時候執行」，但不負責「遊戲規則應該算出什麼結果」。

### 4.4 Reducer：所有戰鬥規則的核心

檔案：[src/game/reducer.ts](./src/game/reducer.ts)

Reducer 會接收三樣東西：

```text
目前狀態 + 發生的事件 + 遊戲設定
```

然後回傳：

```text
新的狀態 + 需要執行的畫面效果
```

例如玩家答對時：

1. Engine 送出 `SUBMIT_ANSWER`。
2. Reducer 檢查答案。
3. Reducer 扣除怪物 HP。
4. Reducer 把 phase 改成 `resolving-player-attack`。
5. Reducer 要求播放玩家攻擊動畫。
6. 動畫完成後，Engine 送出 `PLAYER_ATTACK_FINISHED`。
7. Reducer 再決定要顯示下一題、換怪物、換波次或結束遊戲。

Reducer 不會直接操作 DOM、播放動畫、呼叫 `fetch` 或讀取真實時間，因此戰鬥規則比較容易測試。

### 4.5 View、Input 與 Animations：顯示與互動

主要檔案：

- [src/ui/view.ts](./src/ui/view.ts)
- [src/ui/input.ts](./src/ui/input.ts)
- [src/ui/animations.ts](./src/ui/animations.ts)

`view.ts` 根據 `GameState` 顯示：

- 玩家與怪物 HP。
- 目前波次。
- 題目與答案。
- 倒數進度。
- 開始、暫停、過關、勝利與失敗畫面。
- 錯題回顧與本局統計。

`input.ts` 處理按鈕點擊，以及鍵盤數字 `1` 到 `4` 作答。

`animations.ts` 處理玩家施法、文字投射物、命中、怪物攻擊與死亡動畫。

View 不會自行扣血或判斷勝負。它只顯示 Engine 提供的狀態，並把使用者操作交回 Controller 和 Engine。

## 5. GameState、Action 與 Effect

檔案：[src/game/types.ts](./src/game/types.ts)

### GameState

`GameState` 是目前整局遊戲的快照，包含：

- 現在處於哪個 phase。
- 玩家 HP。
- 所有波次與怪物狀態。
- 目前題目與作答選項。
- 題目、答錯懲罰及波次轉場的 deadline。
- 暫停原因。
- 正確、錯誤、錯題與遊戲時間統計。

畫面需要知道的資訊，原則上都應該來自 `GameState`。

### GameAction

`GameAction` 表示「剛剛發生了什麼事」，例如：

- `START`：開始遊戲。
- `SUBMIT_ANSWER`：玩家選了一個答案。
- `QUESTION_TIMEOUT`：題目時間到。
- `PLAYER_ATTACK_FINISHED`：玩家攻擊動畫完成。
- `ENEMY_ATTACK_FINISHED`：怪物攻擊動畫完成。
- `PAUSE` / `RESUME`：暫停或恢復。
- `DESTROY`：銷毀這局遊戲。

### GameEffect

`GameEffect` 表示需要交給畫面執行的工作，例如：

- 玩家或怪物攻擊動畫。
- 怪物死亡動畫。
- 螢幕閱讀器提示。
- 把鍵盤焦點移到答案或重新開始按鈕。

## 6. 遊戲狀態怎麼前進？

主要狀態流程如下：

```text
intro
  │ 按下 Start Battle
  ▼
playing
  ├─ 答對 ──► resolving-player-attack
  │              ├─ 怪物還活著：下一題
  │              ├─ 怪物死亡：下一隻怪物
  │              ├─ 本波清除：wave-transition
  │              └─ Boss 死亡：victory
  │
  └─ 超時 ──► resolving-enemy-attack
                 ├─ 玩家還活著：回到同一題並重設倒數
                 └─ 玩家 HP 為 0：defeat
```

遊戲進行中也可能進入 `paused`。恢復時會回到暫停前的 phase，而不是一律回到 `playing`。

關閉遊戲後會進入 `destroyed`，這個 session 不再接受其他操作。

## 7. 題目與單字資料

主要檔案：

- [src/data/vocabulary.ts](./src/data/vocabulary.ts)
- [src/features/questions/questions.ts](./src/features/questions/questions.ts)

單字資料會先經過整理：

- 移除缺少英文單字或中文意思的資料。
- 忽略重複英文單字。
- 統一用於比較的大小寫與文字格式。
- 整理詞性，供干擾選項使用。

每局會隨機選出 29 個不重複的目標單字。每題有一個正確答案和三個干擾選項。

干擾選項會優先選擇相同詞性的單字；不足三個時，才從其他合適的單字補足。題庫至少需要 29 筆有效單字，而且必須能為每題找到三個不重複、沒有歧義的選項。

## 8. 玩家、怪物與波次設定

主要檔案：

- [src/entities/player/player-config.ts](./src/entities/player/player-config.ts)
- [src/entities/enemy/enemy-catalog.ts](./src/entities/enemy/enemy-catalog.ts)
- [src/game/config.ts](./src/game/config.ts)

目前數值如下：

| 角色 | HP | 每次攻擊傷害 |
|---|---:|---:|
| 玩家 | 100 | 1 |
| Normal | 2 | 10 |
| Strong | 3 | 15 |
| Boss | 5 | 20 |

目前波次如下：

| 波次 | 怪物 | 總 HP |
|---|---|---:|
| Wave 1 | 3 隻 Normal | 6 |
| Wave 2 | 3 隻 Strong | 9 |
| Wave 3 | 3 隻 Strong、1 隻 Boss | 14 |
| 合計 | 10 隻怪物 | 29 |

其他設定：

- 每題時間：10 秒。
- 答錯鎖定：3 秒。
- 波次轉場：3 秒。

## 9. 為什麼需要自己的遊戲時鐘？

檔案：[src/platform/clock.ts](./src/platform/clock.ts)

遊戲沒有直接用一般時鐘判斷倒數，而是使用 `PausableGameClock`。

它會記住暫停了多久，並從遊戲時間中扣除暫停期間。這樣玩家暫停 30 秒後回來，題目不會直接超時，也不需要逐一修改所有 deadline。

## 10. 自動暫停機制

檔案：[src/platform/lifecycle.ts](./src/platform/lifecycle.ts)

目前有四種暫停原因：

| 原因 | 觸發時機 |
|---|---|
| `manual` | 玩家按下 Pause |
| `hidden` | 分頁被切到背景 |
| `blur` | 瀏覽器視窗失去焦點 |
| `portrait` | 小螢幕處於直向模式 |

遊戲會記錄所有暫停原因。只有全部原因都清除後，玩家才可以真正恢復遊戲。

例如分頁在背景，同時畫面又是直向時，即使回到分頁，也要先轉回橫向才能繼續。

## 11. 關閉與重新開始時發生什麼事？

關閉遊戲代表放棄目前這局，不會保存戰鬥進度。

Controller 會：

1. 中止尚未完成的單字請求。
2. 停止 Engine 和 `requestAnimationFrame`。
3. 停止並清除動畫。
4. 移除瀏覽器生命週期監聽器。
5. 清空遊戲畫面。
6. 退出全螢幕。

下次開啟時會從 Wave 1、玩家 100 HP 開始。

按下 `Play Again` 也會建立全新的 session，但可以使用已經載入的單字資料。

## 12. 常見修改應該去哪裡？

| 想修改的內容 | 建議從這裡開始 |
|---|---|
| 題目時間、答錯鎖定、波次內容 | `src/game/config.ts` |
| 玩家 HP 或攻擊力 | `src/entities/player/player-config.ts` |
| 怪物 HP、傷害或種類 | `src/entities/enemy/enemy-catalog.ts` |
| 答對、答錯、死亡與勝負規則 | `src/game/reducer.ts` |
| 題目抽取與干擾選項 | `src/features/questions/questions.ts` |
| 單字 JSON 格式與清理規則 | `src/data/vocabulary.ts` |
| HUD、按鈕或結果畫面 | `src/ui/view.ts` |
| 按鍵與點擊操作 | `src/ui/input.ts` |
| 攻擊與死亡動畫 | `src/ui/animations.ts` |
| 全螢幕、Overlay、首頁入口 | `src/plugin.ts` |
| 載入、重開與清理流程 | `src/controller.ts` |
| 顏色、排版與響應式畫面 | `wordfront.css` |

修改戰鬥規則時，優先把規則放進 Reducer 或對應的純函式，不要直接寫在 View 或動畫裡。

## 13. 開發與測試

在 `battle-game` 目錄執行：

```powershell
npm install
npm run build
npm test
```

指令用途：

- `npm run build`：把 `src/` TypeScript 編譯到 `dist/`。
- `npm test`：先 build，再執行所有 Node 測試。

測試目前主要涵蓋：

- 單字資料整理。
- 29 道題目與四個選項的產生。
- 怪物波次和總 HP。
- 答對、答錯、超時、勝利與失敗。
- 暫停原因。
- DOM 畫面與答案按鈕。
- 外掛註冊與動畫順序。

修改 Reducer、題目、波次或 UI 後，應該同步補上對應測試。

## 14. 接手時最需要記住的原則

1. **戰鬥規則放在 Reducer 或純函式中。**
2. **View 只顯示狀態，不直接改變 HP、波次或勝負。**
3. **Engine 負責執行時機，不自行重複 Reducer 的規則。**
4. **所有戰鬥倒數使用 GameClock，不直接混用 `Date.now()`。**
5. **動畫結束後要透過 Action 推進狀態。**
6. **每次建立 session，也要確保關閉時能完整清理。**
7. **修改 `src/` 後重新 build，不直接維護 `dist/`。**
8. **提交前執行 `npm test`。**

只要維持這些分工，新增怪物、技能、關卡或其他玩法時，就比較不容易讓畫面、時間與戰鬥規則互相干擾。
