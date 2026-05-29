/**
 * Phaser 3 遊戲入口
 * 直式手機比例 400×720，Arcade Physics
 */
const GAME_WIDTH = 400;
const GAME_HEIGHT = 720;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [
    //MenuScene,
    GameScene,
    GameOverScene,
  ],
};

const game = new Phaser.Game(config);
