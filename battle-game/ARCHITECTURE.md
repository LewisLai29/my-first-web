# Wordfront 程式架構設計

## 1. 文件目的

本文件將 [GAME_DESIGN.md](./GAME_DESIGN.md) 的玩法轉換為可實作的 TypeScript 程式架構，定義模組邊界、核心型別、狀態轉換、計時策略、資料流、網站整合方式與測試方向。

本文件只描述預定架構，不代表遊戲程式已經完成。若程式架構與遊戲企劃發生衝突，以 `GAME_DESIGN.md` 的玩家體驗與規則為準，再回頭更新本文件。

## 2. 架構目標

- 使用 TypeScript、原生 DOM 與 CSS 實作，不引入前端框架或執行期套件。
- Wordfront 作為可選外掛存在，並且不依賴已移除的 `game/` Memory Match。
- 將規則與 DOM 分離，讓答題、傷害、波次與計時能在沒有瀏覽器畫面的情況下測試。
- 所有時間規則共用一個可暫停的遊戲時鐘，避免多組 `setTimeout` 互相競爭。
- 核心狀態只能透過明確 action 改變，動畫與畫面不能直接修改遊戲數值。
- 隨機選題、時間來源與動畫完成事件皆可注入，確保測試結果可重現。
- 開啟、關閉、切換分頁、旋轉裝置與外掛卸載時，都能完整清理資源。

## 3. 技術基準

### 3.1 TypeScript 設定

Wordfront 使用自己的 `package.json` 與 `tsconfig.json`：

| 項目 | 設定 |
| --- | --- |
| TypeScript | `^5.9.3` |
| Target | `ES2022` |
| Module | `ES2022` |
| Module resolution | `Bundler` |
| Runtime libraries | `ES2022`, `DOM` |
| Strict mode | 開啟 |
| `noUncheckedIndexedAccess` | 開啟 |
| `noEmitOnError` | 開啟 |
| 原始碼 | `src/**/*.ts` |
| 輸出 | `dist/`，包含 JavaScript 與 declaration files |

所有 TypeScript 來源使用 ESM。原始碼內的相對 import 必須使用輸出後的 `.js` 副檔名，例如 `import { createEngine } from './game/engine.js'`。

### 3.2 執行與呈現方式

- 遊戲邏輯：TypeScript 編譯為原生瀏覽器 ESM。
- 畫面：語意化 HTML DOM，不使用 canvas 作為主要 UI。
- 動畫：CSS animation／transition，由 TypeScript 觸發 class 或 data attribute。
- 樣式：外掛自己的 `wordfront.css`，所有 selector 以 `.wordfront-` 或 `#wordfront-` 為前綴。
- 題庫：透過主程式提供的 `vocabularyUrl` 使用 `fetch` 載入。
- 測試：純邏輯採 Node test runner；DOM 與外掛整合測試使用既有測試方式或輕量 fake DOM。

## 4. 專案結構

```text
battle-game/
├─ GAME_DESIGN.md
├─ ARCHITECTURE.md
├─ ART_ASSETS.md
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ plugin.json
├─ wordfront.css
├─ assets/
│  ├─ player/
│  │  ├─ mage-base.png
│  │  ├─ mage-idle.png
│  │  ├─ mage-cast.png
│  │  ├─ mage-hurt.png
│  │  └─ mage-defeated.png
│  ├─ enemies/
│  │  ├─ normal/
│  │  │  ├─ normal-base.png
│  │  │  ├─ normal-idle.png
│  │  │  ├─ normal-attack.png
│  │  │  ├─ normal-hurt.png
│  │  │  └─ normal-defeated.png
│  │  ├─ strong/
│  │  │  ├─ strong-base.png
│  │  │  ├─ strong-idle.png
│  │  │  ├─ strong-attack.png
│  │  │  ├─ strong-hurt.png
│  │  │  └─ strong-defeated.png
│  │  └─ boss/
│  │     ├─ boss-base.png
│  │     ├─ boss-idle.png
│  │     ├─ boss-attack.png
│  │     ├─ boss-hurt.png
│  │     └─ boss-defeated.png
│  ├─ battlefield/
│  │  └─ (背景與地面素材)
│  └─ effects/
│     └─ (不屬於單一角色的共用特效素材)
├─ src/
│  ├─ plugin.ts
│  ├─ controller.ts
│  ├─ game/
│  │  ├─ types.ts
│  │  ├─ config.ts
│  │  ├─ engine.ts
│  │  └─ reducer.ts
│  ├─ entities/
│  │  ├─ player/
│  │  │  ├─ player-types.ts
│  │  │  ├─ player-config.ts
│  │  │  └─ player.ts
│  │  └─ enemy/
│  │     ├─ enemy-types.ts
│  │     ├─ enemy-catalog.ts
│  │     ├─ enemy-factory.ts
│  │     └─ enemy.ts
│  ├─ features/
│  │  ├─ combat/
│  │  │  ├─ player-attack.ts
│  │  │  ├─ enemy-attack.ts
│  │  │  └─ damage.ts
│  │  ├─ questions/
│  │  │  └─ questions.ts
│  │  └─ waves/
│  │     └─ waves.ts
│  ├─ data/
│  │  └─ vocabulary.ts
│  ├─ platform/
│  │  ├─ clock.ts
│  │  └─ lifecycle.ts
│  └─ ui/
│     ├─ asset-catalog.ts
│     ├─ input.ts
│     ├─ view.ts
│     └─ animations.ts
├─ dist/
│  └─ (TypeScript 編譯產物)
└─ test/
   ├─ reducer.test.js
   ├─ questions.test.js
   ├─ engine.test.js
   ├─ controller.test.js
   └─ plugin.test.js
```

`dist/` 是 build 產物，不作為人工修改的來源。首版不建立共用 package，也不從已移除的 `game/` 匯入任何程式。

## 5. 分層與模組職責

### 5.1 分工原則

角色會有自己的程式與素材資料夾，但資料夾只擁有「角色本身」的狀態、設定與單體規則。只要一個動作同時影響兩個領域，就放到 feature 層，不由其中一個角色獨占。

以玩家攻擊為例：

- 玩家最大 HP、基礎攻擊力與玩家 state 建立方式屬於 `entities/player/`。
- 玩家按下哪個答案屬於 `ui/input.ts`。
- 答案是否正確屬於 `features/questions/`。
- 正確後如何對怪物造成傷害屬於 `features/combat/player-attack.ts`。
- 魔法彈怎麼飛、角色怎麼播放攻擊姿勢屬於 `ui/animations.ts`。
- 何時換題、換怪物或結束一波由 `game/reducer.ts` 協調。

這個分法避免 `player/` 同時依賴題庫、怪物、DOM 和計時器，也讓未來新增技能、怪物或攻擊類型時能單獨測試與替換。

### 5.2 角色資料夾

`entities/player/` 的分工：

| 檔案 | 內容 |
| --- | --- |
| `player-types.ts` | `PlayerState`、玩家相關型別 |
| `player-config.ts` | 最大 HP、基礎傷害等玩家固定設定 |
| `player.ts` | 建立玩家、限制 HP 範圍等只影響玩家本身的純函式 |

`entities/enemy/` 的分工：

| 檔案 | 內容 |
| --- | --- |
| `enemy-types.ts` | `EnemyKind`、`EnemyState` 等怪物型別 |
| `enemy-catalog.ts` | 普通怪、強怪與 Boss 的 HP、傷害、移動上限設定 |
| `enemy-factory.ts` | 依 catalog 建立每局唯一的怪物 instance |
| `enemy.ts` | 怪物扣血、前進與存活判定等只影響單一怪物的純函式 |

角色美術素材和程式分開保存。`assets/player/` 只放玩家圖像，`assets/enemies/<kind>/` 只放對應怪物素材；TypeScript 不應把圖像內容編碼進角色 state，只保存穩定的角色種類、pose 或 asset key。

素材歸屬規則：

- 所有玩家本體圖像，不論是 base、idle、cast、hurt 或 defeated，一律放在 `assets/player/`。
- 普通怪、強怪與 Boss 的本體圖像，分別放在 `assets/enemies/normal/`、`assets/enemies/strong/` 與 `assets/enemies/boss/`。
- 只有不屬於單一角色、可被多個角色共用的視覺效果才放在 `assets/effects/`。
- 背景及地面只放在 `assets/battlefield/`。
- 圖片不可放進 `src/entities/player/` 或 `src/entities/enemy/`；`src/` 只保存 TypeScript 程式，避免程式編譯與靜態素材混在一起。
- 玩家程式與玩家圖像雖位於不同根目錄，但使用相同的 `player` 分類；怪物亦使用相同原則。

正式美術完成前，先使用 AI 產生透明 PNG 原型素材，不沿用網站現有的 `pig.png`，也不使用 emoji 或幾何 placeholder。第一批只建立 `mage-base.png`、`normal-base.png`、`strong-base.png` 與 `boss-base.png` 四張角色基準圖。

原型圖必須遵守同一份素材契約：

- 透明背景 PNG，統一使用方形畫布。
- 建議原始畫布為 1024 × 1024，角色保留安全邊距。
- 玩家面向右方，所有怪物面向左方。
- 腳底中心對齊共同 anchor，放在畫布固定的基準線上。
- 使用一致的視角、描邊粗細、光源與卡通渲染方式。
- Boss 仍使用相同畫布，由 CSS 角色容器放大顯示。
- 圖像不得包含文字、血條、對話框、地面陰影或背景場景。

`ui/asset-catalog.ts` 將穩定的 entity／pose key 對應到實際 URL。初期所有 pose 可以 fallback 到各角色的 base 圖，再用 CSS 完成漂浮、前進、受擊震動和死亡淡出；風格確認後，依基準圖衍生 `idle`、`cast`／`attack`、`hurt` 與 `defeated` 圖檔。正式美術只需保留相同 key、畫布與 anchor，即可替換 URL，不修改 GameState、combat API 或 reducer。

### 5.3 跨角色功能

`features/combat/` 負責玩家與怪物之間的交互：

| 檔案 | 內容 |
| --- | --- |
| `player-attack.ts` | 將一次正確作答轉成玩家攻擊結果與動畫 effect |
| `enemy-attack.ts` | 將一次超時轉成怪物前進、玩家受傷與動畫 effect |
| `damage.ts` | 共用傷害計算、最低 HP 0 與不可重複結算保護 |

首版不建立 `player/attack.ts`，因為攻擊同時讀取玩家設定並修改怪物結果，屬於 combat feature。未來若新增純粹屬於角色本身的技能冷卻或魔力值，才放入 `entities/player/`。

### 5.4 完整模組職責

| 模組 | 職責 | 不應負責 |
| --- | --- | --- |
| `plugin.ts` | 建立首頁 tile 與全螢幕 overlay、註冊 `wordfront` mode、延遲載入 controller、外掛 dispose | 戰鬥規則、選題與計時 |
| `controller.ts` | 組裝 repository、clock、engine、view；載入題庫；處理開始、關閉與重試 | 直接計算傷害或波次 |
| `game/types.ts` | 整局狀態、action、effect 與跨層介面契約 | 執行流程 |
| `game/config.ts` | 組合玩家、怪物、倒數與波次的第一版設定 | 保存可變遊戲狀態 |
| `game/reducer.ts` | 協調角色與 feature 純函式，完成整局狀態轉換 | DOM、fetch、真實時間與動畫 |
| `game/engine.ts` | 接收輸入、同步時間、dispatch action、執行 effect、發佈新狀態 | 產生 HTML 或直接查詢 DOM |
| `entities/player/` | 玩家 state、設定與只影響玩家的純函式 | 題目、怪物、DOM 與計時器 |
| `entities/enemy/` | 怪物 catalog、instance 與只影響怪物的純函式 | 玩家輸入、題庫與動畫 |
| `features/combat/` | 玩家攻擊、怪物攻擊與跨角色傷害解析 | DOM 動畫與全局時間排程 |
| `features/questions/questions.ts` | 建立牌組、選擇同詞性干擾項、洗牌、避免重複與歧義 | fetch 題庫或更新戰鬥狀態 |
| `features/waves/waves.ts` | 由固定設定和 enemy factory 產生每波敵人 | 顯示怪物或播放動畫 |
| `data/vocabulary.ts` | fetch、解析、正規化與驗證 `pte_vocab.json` | 隨機出題與 UI |
| `platform/clock.ts` | 提供排除暫停時間的單調遊戲時間 | 決定何時攻擊或換波 |
| `platform/lifecycle.ts` | visibility、blur、orientation 與 abort/listener 清理 | 修改核心狀態細節 |
| `ui/asset-catalog.ts` | 將角色種類與姿勢 key 對應到 AI 原型或正式素材 URL，處理 base fallback | 戰鬥判定與角色數值 |
| `ui/input.ts` | 將 click、touch、鍵盤 1–4 與 Pause 操作轉成 handler 呼叫 | 自行判斷答案或修改 HP |
| `ui/view.ts` | 建立 DOM、事件委派、依 state 更新畫面、focus 與 aria-live | 成為遊戲規則的資料來源 |
| `ui/animations.ts` | 播放魔法彈、受擊、死亡、前進與 wave transition 效果 | 扣血、計分或判定勝負 |

## 6. 網站與外掛整合

### 6.1 Manifest

`battle-game/plugin.json` 使用獨立名稱與入口：

```json
{
  "name": "wordfront",
  "entry": "dist/plugin.js",
  "styles": ["wordfront.css"]
}
```

根目錄 `plugins.json` 只註冊 `battle-game/plugin.json`，由現有 optional plugin loader 載入。

### 6.2 Plugin context

Wordfront 沿用主程式目前傳入的 context，不要求第一版修改 loader 契約：

```ts
export type WordfrontPluginContext = {
    document: Document;
    getElement: (id: string) => HTMLElement | null;
    vocabularyUrl: string | URL;
    home: {
        root: HTMLElement;
        features: HTMLElement;
        popupController: HomePopupController;
        registerPopupMode: (
            mode: string,
            popupId: string,
            lifecycle: PluginLifecycle,
        ) => () => void;
    };
};
```

`plugin.ts` 的唯一公開入口為：

```ts
export function activate(context: WordfrontPluginContext): WordfrontPluginActivation;

export type WordfrontPluginActivation = {
    dispose: () => void;
};
```

### 6.3 DOM 與 mode 名稱

- 首頁入口 ID：`start-wordfront`。
- 全螢幕容器 ID：`wordfront-overlay`。
- 遊戲 mount root ID：`wordfront-root`。
- popup mode：`wordfront`。
- overlay 使用 `role="dialog"`、`aria-modal="true"` 與可辨識的 label。
- overlay 仍交由既有 `home.popupController` 控制 open、exclusive 與 close，樣式則覆蓋為全螢幕。

### 6.4 載入與卸載流程

1. `activate()` 建立 Wordfront tile 與隱藏的 overlay。
2. 向首頁註冊 `wordfront` mode，lifecycle 的 `cancel` 和 `unload` 都呼叫 `destroySession()`。
3. 玩家第一次點擊 tile 時才動態 import `controller.js`。
4. controller 顯示 loading、以 `AbortController` 載入題庫，成功後 mount view 與 engine。
5. 載入失敗顯示英文錯誤訊息及 `Try Again`，retry 必須建立新的 abort controller。
6. 玩家關閉 overlay 時視為放棄本局：停止 engine、取消 fetch、移除全域 listener、清空 mount root。
7. 外掛 `dispose()` 額外移除 tile、overlay、style 生命週期與註冊的 mode，並還原首頁 quick tools 數量。

## 7. 核心型別

以下型別是實作時的契約方向；欄位命名可因編譯問題微調，但資料責任不可跨層混用。

### 7.1 題庫

```ts
export type VocabularyInput = {
    id?: string | number;
    word?: unknown;
    definition?: unknown;
    partOfSpeech?: unknown;
    w?: unknown;
    m?: unknown;
};

export type VocabularyEntry = {
    id: string;
    word: string;
    normalizedWord: string;
    definition: string;
    normalizedDefinition: string;
    partOfSpeech: string;
    partOfSpeechKey: string;
};

export type QuestionOption = {
    entryId: string;
    label: string;
};

export type QuestionState = {
    id: string;
    targetEntryId: string;
    definition: string;
    options: readonly QuestionOption[];
    eliminatedEntryIds: readonly string[];
};
```

`partOfSpeechKey` 將 `n./v.` 與 `v./n.` 等順序不同但詞性集合相同的資料正規化為同一個 key，供干擾選項優先級使用。

### 7.2 敵人與波次

```ts
export type EnemyKind = 'normal' | 'strong' | 'boss';

export type EnemyState = {
    id: string;
    kind: EnemyKind;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    advanceStep: number;
    maxAdvanceStep: number;
};

export type PlayerState = {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    correctStreak: number;
};

export type WaveState = {
    index: number;
    enemies: readonly EnemyState[];
    activeEnemyIndex: number;
};
```

敵人 instance ID 每局唯一。後方敵人保留在 `enemies` 中，但 reducer 只允許 `activeEnemyIndex` 指向的敵人出題與行動。

### 7.3 遊戲狀態

```ts
export type GamePhase =
    | 'intro'
    | 'playing'
    | 'resolving-player-attack'
    | 'resolving-enemy-attack'
    | 'wave-transition'
    | 'paused'
    | 'victory'
    | 'defeat'
    | 'destroyed';

export type PauseReason = 'manual' | 'hidden' | 'blur' | 'portrait';

export type GameStats = {
    correctSelections: number;
    wrongSelections: number;
    wrongEntryIds: readonly string[];
    startedAtGameMs: number | null;
    finishedAtGameMs: number | null;
};

export type GameState = {
    phase: GamePhase;
    resumePhase: Exclude<GamePhase, 'paused' | 'destroyed'> | null;
    pauseReasons: readonly PauseReason[];
    player: PlayerState;
    wave: WaveState;
    question: QuestionState | null;
    usedTargetEntryIds: readonly string[];
    questionDeadlineGameMs: number | null;
    penaltyDeadlineGameMs: number | null;
    waveDeadlineGameMs: number | null;
    stats: GameStats;
    revision: number;
};
```

重要不變條件：

- `player.hp` 必須介於 0 和 100；`player.attack` 必須介於 5 和 10。
- `playing` 時必須同時存在 active enemy、question 與 question deadline。
- `wave-transition` 時不可接受作答。
- `victory`、`defeat` 與 `destroyed` 不再接受戰鬥 action。
- `usedTargetEntryIds` 不可重複。
- `wrongEntryIds` 只保存唯一 entry ID。
- deadline 一律使用可暫停的 game time，不可混用 `Date.now()`。

### 7.4 Action 與 Effect

```ts
export type GameAction =
    | { type: 'START'; now: number }
    | { type: 'SUBMIT_ANSWER'; entryId: string; now: number }
    | { type: 'QUESTION_TIMEOUT'; now: number }
    | { type: 'PLAYER_ATTACK_FINISHED'; now: number }
    | { type: 'ENEMY_ATTACK_FINISHED'; now: number }
    | { type: 'WAVE_TRANSITION_FINISHED'; now: number }
    | { type: 'PAUSE'; reason: PauseReason }
    | { type: 'CLEAR_PAUSE_REASON'; reason: PauseReason }
    | { type: 'RESUME'; now: number }
    | { type: 'RESTART'; now: number }
    | { type: 'DESTROY' };

export type GameEffect =
    | { type: 'ANIMATE_PLAYER_ATTACK'; word: string; enemyId: string }
    | { type: 'ANIMATE_ENEMY_ATTACK'; enemyId: string; advance: boolean }
    | { type: 'ANIMATE_ENEMY_DEATH'; enemyId: string }
    | { type: 'ANNOUNCE'; message: string }
    | { type: 'FOCUS'; target: 'first-answer' | 'resume' | 'play-again' };
```

Reducer 回傳 `{ state, effects }`。Effect runner 可以操作 DOM 或等待動畫，但不可自行扣血、選題或改變 wave。

## 8. 固定設定

`config.ts`、玩家設定與敵人 catalog 匯出唯讀設定，避免在 reducer 內散落 magic numbers。玩家基礎 ATK／DEF 為 5／5；連續答對第 3 題起每題增加 1 ATK，最高增加 5。敵人設定如下：

| 種類 | HP | ATK | DEF |
|---|---:|---:|---:|
| Normal | 8 | 15 | 1 |
| Strong | 12 | 22 | 2 |
| Boss | 15 | 30 | 3 |

所有攻擊共用 `max(1, attack - defense)`。題目數以玩家基礎攻擊計算最壞情況，因此每局預備 38 題；連擊不中斷時約 21 題通關。

設定在建立 session 時注入 engine。測試可以使用較短時間與較少敵人的 config，但正式 runtime 只使用 `DEFAULT_CONFIG`。

## 9. 狀態機與戰鬥解析

### 9.1 主要狀態流

```text
intro
  └─ START → playing

playing
  ├─ correct → resolving-player-attack
  ├─ timeout → resolving-enemy-attack
  ├─ PAUSE → paused
  └─ DESTROY → destroyed

resolving-player-attack
  ├─ enemy survives → playing + new question
  ├─ next enemy exists → playing + next enemy question
  ├─ wave cleared → wave-transition
  └─ boss defeated → victory

resolving-enemy-attack
  ├─ player survives → playing + same question
  └─ HP reaches 0 → defeat

wave-transition
  └─ after 3 seconds → playing + next wave

paused
  └─ all pause reasons cleared + RESUME → previous phase

victory / defeat
  ├─ RESTART → intro
  └─ DESTROY → destroyed
```

### 9.2 作答解析順序

`engine.submitAnswer(entryId)` 必須先以同一個 clock timestamp 同步到最新時間，再判斷輸入：

1. 若 question deadline 已到，先 dispatch `QUESTION_TIMEOUT`，本次 answer 不再生效。
2. 若仍在 3 秒 penalty，忽略輸入。
3. 若 entry 已在 eliminated list，忽略輸入。
4. 若 entry 是正解，更新統計、進入 player attack resolution 並鎖定其他輸入。
5. 若 entry 是錯誤答案，加入 eliminated list、記錄錯題並設定 penalty deadline。

這個順序讓 deadline 成為明確邊界，避免瀏覽器 event queue 在同一幀同時結算玩家攻擊與怪物攻擊。

### 9.3 答對

- reducer 先增加連擊、更新 ATK，再依攻防公式套用傷害並進入 `resolving-player-attack`。
- effect runner 播放單字魔法彈及受擊動畫，完成後 dispatch `PLAYER_ATTACK_FINISHED`。
- 怪物存活時產生新題；怪物死亡時推進 active enemy；全波清除時進入 wave transition。
- 新題可操作時才設定新的 10 秒 deadline，動畫時間不占用下一題作答時間。

### 9.4 答錯與 penalty

- 答錯不離開 `playing`，只新增 eliminated option 與 `penaltyDeadlineGameMs`。
- 答錯會立即清除連擊並將玩家 ATK 重設為 5。
- question deadline 不變，因此 penalty 和題目倒數可以同時推進。
- UI 依 `now < penaltyDeadlineGameMs` 決定所有答案是否鎖定。
- penalty 到期不需要另建 browser timeout；下一次 frame 或輸入同步時清除 deadline。

### 9.5 超時

- reducer 對 active enemy 的 `advanceStep` 加一，但不超過 `maxAdvanceStep`。
- 超時會清除連擊並將玩家 ATK 重設為 5。
- 同時扣除對應玩家 HP，並進入 `resolving-enemy-attack`。
- 保留 question 與 eliminated options。
- penalty deadline 不清除；若動畫期間已到期，回到 playing 時自然解除。
- 玩家存活時，在 enemy attack 動畫完成後才建立新的 10 秒 question deadline。

## 10. 時間與暫停架構

### 10.1 單一 game clock

```ts
export interface GameClock {
    now(): number;
    pause(): void;
    resume(): void;
    reset(): void;
}
```

正式 clock 以 `performance.now()` 為基礎並扣除累計暫停時間，保證 game time 單調遞增。測試使用可手動前進的 fake clock。

Engine 只建立一個 `requestAnimationFrame` loop：

- 更新倒數顯示。
- 檢查 question deadline。
- 檢查 penalty deadline。
- 檢查 wave transition deadline。
- 將當前 state 與 game time 傳給 view render。

不得為題目、penalty、wave 各自建立互不相干的 `setInterval`。CSS 動畫可使用 `animationend`，但必須提供短暫 fallback timeout，且所有 fallback 都由 session cleanup 集中取消。

### 10.2 Pause reasons

暫停原因採集合語意，避免裝置仍是直向時因視窗重新取得 focus 而錯誤恢復：

- `manual`：玩家按下 Pause。
- `hidden`：`document.visibilityState !== 'visible'`。
- `blur`：window 失焦。
- `portrait`：窄螢幕裝置處於直向。

首次加入 pause reason 時暫停 clock 與 CSS animation。環境恢復只移除對應原因；所有自動原因都消失後仍顯示 Resume，由玩家確認才真正恢復。Resume 後既有 deadline 不需平移，因為 game clock 在暫停期間沒有前進。

## 11. 題庫與問題產生

### 11.1 Repository 契約

```ts
export interface VocabularyRepository {
    load(signal?: AbortSignal): Promise<readonly VocabularyEntry[]>;
}
```

Browser repository 接受主程式提供的 URL，檢查 HTTP status，支援 AbortSignal，並將 current 欄位 `word`／`definition` 與 legacy 欄位 `w`／`m` 正規化為同一型別。

載入時必須：

- trim 顯示文字。
- 移除缺少英文或中文解釋的資料。
- 以不分大小寫的英文單字去重。
- 建立 normalized definition，供歧義檢查。
- 正規化詞性集合。
- 確認至少有本局最大需求的 38 個唯一單字；不足時顯示 load error，不啟動遊戲。

### 11.2 Question factory

```ts
export interface RandomSource {
    next(): number;
}

export interface QuestionFactory {
    createSessionDeck(count: number): readonly VocabularyEntry[];
    createQuestion(
        target: VocabularyEntry,
        questionId: string,
    ): QuestionState;
}
```

每局開始時先抽出最多 38 個不重複 target，順序固定於該局，避免重新 render 或 pause 改變後續題目。每題建立選項的順序為：

1. 加入 target。
2. 從相同 `partOfSpeechKey` 且 definition 不等同 target 的候選中抽取。
3. 不足三個時由全題庫其他不歧義候選補足。
4. 確認四個 entry ID 與英文 label 均唯一。
5. 使用 Fisher–Yates 與注入的 RandomSource 洗牌。

錯誤選項可以跨題重複，但 target 在同一局不可重複。

## 12. UI、輸入與動畫

### 12.1 View 契約

```ts
export interface WordfrontView {
    mount(handlers: WordfrontViewHandlers): void;
    render(state: Readonly<GameState>, now: number): void;
    play(effect: GameEffect): Promise<void>;
    setAnimationsPaused(paused: boolean): void;
    destroy(): void;
}
```

View 使用事件委派，只註冊一組穩定的 click／keyboard handlers。答案 button 以 entry ID 作為 data attribute，不將正解存在可見 label 以外的多餘 DOM metadata。

### 12.2 輸入

- 答案使用原生 `<button type="button">`。
- 支援滑鼠、觸控、Tab／Enter／Space。
- 可額外支援數字鍵 1–4，鍵盤事件仍必須經 engine 驗證 phase 與 penalty。
- Pause、Resume、Play Again 與 Close 都透過 controller／engine action，不直接改 DOM hidden state。
- phase 不是 `playing` 時，答案按鈕一律 disabled。

### 12.3 Render 原則

- State 是畫面的唯一資料來源。
- HP bar、wave、怪物位置、選項狀態與倒數皆由 state 派生。
- 倒數顯示可以每 frame 更新，但只在必要時修改 DOM text 或 style，避免重建整棵 DOM。
- aria-live 只播報重要事件，例如 correct、monster attack、wave clear、victory 與 defeat，避免每幀播報倒數。
- 開啟 overlay 時保存原本 focus；關閉後將 focus 還給 `start-wordfront`。

### 12.4 動畫

- 動畫只接收 effect 與元素 ID，不持有戰鬥數值。
- Player attack：依序播放玩家蓄力、後仰、向前揮杖、施法光環、正確英文單字魔法彈與命中特效；整段完成後才結束 attack resolution。
- Enemy attack：active enemy 向左更新一個視覺 step、播放攻擊與玩家受擊。
- Enemy death：播放消散後再通知 engine resolution 完成。
- Pause 時 overlay 加上 `.is-paused`，所有 CSS animation 使用 `animation-play-state: paused`。
- `prefers-reduced-motion: reduce` 時縮短或取消位移動畫，但 effect promise 仍要正常完成。

玩家攻擊使用 `mage-cast-01.png` 到 `mage-cast-06.png` 六張 8-bit 影格，每格顯示 115ms；影格在 intro 階段預載，攻擊時以可暫停的 Web Animations 時間軸直接切換原玩家 `<img>` 的 `src`。不得先隱藏待機圖再建立透明的重疊影格層，以免素材尚未顯示時角色消失。角色容器只保留輕微整體位移與發光，不再用單張圖模擬施法姿勢。替換影格不需修改 reducer 或傷害規則。

## 13. Controller 與資源清理

Controller 持有單一 session 的所有可變外部資源：

- `AbortController`。
- Engine instance。
- View instance。
- requestAnimationFrame ID。
- animation fallback timeout IDs。
- visibility、blur、focus、resize／orientation listener cleanup。
- overlay close 與 retry handlers。

```ts
export type WordfrontHandle = {
    pause: (reason?: PauseReason) => void;
    resume: () => void;
    restart: () => void;
    destroy: () => void;
};
```

`destroy()` 必須可重複呼叫而不拋錯，並依序停止輸入、停止 clock／frame、取消 fetch 與動畫、移除全域 listener、destroy view、清空 root。非目前 session 的過期 Promise 或 animation completion 必須藉由 session token 忽略。

## 14. 錯誤處理

| 情境 | 行為 |
| --- | --- |
| Manifest 或 entry 載入失敗 | 由既有 optional plugin loader 隔離，不影響首頁其他功能 |
| 題庫 fetch 失敗 | overlay 顯示 `Wordfront could not be loaded.` 與 `Try Again` |
| 題庫格式錯誤或少於 38 個 target | 視為 load error，不建立部分遊戲 |
| DOM mount root 遺失 | controller 回傳失敗並清理已建立資源 |
| 動畫事件未觸發 | fallback 完成 effect，避免卡在 resolving phase |
| 重複點擊／過期題目點擊 | reducer 依 phase、question ID 與 revision 忽略 |
| 外掛中途卸載 | destroy session，移除自己的 DOM 與 listener，不影響網站其他功能 |

Runtime error 只記錄必要 context，不將完整題庫或使用者答題內容大量輸出到 console。

## 15. 測試架構

### 15.1 純邏輯測試

`reducer.test.js`：

- 正確答案依攻防公式扣除怪物 HP，第三次連續答對立即提高 ATK。
- 答錯建立 3 秒 penalty、保留 question deadline 並停用錯誤 option。
- penalty 中 timeout 仍扣玩家 HP，並保留題目與 eliminated options。
- 普通、強力與 Boss 套用玩家 DEF 後分別造成 10、17、25 傷害。
- enemy advance step 不超過最大值。
- active enemy 死亡後正確推進，三波配置合計 10 隻，基礎 ATK 路線最多需要 38 次攻擊。
- 玩家 HP 到 0 進入 defeat；Boss 死亡進入 victory。
- terminal phase 忽略後續戰鬥 action。

`questions.test.js`：

- 正規化 current 與 legacy 題庫欄位。
- 同局產生最多 38 個唯一 target。
- 每題四個唯一英文選項且只有一個 target。
- 優先同詞性，候選不足時正確 fallback。
- 排除相同 normalized definition 的歧義干擾項。
- 注入固定 random 時結果可重現。

### 15.2 Engine 與時間測試

使用 fake clock 驗證：

- 9,999 ms 不攻擊，10,000 ms 恰好 timeout。
- deadline 已到時 answer 不會搶先結算。
- 暫停期間 question、penalty 與 wave deadline 都不前進。
- 自動 pause reason 尚未全部清除時不可 Resume。
- enemy attack 後同題獲得新的完整 10 秒。
- wave clear 後恰好 3 秒進入下一波。
- destroy 後 frame、effect completion 與輸入都不再改變 state。

### 15.3 UI 與外掛整合測試

- activate 後存在 Wordfront 的獨立 tile／mode。
- Wordfront tile 建立全螢幕 dialog，且只在首次開啟時載入 controller。
- close、exclusive popup 切換與 dispose 都呼叫 session cleanup。
- quick tools 數量在 activate／dispose 後正確增減。
- 直向提示、Pause overlay、disabled answers 與結果畫面依 state 顯示。
- 關閉後 focus 回到 Wordfront tile。
- 題庫失敗能 retry，abort 不會顯示錯誤畫面。

### 15.4 建置驗證

預定指令：

```text
npm run build
npm test
```

`build` 必須在 strict TypeScript 下零錯誤；`test` 先 build，再執行所有 core 與 integration tests。

## 16. 實作順序

1. 建立 package、tsconfig、manifest 與固定 config。
2. 完成 vocabulary normalization、question factory 與單元測試。
3. 完成 waves、state、reducer 與規則測試。
4. 完成 fake／browser clock、engine 與時間測試。
5. 完成靜態 view、答案輸入、HP／wave／倒數 render。
6. 完成 controller、全螢幕 lifecycle、pause／orientation 與 cleanup。
7. 完成 plugin 首頁整合，最後才更新根目錄 `plugins.json`。
8. 加入 CSS 動畫、reduced-motion 與動畫 fallback。
9. 補齊整合測試，依 `GAME_DESIGN.md` 的 15 個驗收情境進行完整驗證。

## 17. 首版架構邊界

- 不依賴已移除的 Memory Match 程式。
- 不建立後端 API、資料庫或登入依賴。
- 不保存進行中 session、最高分或錯題紀錄。
- 不加入音訊系統。
- 不建立可配置關卡編輯器；第一版數值由 typed config 固定。
- 不導入 canvas、WebGL、物理引擎或遊戲框架。
- 不把 AI 原型檔名寫入核心狀態；UI 透過 asset catalog、穩定 pose key、統一畫布與 anchor 接收及替換素材。

## 18. 已確認架構決策

| 決策 | 結果 |
| --- | --- |
| 開發語言 | TypeScript |
| Runtime | 原生瀏覽器 ESM |
| UI 技術 | 原生 DOM + CSS |
| 整合方式 | 獨立的 optional plugin |
| 核心模式 | reducer 驅動的明確狀態機 |
| 計時方式 | 單一可暫停 game clock + requestAnimationFrame |
| 隨機性 | 注入 RandomSource，單局預抽最多 38 題 |
| 資料來源 | 主程式提供的 `vocabularyUrl` |
| 規則與畫面 | 完全分離，DOM 不持有權威遊戲狀態 |
| 動畫 | effect 驅動，不能直接修改遊戲數值 |
| 原型美術 | 先產生四張 1024 × 1024 透明 PNG AI 基準圖，後續由基準圖衍生姿勢 |
| 素材替換 | asset catalog + 穩定 entity／pose key，正式素材不影響核心狀態與 combat API |
| 測試 | pure reducer／question tests + fake-clock engine tests + plugin integration tests |
| 首版依賴 | 除 TypeScript 外不增加 runtime dependency |
