/**
 * MenuScene — 由負責主選單的同學實作
 *
 * 接入 GameScene 的標準寫法：
 *   this.scene.start(GameConfig.SCENES.GAME, { level: 1, difficulty: 'normal' });
 *
 * GameScene 在 init(data) 會收到上述 data，未傳的欄位會用 GameConfig.DEFAULT_GAME_DATA 補齊。
 */
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: GameConfig.SCENES.MENU });
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height * 0.3, '詐騙手遊廣告實體化', {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.4, '（主選單 — 同學負責美化）', {
        fontSize: '16px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // --- 接入點：開始 Math Gate 遊戲 ---
    const startBtn = this.add
      .text(width / 2, height * 0.55, '開始 · 數字門射擊', {
        fontSize: '22px',
        color: '#4fc3f7',
        backgroundColor: '#263238',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setStyle({ color: '#81d4fa' }));
    startBtn.on('pointerout', () => startBtn.setStyle({ color: '#4fc3f7' }));
    startBtn.on('pointerdown', () => {
      this.scene.start(GameConfig.SCENES.GAME, {
        ...GameConfig.DEFAULT_GAME_DATA,
        level: 1,
      });
    });

    // 未來：其他小遊戲按鈕
    // this.add.text(...).on('pointerdown', () => this.scene.start('OtherScene'));
  }
}
