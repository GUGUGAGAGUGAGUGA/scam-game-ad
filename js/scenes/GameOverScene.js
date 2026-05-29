/**
 * GameOverScene — 簡易結算畫面
 * 顯示分數與 Retry 按鈕，方便同學從主選單或其他地方接管流程。
 */
class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.finalScore = data?.score ?? 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height * 0.3, 'GAME OVER', {
        fontSize: '42px',
        color: '#ff5252',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.42, `IQ: ${this.finalScore}`, {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const retryBtn = this.add
      .text(width / 2, height * 0.6, 'RETRY', {
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: '#1565c0',
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerover', () =>
      retryBtn.setStyle({ backgroundColor: '#1e88e5' }),
    );
    retryBtn.on('pointerout', () =>
      retryBtn.setStyle({ backgroundColor: '#1565c0' }),
    );

    // 預設 Retry：直接重開 GameScene
    retryBtn.on('pointerdown', () => {
      this.scene.start(GameConfig.SCENES.GAME);
      // 同學若想改成回主選單，可在這裡改成：
      // this.scene.start(GameConfig.SCENES.MENU);
    });
  }
}

