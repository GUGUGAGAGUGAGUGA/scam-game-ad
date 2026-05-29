/**
 * GameScene — Math Gate 射擊關（2D 俯視、直式 400×720）
 */
class GameScene extends Phaser.Scene {
  static PLAYER_Y = 650;
  static PLAYER_SIZE = 40;
  static BULLET_W = 5;
  static BULLET_H = 15;
  static BULLET_SPEED = -800;
  static SHOOT_INTERVAL_MS = 150;
  static GATE_W = 185;
  static GATE_H = 72;
  static GATE_SPEED = 110;
  static GATE_SPAWN_MS = 4000;
  static GATE_ALPHA = 0.55;
  static ENEMY_W = 32;
  static ENEMY_H = 32;
  static ENEMY_BASE_HP = 20;
  static ENEMY_HP_SCORE_FACTOR = 1.5;
  static ENEMY_SPEED = 55;
  static ENEMY_SPAWN_MS = 5000;

  constructor() {
    super({ key: GameConfig.SCENES.GAME });
  }

  init(data) {
    this.levelData = { ...GameConfig.DEFAULT_GAME_DATA, ...data };
  }

  create() {
    const { width, height } = this.cameras.main;

    this.score = 0;
    this.gameElapsedTime = 0;
    this.isGameOver = false;
    this.gatePairs = [];

    this.playerStats = {
      fireRate: GameScene.SHOOT_INTERVAL_MS,
      damage: 1,
      gunCount: 1,
      weaponType: 'default' // 新增：預設武器
    };

    this.chaosLevel = 0.0; 

    this._createBackground(width, height);
    this._createBubbles(width, height); // 【新增】：產生背景泡泡
    this._createPlayer(width);
    this._createGroups();

    this.chaosGroup = this.physics.add.group(); // 【新增】：混亂物件的群組
    this._setupCollisions();
    this._createUI();
    this._setupShooting();
    this._setupGateSpawner();
    this._setupEnemySpawner();
    this._createDeathParticles();

    this._setupAdSpawner();

    this._fireBullets();

    this._createPauseMenu();

    this.input.keyboard.on('keydown-ESC', () => {
        this._togglePause();
    });

    this.time.addEvent({
      delay: 25000,
      callback: this._spawnWeaponPickup,
      callbackScope: this,
      loop: true,
    });
  }

  update(time, delta) {
    if (this.isGameOver || this.isPaused) return;

    this.gameElapsedTime += delta / 1000;

    this._handlePlayerMove();
    this._moveBullets(delta);
    this._moveGates(delta);
    this._moveEnemies(delta);
    this._checkEnemyReachedPlayerY();
    this._syncGateLabels();
    this._cleanupGatePairs();
    this._syncEnemyLabels();
    this._destroyOffscreenBullets();

    this._manageChaosObjects();

    this.enemySpawnAccumulator += delta;
    const currentSpawnInterval = Math.max(
      600, 
      5000 - (this.gameElapsedTime * 8) - (this.score * 2)
    );

    if (this.enemySpawnAccumulator >= currentSpawnInterval) {
      this.enemySpawnAccumulator = 0;
      this._spawnEnemy();
    }

    const speedFactor = Math.min(3, 1 + (this.gameElapsedTime / 300) + (this.score / 4000));
    
    this.weaponPickups.getChildren().forEach(pickup => {
        if (pickup.active) {
            pickup.y += (GameScene.GATE_SPEED * speedFactor * delta) / 1000;
            pickup.body.updateFromGameObject();
        }
    });
  }

  _checkEnemyReachedPlayerY() {
    // 判定改為：敵人中心 y 到達玩家中心 y 即結束
    const thresholdY = GameScene.PLAYER_Y;
    this.enemiesGroup.getChildren().forEach((enemy) => {
      if (!enemy.active || this.isGameOver) return;
      if (enemy.y >= thresholdY) this._triggerGameOver();
    });
  }

  _createBackground(width, height) {
    // 替換為貼近主選單影片的深紫紅基底色
    this.add.rectangle(width / 2, height / 2, width, height, 0x2b0d45).setDepth(0);
    
    // 加上一點點深色網格線來增加「數位空間」的感覺 (選用)
    const gridSize = 40;
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0xffffff, 0.05);
    for (let x = 0; x < width; x += gridSize) { gridGraphics.moveTo(x, 0); gridGraphics.lineTo(x, height); }
    for (let y = 0; y < height; y += gridSize) { gridGraphics.moveTo(0, y); gridGraphics.lineTo(width, y); }
    gridGraphics.strokePath();
  }

  _createBubbles(width, height) {
    // 1. 用 Graphics 動態畫出一個白色的圓形作為泡泡材質
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture('bubble_tex', 32, 32);
    g.destroy();

    // 2. 建立粒子發射器，設定由下往上飄
    this.bubbleEmitter = this.add.particles(0, 0, 'bubble_tex', {
        x: { min: 0, max: width },
        y: height + 50, // 從畫面底部外面發射
        lifespan: { min: 6000, max: 10000 },
        speedY: { min: -40, max: -120 }, // 往上飄移
        speedX: { min: -20, max: 20 },
        scale: { start: 0.1, end: 0.6 },
        alpha: { start: 0.4, end: 0 },
        tint: [ 0x88ccff, 0xcc88ff, 0xaa88ff ], // 淺藍色與淺紫色
        frequency: 250,
        blendMode: 'ADD'
    }).setDepth(1); // 放在背景之上，遊戲物件之下
  }

  _createPlayer(width) {
    const playerSize = GameScene.PLAYER_SIZE;
    const half = playerSize / 2;

    this.player = this.add.rectangle(width / 2, GameScene.PLAYER_Y, playerSize, playerSize, 0x2196f3).setDepth(9);
    this.physics.add.existing(this.player);
    this.player.body.setSize(10, 10);
    this.player.body.setOffset(15, 15);
  
    this.player.body.setImmovable(true);
    this.player.body.setAllowGravity(false);

    this.playerDamageLabel = this.add.text(
        this.player.x, 
        this.player.y - 30, 
        String(this.playerStats.damage), 
        { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(15);

    const margin = 8;
    this.playerHalf = half;
    this.playerMinX = half + margin;
    this.playerMaxX = width - half - margin;
    this.dragTargetX = this.player.x;

    this.input.on('pointermove', (p) => this._setPlayerXFromPointer(p));
  }

  _createGroups() {
    // 不用 group 預設速度，避免 add() 後把 velocity 清掉
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.enemiesGroup = this.physics.add.group({ allowGravity: false });
    this.gatesGroup = this.physics.add.group({ allowGravity: false });
    this.weaponPickups = this.physics.add.group({ allowGravity: false });
  }

  _setupShooting() {
    this.shootTimer = this.time.addEvent({
      delay: this.playerStats.fireRate,
      callback: this._fireBullets,
      callbackScope: this,
      loop: true,
    });
  }

  _setupGateSpawner() {
    this.gateSpawnTimer = this.time.addEvent({
      delay: GameScene.GATE_SPAWN_MS,
      callback: this._spawnGatePair,
      callbackScope: this,
      loop: true,
    });
    this._spawnGatePair();
  }

  _spawnGatePair() {
    const { width } = this.cameras.main;
    const spawnY = -GameScene.GATE_H / 2 - 10;
    const pairTemplate = this._generateDynamicGatePair();
    const pair = {
      id: `pair_${Date.now()}`,
      applied: false,
      gates: [],
      labels: [],
    };

    [width * 0.25, width * 0.75].forEach((x, i) => {
      pair.gates.push(this._createGate(x, spawnY, pairTemplate[i], pair));
    });
    this.gatePairs.push(pair);
  }

  _spawnWeaponPickup() {
    if (this.isGameOver) return;
    const { width } = this.cameras.main;
    const x = Phaser.Math.Between(50, width - 50);
    const spawnY = -50;

    // 加入雷射，共三種武器隨機
    const types = ['shotgun', 'cannon', 'laser'];
    const selectedType = Phaser.Utils.Array.GetRandom(types);
    
    let color, labelText;
    if (selectedType === 'shotgun') { color = 0xff9800; labelText = '散彈'; }
    else if (selectedType === 'cannon') { color = 0x9c27b0; labelText = '大砲'; }
    else { color = 0x00e5ff; labelText = '雷射'; }

    const pickup = this.add.rectangle(x, spawnY, 40, 40, color).setDepth(8);
    this.physics.add.existing(pickup);
    pickup.body.setAllowGravity(false);
    pickup.body.setImmovable(true);
    pickup.weaponType = selectedType;

    pickup.label = this.add.text(x, spawnY, labelText, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(9);

    pickup.preUpdate = () => { pickup.label.setPosition(pickup.x, pickup.y); };
    this.weaponPickups.add(pickup);
  }

  _onPlayerHitWeapon(player, pickup) {
    if (!pickup.active) return;
    
    this.playerStats.weaponType = pickup.weaponType;
    console.log("武器切換為:", pickup.weaponType);
    
    let playerColor = 0x2196f3;
    if (pickup.weaponType === 'shotgun') playerColor = 0xff9800;
    if (pickup.weaponType === 'cannon') playerColor = 0x9c27b0;
    if (pickup.weaponType === 'laser') playerColor = 0x00e5ff;
    
    this.player.setFillStyle(playerColor);

    // 【關鍵】：撿到武器後，重新計算射擊間隔
    this._updateShootInterval();

    pickup.label.destroy();
    pickup.destroy();
  }

  _updateShootInterval() {
    if (this.shootTimer) this.shootTimer.remove();
    
    let currentDelay = this.playerStats.fireRate;
    
    // 大砲需要極長的發射間隔 (4倍)
    if (this.playerStats.weaponType === 'cannon') {
        currentDelay *= 4; 
    }

    this.shootTimer = this.time.addEvent({
      delay: currentDelay,
      callback: this._fireBullets,
      callbackScope: this,
      loop: true,
    });
  }

  /** 依分數動態產生一對門（左 / 右） */
  _generateDynamicGatePair() {
    const scoreBonus = Math.floor(this.score / 50) * 5;
    const powerBonus = Math.floor(this.playerStats.damage * 0.15); 
    const baseValue = 5 + scoreBonus + powerBonus;
    
    const progress = Math.floor(this.score / 50);
    const BLUE = 0x1565c0;
    const RED = 0xc62828;
    const GREEN = 0x2e7d32;
    const PURPLE = 0x7b1fa2;

    const makeAdd = () => {
      const val = baseValue + Phaser.Math.Between(1, 10 + progress);
      return { kind: 'add', value: val, label: `+${val}`, color: BLUE };
    };
    const makeMul = () => {
      const val = Phaser.Math.Between(2, progress >= 5 ? 3 : 2);
      return { kind: 'mul', value: val, label: `×${val}`, color: BLUE };
    };
    const makeSub = () => {
      const val = baseValue + Phaser.Math.Between(1, 5) + progress * 5;
      return { kind: 'sub', value: val, label: `-${val}`, color: RED };
    };
    const makeDiv = () => {
      const val = progress >= 2 ? Phaser.Math.Between(2, 3) : 2;
      return { kind: 'div', value: val, label: `÷${val}`, color: RED };
    };
    const makeFireRate = () => {
      const val = 20 + progress * 2;
      return { kind: 'fireRate', value: val, label: 'shooting speed UP', color: GREEN };
    };
    const makeGunCount = () => {
      return { kind: 'gunCount', value: 1, label: 'gun upgrade', color: PURPLE };
    };

    // 檢查屬性是否已經達到極限
    const canUpgradeFireRate = this.playerStats.fireRate > 20;
    const canUpgradeGunCount = this.playerStats.gunCount < 10;

    // 只有在還能升級的情況下，才有 25% 機率生成特殊門
    if ((canUpgradeFireRate || canUpgradeGunCount) && Math.random() < 0.25) {
      let choices = [];
      if (canUpgradeFireRate) choices.push(makeFireRate);
      if (canUpgradeGunCount) choices.push(makeGunCount);
      
      const selectedSpecial = Phaser.Utils.Array.GetRandom(choices)();
      // 隨機放左邊或右邊
      return Math.random() < 0.5 ? [selectedSpecial, makeAdd()] : [makeAdd(), selectedSpecial];
    }

    // 若滿等或沒抽中特殊門，走一般的運算門生成邏輯
    const roll = Math.random();
    if (roll < 0.45) return [makeAdd(), makeAdd()];
    if (roll < 0.65) {
      return Math.random() < 0.5 ? [makeAdd(), makeMul()] : [makeMul(), makeAdd()];
    }
    if (roll < 0.82) {
      return Math.random() < 0.5 ? [makeAdd(), makeSub()] : [makeSub(), makeAdd()];
    }
    if (roll < 0.92) {
      return Math.random() < 0.5 ? [makeAdd(), makeDiv()] : [makeDiv(), makeAdd()];
    }
    return [makeMul(), Phaser.Utils.Array.GetRandom([makeSub, makeDiv])()];
  }

  _createGate(x, y, tpl, pair) {
    const gate = this.add.rectangle(
      x, y, GameScene.GATE_W, GameScene.GATE_H, tpl.color, GameScene.GATE_ALPHA
    );
    this.physics.add.existing(gate);
    gate.body.setAllowGravity(false);
    gate.body.setImmovable(true);
    gate.pairRef = pair;
    gate.gateEffect = tpl;

    const labelFontSize = tpl.label.length > 8 ? '13px' : '28px';
    const label = this.add
      .text(x, y, tpl.label, {
        fontSize: labelFontSize,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: GameScene.GATE_W - 12 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    gate.labelRef = label;
    pair.labels.push(label);
    this.gatesGroup.add(gate);
    gate.body.updateFromGameObject();
    gate.setDepth(5);
    return gate;
  }

  _setupCollisions() {
    this.physics.add.overlap(this.bullets, this.enemiesGroup, this._onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.gatesGroup, this._onPlayerHitGate, null, this);
    this.physics.add.overlap(this.player, this.weaponPickups, this._onPlayerHitWeapon, null, this);
  }

  _createUI() {
    // 【修改】：把 Y 座標從 12 往下移到 30 或 40，避免被邊緣裁切
    this.scoreText = this.add.text(15, 35, 'IQ: 0', { 
        fontSize: '24px', 
        color: '#ffeb3b',
        fontStyle: 'bold', 
        stroke: '#000000', 
        strokeThickness: 5 
    }).setDepth(250); // 【關鍵】：設為 250，保證不會被廣告或混亂物件蓋住

    // 【修改】：狀態列也跟著往下移到 Y = 70 左右
    this.statsText = this.add.text(15, 70, '', { 
        fontSize: '14px', 
        color: '#ffffff', 
        fontStyle: 'bold',
        stroke: '#000000', 
        strokeThickness: 4
    }).setDepth(250);

    this._refreshStatsUI();
  }

  _setupEnemySpawner() {
    this.enemySpawnAccumulator = 0;
  }

  _createDeathParticles() {
    try {
      if (!this.textures.exists('enemy_particle')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xff5252, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture('enemy_particle', 8, 8);
        g.destroy();
      }
      this.deathParticles = this.add.particles(0, 0, 'enemy_particle', {
        speed: { min: 80, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        lifespan: 400,
        quantity: 0,
        emitting: false,
        blendMode: 'ADD',
      });
      this.deathParticles.setDepth(12);
    } catch (err) {
      console.warn('粒子系統初始化失敗，改用簡易爆炸', err);
      this.deathParticles = null;
    }
  }

  _setPlayerXFromPointer(pointer) {
    this.dragTargetX = Phaser.Math.Clamp(pointer.x, this.playerMinX, this.playerMaxX);
  }

  _handlePlayerMove() {
    const lerp = 0.25;
    this.player.x = Phaser.Math.Linear(this.player.x, this.dragTargetX, lerp);
    this.player.y = GameScene.PLAYER_Y;
    this.player.body.updateFromGameObject();
    if (this.playerDamageLabel) {
        this.playerDamageLabel.setPosition(this.player.x, this.player.y - 30);
    }
  }

  _fireBullets() {
    if (this.isGameOver) return;

    const count = this.playerStats.gunCount;
    const spawnY = GameScene.PLAYER_Y - GameScene.PLAYER_SIZE / 2;

    switch (this.playerStats.weaponType) {
      case 'default': {
        const spreadDist = 20;
        const startX = this.player.x - ((count - 1) * spreadDist) / 2;
        for (let i = 0; i < count; i++) {
          const bx = startX + i * spreadDist;
          const bullet = this._createPhysicsRect(bx, spawnY, GameScene.BULLET_W, GameScene.BULLET_H, 0xffeb3b);
          
          // 【關鍵修正】：先加入群組，再設定數值與速度！
          this.bullets.add(bullet);
          bullet.damage = this.playerStats.damage;
          bullet.body.setVelocityY(GameScene.BULLET_SPEED);
        }
        break;
      }

      case 'shotgun': { 
        // 確保最大擴散角度不會超過 45 度
        const dynamicSpreadAngle = count === 1 ? 0 : Math.min(15, 15 + (count * 5)); 
        const barrelSpacing = 10; 
        const startX = this.player.x - ((count - 1) * barrelSpacing) / 2;

        const startAngle = count === 1 ? -90 : -90 - (dynamicSpreadAngle / 2);
        const angleStep = count === 1 ? 0 : dynamicSpreadAngle / (count - 1);
        
        for (let i = 0; i < count; i++) {
          const bx = startX + i * barrelSpacing;
          const bullet = this._createPhysicsRect(bx, spawnY, 8, 12, 0xff9800);
          
          this.bullets.add(bullet);
          bullet.damage = this.playerStats.damage * 0.8; 
          
          const angleRad = Phaser.Math.DegToRad(startAngle + i * angleStep);
          const speed = Math.abs(GameScene.BULLET_SPEED);
          
          bullet.body.setVelocity(Math.cos(angleRad) * speed, Math.sin(angleRad) * speed);
          bullet.setRotation(angleRad + Math.PI / 2);
        }
        break;
      }

      case 'laser': {
        const laserWidth = 15 + (count * 10);
        const laserHeight = this.cameras.main.height;
        const laserY = GameScene.PLAYER_Y - (laserHeight / 2); 
        
        const laser = this._createPhysicsRect(this.player.x, laserY, laserWidth, laserHeight, 0x00e5ff);
        
        // 【關鍵修正】：先加入群組
        this.bullets.add(laser);
        laser.damage = this.playerStats.damage * 1.5; 
        laser.isPiercing = true;
        laser.hitEnemies = new Set();
        laser.body.setVelocityY(0); 

        this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 150,
            onComplete: () => laser.destroy()
        });
        break;
      }

      case 'cannon': {
        const cannonBullet = this._createPhysicsRect(this.player.x, spawnY, 25, 25, 0x9c27b0);
        
        // 【關鍵修正】：先加入群組
        this.bullets.add(cannonBullet);
        cannonBullet.damage = this.playerStats.damage * 4; 
        cannonBullet.isExplosive = true; 
        cannonBullet.blastRadius = 50 + (count * 25); 
        cannonBullet.body.setVelocityY(GameScene.BULLET_SPEED * 0.6); 
        break;
      }
    }
  }

  _onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    // 處理大砲爆炸邏輯
    if (bullet.isExplosive) {
        this._createExplosion(bullet.x, bullet.y, bullet.blastRadius, bullet.damage);
        bullet.destroy();
        return; // 後續傷害由爆炸效果來結算
    }

    // 處理雷射貫穿邏輯
    if (bullet.isPiercing) {
        if (bullet.hitEnemies.has(enemy)) return; // 避免同一道雷射在一幀內重複打同一個敵人
        bullet.hitEnemies.add(enemy);
    } else {
        bullet.destroy();
    }

    enemy.hp -= bullet.damage ?? this.playerStats.damage;
    if (enemy.hpLabel) {
      enemy.hpLabel.setText(String(Math.max(0, Math.floor(enemy.hp))));
    }

    if (enemy.hp <= 0) {
      this._killEnemy(enemy);
    }
  }

  // 【全新加入】：大砲的範圍爆炸處理
  _createExplosion(x, y, radius, damage) {
    // 1. 畫出爆炸的視覺效果 (紫色半透明圓形)
    const explosionFX = this.add.circle(x, y, radius, 0x9c27b0, 0.6).setDepth(15);
    
    // 爆炸動畫：放大並漸隱
    this.tweens.add({
        targets: explosionFX,
        scale: 1.5,
        alpha: 0,
        duration: 300,
        onComplete: () => explosionFX.destroy()
    });

    // 畫面震動增強打擊感
    this.cameras.main.shake(150, 0.015);

    // 2. 物理判定：找出半徑內的所有敵人並扣血
    this.enemiesGroup.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        
        // 測量敵人到爆炸中心的距離
        const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
        
        if (dist <= radius) {
            enemy.hp -= damage;
            if (enemy.hpLabel) {
                enemy.hpLabel.setText(String(Math.max(0, Math.floor(enemy.hp))));
            }
            if (enemy.hp <= 0) {
                this._killEnemy(enemy);
            }
        }
    });
  }

  /** Phaser 3.80 無 physics.add.rectangle，需先 add 再 existing */
  _createPhysicsRect(x, y, w, h, color) {
    const rect = this.add.rectangle(x, y, w, h, color);
    rect.setDepth(8);
    this.physics.add.existing(rect);
    rect.body.setAllowGravity(false);
    rect.body.setImmovable(false);
    rect.body.setSize(w, h);
    rect.body.updateFromGameObject();
    return rect;
  }

  _moveBullets(delta) {
    
  }

  _moveGates(delta) {
    const speedFactor = Math.min(3, 1 + (this.gameElapsedTime / 300) + (this.score / 4000));
    const dy = (GameScene.GATE_SPEED * speedFactor * delta) / 1000;
    
    this.gatePairs.forEach((pair) => {
      pair.gates.forEach((gate) => {
        if (!gate.active) return;
        gate.y += dy;
        gate.body.updateFromGameObject();
      });
    });
  }

  _moveEnemies(delta) {
    const speedFactor = Math.min(3, 1 + (this.gameElapsedTime /300) + (this.score / 4000));
    const dy = (GameScene.ENEMY_SPEED * speedFactor * delta) / 1000;
    
    this.enemiesGroup.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      enemy.y += dy;
      enemy.body.updateFromGameObject();
    });
  }
  _destroyOffscreenBullets() {
    const bullets = this.bullets.getChildren();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (bullet.active && bullet.y < -GameScene.BULLET_H) {
        bullet.destroy();
      }
    }
  }

  _onPlayerHitGate(player, gate) {
    const pair = gate.pairRef;
    if (!pair || pair.applied) return;
    pair.applied = true;
    this._applyGateEffect(gate.gateEffect);
    this._destroyGatePair(pair);
    this._refreshStatsUI();
  }

  _applyGateEffect(effect) {
    switch (effect.kind) {
      case 'add':
        this.playerStats.damage += effect.value;
        break;
      case 'sub':
        this.playerStats.damage = Math.max(1, this.playerStats.damage - effect.value);
        break;
      case 'mul':
        this.playerStats.damage *= effect.value;
        break;
      case 'div':
        this.playerStats.damage = Math.max(1, Math.floor(this.playerStats.damage / effect.value));
        break;
      case 'fireRate':
        const oldRate = this.playerStats.fireRate;
        // 極限射速提升至 20 毫秒
        this.playerStats.fireRate = Math.max(20, this.playerStats.fireRate - effect.value);
        this._updateShootInterval();
        
        // 只有在這次升級「剛好」達到極限時才跳字
        if (oldRate > 20 && this.playerStats.fireRate === 20) {
            this._showFloatingText(this.player.x, this.player.y - 50, "MAX SPEED", "#ffffff");
        }
        break;
      case 'gunCount':
        const oldGun = this.playerStats.gunCount;
        // 極限槍數提升至 10 管
        this.playerStats.gunCount = Math.min(10, this.playerStats.gunCount + effect.value);
        
        // 只有在這次升級「剛好」達到極限時才跳字
        if (oldGun < 10 && this.playerStats.gunCount === 10) {
            this._showFloatingText(this.player.x, this.player.y - 50, "MAX GUNS", "#ffffff");
        }
        break;
    }
    if (this.playerDamageLabel) {
        this.playerDamageLabel.setText(String(Math.floor(this.playerStats.damage)));
    }
  }

  _destroyGatePair(pair) {
    pair.gates.forEach((g) => g.active && g.destroy());
    pair.labels.forEach((l) => l.active && l.destroy());
    this.gatePairs = this.gatePairs.filter((p) => p.id !== pair.id);
  }

  _syncGateLabels() {
    this.gatePairs.forEach((pair) => {
      pair.gates.forEach((gate, i) => {
        if (gate.active && pair.labels[i]) {
          pair.labels[i].setPosition(gate.x, gate.y);
        }
      });
    });
  }

  _cleanupGatePairs() {
    const limitY = this.cameras.main.height + GameScene.GATE_H;
    [...this.gatePairs].forEach((pair) => {
      const first = pair.gates[0];
      if (first && first.y > limitY) {
        this._destroyGatePair(pair);
      }
    });
  }

  _spawnEnemy() {
    if (this.isGameOver) return;
    const { width } = this.cameras.main;

    // 核心邏輯：計算玩家當前的理論總火力
    const currentPower = this.playerStats.damage * this.playerStats.gunCount;

    let doomFactor = 1;
    if (this.gameElapsedTime > 240) {
      doomFactor = Math.exp((this.gameElapsedTime - 240) * 0.05);
    }

    const baseHp = GameScene.ENEMY_BASE_HP;
    
    const powerScaling = currentPower * Phaser.Math.FloatBetween(2.5, 5.5);
    
    const scoreScaling = this.score * 2.0;
    
    let targetHp = Math.floor((baseHp + powerScaling + scoreScaling) * doomFactor);

    // 30% 機率生成「敵人牆」（同一排 3 隻怪）
    if (this.score > 50 && Math.random() < 0.3) {
      const numEnemies = Phaser.Math.Between(2, 4); // 隨機決定這排有幾隻
      const weakIndex = Phaser.Math.Between(0, numEnemies - 1); // 隨機選定一個破口
      const segmentWidth = width / numEnemies; // 將畫面寬度均分

      for (let i = 0; i < numEnemies; i++) {
        // 核心修改：在每個均分的區塊內，加上亂數偏移量 (Jitter)
        // 使用 minX 和 maxX 確保怪物不會跑到畫面外或互相重疊得太誇張
        const minX = Math.max(20, i * segmentWidth + 16);
        const maxX = Math.min(width - 20, (i + 1) * segmentWidth - 16);
        const ex = Phaser.Math.Between(minX, maxX);
        
        const finalHp = i === weakIndex ? Math.max(1, Math.floor(targetHp * 0.3)) : targetHp;
        this._createSingleEnemy(ex, finalHp);
      }
    } else {
      // 一般單體生成
      const x = Phaser.Math.Between(30, width - 30);
      this._createSingleEnemy(x, targetHp);
    }
  }

  // 輔助函式：處理單隻敵人的實體生成
  _createSingleEnemy(x, hp) {
    const spawnY = -GameScene.ENEMY_H;
    const enemy = this.add.rectangle(x, spawnY, GameScene.ENEMY_W, GameScene.ENEMY_H, 0xe53935).setDepth(7);
    
    this.physics.add.existing(enemy);
    enemy.body.setAllowGravity(false);
    enemy.body.setImmovable(true);
    enemy.body.setSize(GameScene.ENEMY_W, GameScene.ENEMY_H);
    enemy.hp = hp;

    enemy.hpLabel = this.add
      .text(x, spawnY - 22, String(hp), {
        fontSize: '18px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(11);

    this.enemiesGroup.add(enemy);
  }
  
  _killEnemy(enemy) {
    const { x, y } = enemy;
    this.cameras.main.shake(100, 0.005);
    
    if (this.deathParticles) {
      this.deathParticles.setPosition(x, y);
      this.deathParticles.explode(18);
    } else {
      this._spawnHitBurstFallback(x, y);
    }
    
    enemy.hpLabel?.destroy();
    enemy.destroy();
    
    // 可以考慮把 +10 改成 +1 或 +2，讓 IQ 成長看起來比較合理，這裡先維持你的設定
    this.score += 5; 
    this.scoreText.setText(`IQ: ${this.score}`); // 更新這行
  }

  _spawnHitBurstFallback(x, y) {
    for (let i = 0; i < 10; i++) {
      const p = this.add.circle(x, y, 4, 0xff5252).setDepth(12);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(25, 70);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  _onPlayerHitEnemy() {
    if (this.isGameOver) return;
    console.log('Game Over');
    this._triggerGameOver();
  }

  _syncEnemyLabels() {
    this.enemiesGroup.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      if (enemy.hpLabel) enemy.hpLabel.setPosition(enemy.x, enemy.y - 28);
      if (enemy.y > this.cameras.main.height + 50) {
        enemy.hpLabel?.destroy();
        enemy.destroy();
      }
    });
  }

  _showFloatingText(x, y, msg, color = '#ffffff') {
    const txt = this.add.text(x, y, msg, {
        fontSize: '18px', color: color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
        targets: txt,
        y: y - 50, // 往上飄 50px
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => txt.destroy()
    });
  }

  _setupAdSpawner() {
    // 遊戲開始後 5 秒跳第一個廣告，讓玩家先稍微習慣一下節奏
    this.adTimer = this.time.addEvent({
      delay: 5000,
      callback: this._spawnScamAd,
      callbackScope: this,
      loop: false
    });
  }

  _spawnScamAd() {
    if (this.isGameOver) return;

    const { width, height } = this.cameras.main;

    // 1. 隨機決定視窗大小與位置
    const adW = Phaser.Math.Between(200, 320);
    const adH = Phaser.Math.Between(150, 300);
    const padding = 10;
    const x = Phaser.Math.Between(adW / 2 + padding, width - adW / 2 - padding);
    const y = Phaser.Math.Between(adH / 2 + 50, height - adH / 2 - padding);

    // 2. 建立 Container 群組
    const adContainer = this.add.container(x, y).setDepth(100);

    // 3. 背景與邊框 (用大一點的黑色方形疊在底下當作邊框)
    const bgBorder = this.add.rectangle(0, 0, adW + 6, adH + 6, 0x000000);
    const bg = this.add.rectangle(0, 0, adW, adH, 0xffffff);
    adContainer.add([bgBorder, bg]);

    // 4. 藍色標題列
    const titleBarH = 30;
    const titleBarY = -adH / 2 + titleBarH / 2;
    const titleBar = this.add.rectangle(0, titleBarY, adW, titleBarH, 0x0a59a8);
    adContainer.add(titleBar);

    // 5. 關閉按鈕 (紅色底色 + X)
    const closeBtnSize = 24;
    const closeBtnX = adW / 2 - closeBtnSize / 2 - 3;
    const closeBtnY = titleBarY;
    
    const closeBtnBg = this.add.rectangle(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 0xff0000);
    const closeBtnText = this.add.text(closeBtnX, closeBtnY, 'X', {
        fontSize: '16px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    adContainer.add([closeBtnBg, closeBtnText]);

    // 6. 設定關閉按鈕的互動
    closeBtnBg.setInteractive({ useHandCursor: true });
    closeBtnBg.on('pointerdown', () => {
        // 點擊特效：稍微縮小一下再消失
        this.tweens.add({
            targets: adContainer,
            scale: 0.8,
            alpha: 0,
            duration: 100,
            onComplete: () => adContainer.destroy()
        });
    });

    // 7. 廣告內容區 (預留)
    const contentText = this.add.text(0, 10, '恭喜中獎！\n\n(點擊右上角關閉)', {
        fontSize: '18px', color: '#000000', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5);
    adContainer.add(contentText);

    // 8. 加上進場動畫 (彈出感)
    adContainer.setScale(0);
    this.tweens.add({
        targets: adContainer,
        scale: 1,
        duration: 300,
        ease: 'Back.out(1.7)'
    });

    // 9. 動態排程下一次廣告 (核心：隨時間越來越快)
    // 初始約 8~12 秒一次。玩家每存活 10 秒，間隔就減少 500 毫秒
    const timeReduction = (this.gameElapsedTime / 10) * 500; 
    
    // 最快極限：保底至少 1~2 秒才會生出下一個，避免遊戲完全當機
    const minDelay = Math.max(1000, 8000 - timeReduction);
    const maxDelay = Math.max(2000, 12000 - timeReduction);
    const nextDelay = Phaser.Math.Between(minDelay, maxDelay);

    this.adTimer = this.time.addEvent({
      delay: nextDelay,
      callback: this._spawnScamAd,
      callbackScope: this,
      loop: false
    });
  }

  _createPauseMenu() {
    const { width, height } = this.cameras.main;
    this.isPaused = false;

    // 建立一個 Container 來裝暫停選單的所有元素
    this.pauseContainer = this.add.container(0, 0).setDepth(200);
    this.pauseContainer.setVisible(false); // 預設隱藏

    // 1. 全螢幕半透明黑底 (讓背景變暗)
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    
    // 2. 暫停視窗本體 (外框黃、內部透明灰)
    const menuW = 280;
    const menuH = 260;
    const menuX = width / 2;
    const menuY = height / 2;
    
    // 內部透明灰 (0x222222, 透明度 0.8)
    const menuBg = this.add.rectangle(menuX, menuY, menuW, menuH, 0x222222, 0.85);
    // 外框黃色粗框
    menuBg.setStrokeStyle(6, 0xffeb3b);

    // 3. 標題文字
    const title = this.add.text(menuX, menuY - 70, '遊戲暫停', {
        fontSize: '32px', color: '#ffeb3b', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);

    // 4. 加入按鈕
    const resumeBtn = this._createMenuButton(menuX, menuY + 10, '繼續遊戲', () => this._togglePause());
    const quitBtn = this._createMenuButton(menuX, menuY + 80, '回主選單', () => {
        // 清除可能殘留的 HTML 廣告 (若你還有用 HTML 生成的話)
        const existingAds = document.querySelectorAll('.scam-ad-popup');
        existingAds.forEach(ad => ad.remove());
        // 返回主選單
        this.scene.start('MenuScene'); // 請確保這裡的字串與同學的主選單 Scene Key 一致
    });

    this.pauseContainer.add([overlay, menuBg, title, resumeBtn, quitBtn]);
  }

  _manageChaosObjects() {
    // 依據 chaosLevel 決定最大干擾物件數量 (最高 20 個)
    const maxObjects = Math.floor(this.chaosLevel * 20);
    
    // 如果數量還沒滿，有小機率生成新視窗
    if (this.chaosGroup.getLength() < maxObjects && Math.random() < 0.05) {
        const { width, height } = this.cameras.main;
        const x = Phaser.Math.Between(50, width - 50);
        const y = Phaser.Math.Between(50, height / 2);
        
        // 隨機決定迷你視窗的大小
        const winW = Phaser.Math.Between(120, 180);
        const winH = Phaser.Math.Between(80, 120);
        
        // 建立 Container 來裝迷你視窗
        const obj = this.add.container(x, y);
        
        // 1. 視窗背景與黑邊框
        const bg = this.add.rectangle(0, 0, winW, winH, 0xffffff);
        bg.setStrokeStyle(3, 0x000000);
        
        // 2. 藍色標題列
        const titleH = 24;
        const titleY = -winH / 2 + titleH / 2;
        const titleBar = this.add.rectangle(0, titleY, winW, titleH, 0x0a59a8);
        
        // 3. 紅色叉叉 (純視覺，因為它們會自己亂彈)
        const btnSize = 16;
        const btnX = winW / 2 - btnSize / 2 - 4;
        const btnBg = this.add.rectangle(btnX, titleY, btnSize, btnSize, 0xff0000);
        const btnTxt = this.add.text(btnX, titleY, 'X', { 
            fontSize: '12px', color: '#fff', fontStyle: 'bold' 
        }).setOrigin(0.5);
        
        // 4. 隨機警告文字
        const words = ['⚠️ ERROR', 'VIRUS.exe', 'CLICK ME!', 'HOT SINGLES', 'SYSTEM FAULT'];
        const textStr = Phaser.Utils.Array.GetRandom(words);
        const textColor = Phaser.Utils.Array.GetRandom(['#ff0000', '#000000']);
        const text = this.add.text(0, 10, textStr, { 
            fontSize: '18px', color: textColor, fontStyle: 'bold' 
        }).setOrigin(0.5);
        
        // 將所有元件打包進 Container
        obj.add([bg, titleBar, btnBg, btnTxt, text]);
        
        // 設定物理引擎
        this.physics.add.existing(obj);
        obj.body.setSize(winW, winH);
        // 【關鍵】：Phaser 的 Container 物理錨點預設在左上角，必須校正回中心
        obj.body.setOffset(-winW / 2, -winH / 2);
        
        obj.body.setBounce(1, 1); // 碰到邊界完全反彈
        obj.body.setCollideWorldBounds(true); // 限制在螢幕內
        obj.body.setVelocity(Phaser.Math.Between(-250, 250), Phaser.Math.Between(-250, 250)); 
        
        obj.setDepth(110); // 浮在極高的圖層，擋住視線
        obj.spawnTime = this.gameElapsedTime;
        obj.lifeTime = Phaser.Math.Between(3, 7); // 存活 3~7 秒後自行消失
        
        // 加入彈出的進場動畫
        obj.setScale(0);
        this.tweens.add({ targets: obj, scale: 1, duration: 200, ease: 'Back.out(1.5)' });

        this.chaosGroup.add(obj);
    }

    // 檢查並清除過期的干擾視窗 (拔除原本的旋轉邏輯)
    this.chaosGroup.getChildren().forEach(obj => {
        if (this.gameElapsedTime - obj.spawnTime > obj.lifeTime) {
            // 加上 isDying 標記避免重複觸發 tween 動畫
            if (!obj.isDying) {
                obj.isDying = true;
                // 消失前快速縮小，增加動態感
                this.tweens.add({
                    targets: obj,
                    scale: 0,
                    duration: 150,
                    onComplete: () => obj.destroy()
                });
            }
        }
    });
  }

  // 產生暫停選單按鈕的輔助函式
  _createMenuButton(x, y, text, onClick) {
    const container = this.add.container(x, y);
    // 按鈕底色
    const bg = this.add.rectangle(0, 0, 180, 50, 0x0a59a8);
    bg.setStrokeStyle(3, 0xffffff);
    const txt = this.add.text(0, 0, text, {
        fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    // 簡單的 Hover 效果
    bg.on('pointerover', () => bg.setFillStyle(0x1565c0));
    bg.on('pointerout', () => bg.setFillStyle(0x0a59a8));

    container.add([bg, txt]);
    return container;
  }

  _togglePause() {
    if (this.isGameOver) return;
    
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
        // --- 啟動暫停 ---
        this.physics.pause(); // 凍結物理引擎 (子彈停住)
        this.tweens.pauseAll(); // 凍結動畫 (雷射、廣告動畫停住)
        
        // 暫停所有的計時器
        if (this.shootTimer) this.shootTimer.paused = true;
        if (this.gateSpawnTimer) this.gateSpawnTimer.paused = true;
        if (this.adTimer) this.adTimer.paused = true;
        
        this.pauseContainer.setVisible(true);
    } else {
        // --- 解除暫停 ---
        this.physics.resume();
        this.tweens.resumeAll();
        
        if (this.shootTimer) this.shootTimer.paused = false;
        if (this.gateSpawnTimer) this.gateSpawnTimer.paused = false;
        if (this.adTimer) this.adTimer.paused = false;
        
        this.pauseContainer.setVisible(false);
    }
  }

  _createPauseMenu() {
    const { width, height } = this.cameras.main;
    this.isPaused = false;

    this.pauseContainer = this.add.container(0, 0).setDepth(200);
    this.pauseContainer.setVisible(false); 

    // 1. 全螢幕半透明黑底
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    
    // 2. 暫停視窗本體 (稍微加高以容納滑桿)
    const menuW = 300;
    const menuH = 340; 
    const menuX = width / 2;
    const menuY = height / 2;
    
    const menuBg = this.add.rectangle(menuX, menuY, menuW, menuH, 0x222222, 0.85);
    menuBg.setStrokeStyle(6, 0xffeb3b);

    // 3. 標題文字
    const title = this.add.text(menuX, menuY - 120, '遊戲暫停', {
        fontSize: '32px', color: '#ffeb3b', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);

    // 4. --- 畫面混亂度 滑桿 (Slider) ---
    const sliderY = menuY - 40;
    const sliderLabel = this.add.text(menuX, sliderY - 30, '網頁物件混亂度', {
        fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const trackW = 220;
    const track = this.add.rectangle(menuX, sliderY, trackW, 10, 0x555555); // 灰底軌道
    // 黃色填充條 (以左側為起點縮放)
    const fill = this.add.rectangle(menuX - trackW / 2, sliderY, trackW * this.chaosLevel, 10, 0xffeb3b).setOrigin(0, 0.5);
    // 白色控制圓點
    const thumb = this.add.circle((menuX - trackW / 2) + (trackW * this.chaosLevel), sliderY, 14, 0xffffff);

    // 設定圓點可拖曳
    thumb.setInteractive({ draggable: true, useHandCursor: true });
    thumb.on('drag', (pointer, dragX) => {
        // 限制拖曳範圍在軌道內
        const minX = menuX - trackW / 2;
        const maxX = menuX + trackW / 2;
        thumb.x = Phaser.Math.Clamp(dragX, minX, maxX);
        
        // 更新黃色填充條長度
        fill.width = thumb.x - minX;
        
        // 將位置轉換為 0.0 ~ 1.0 的小數，更新至變數
        this.chaosLevel = fill.width / trackW; 
    });

    // 5. 加入按鈕
    const resumeBtn = this._createMenuButton(menuX, menuY + 40, '繼續遊戲', () => this._togglePause());
    const quitBtn = this._createMenuButton(menuX, menuY + 110, '回主選單', () => {
        this.scene.start('MenuScene'); 
    });

    this.pauseContainer.add([overlay, menuBg, title, sliderLabel, track, fill, thumb, resumeBtn, quitBtn]);
  }

  _refreshStatsUI() {
    const s = this.playerStats;
    this.statsText.setText(`攻擊力: ${s.damage} | 射速: ${s.fireRate}ms | 升級: ${s.gunCount}`);
  }

  _triggerGameOver() {
    this.isGameOver = true;
    this.enemySpawnEvent?.remove();
    this.gateSpawnTimer?.remove();
    this.shootTimer?.remove();
    this.adTimer?.remove(); // 停止生成新廣告
    this.physics.pause();

    // 【新增】：一鍵清除所有散落在網頁上的 HTML 廣告
    const existingAds = document.querySelectorAll('.scam-ad-popup');
    existingAds.forEach(ad => ad.remove());

    this.onGameOver();

    this.scene.start('GameOverScene', {
      score: this.score,
    });
  }

  // 供同學調用的介面：遊戲結束時
  onGameOver() {
    console.log('你的IQ:', this.score);
    // 同學的主選單可以使用 this.scene.start('GameOverScene') 切換
  }
}
