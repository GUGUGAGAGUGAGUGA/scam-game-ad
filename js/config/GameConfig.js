/**
 * 全組共用設定 — 主選單與各遊戲 Scene 都應引用此檔，避免魔術數字分散。
 */
const GameConfig = {
  // Phaser 遊戲畫布（main.js 會讀取）
  WIDTH: 400,
  HEIGHT: 720,
  BACKGROUND_COLOR: '#1a1a2e',

  // Scene 名稱（字串必須與 class key 一致）
  SCENES: {
    MENU: 'MenuScene',
    GAME: 'GameScene',
  },

  // 從主選單傳入 GameScene 的預設資料結構
  DEFAULT_GAME_DATA: {
    level: 1,
    // 同學可在 MenuScene 覆寫，例如選關、難度
    difficulty: 'normal',
  },

  // 數字門運算子（紅門通常為減益/除法，藍門為增益）
  GATE: {
    RED: 'red',
    BLUE: 'blue',
    OPS: {
      ADD: '+',
      SUB: '-',
      MUL: '×',
    },
  },

  // 增益類型 ID（GameScene 內 buff 系統使用）
  BUFF: {
    FIRE_RATE: 'fireRate',
    DAMAGE: 'damage',
    GUN_COUNT: 'gunCount',
  },
};

// 讓非 module 的 script 標籤也能使用
window.GameConfig = GameConfig;
