/**
 * Unit tests for MarioGame module
 *
 * This test suite provides comprehensive coverage of all game functionality
 * including edge cases, invalid inputs, and expected behaviors.
 */

import { MarioGame, GameConfig } from '../../../src/examples/MarioGame';

describe('MarioGame', () => {
  describe('Constructor and Initialization', () => {
    it('should create a new game with valid configuration', () => {
      const config: GameConfig = {
        playerName: 'Mario',
        lives: 3,
        startLevel: 1,
      };
      const game = new MarioGame(config);

      expect(game.getLives()).toBe(3);
      expect(game.getScore()).toBe(0);
      expect(game.getCoins()).toBe(0);
      expect(game.getCurrentLevel()).toBe(1);
      expect(game.getGameState()).toBe('idle');
      expect(game.getPlayerState()).toBe('small');
      expect(game.getPlayerPosition()).toBe(0);
      expect(game.isPlayerJumping()).toBe(false);
      expect(game.isLevelComplete()).toBe(false);
      expect(game.isGameOver()).toBe(false);
    });

    it('should use default values when optional parameters are not provided', () => {
      const game = new MarioGame({ playerName: 'Luigi' });

      expect(game.getLives()).toBe(3);
      expect(game.getCurrentLevel()).toBe(1);
    });

    it('should throw error when player name is empty', () => {
      expect(() => new MarioGame({ playerName: '' })).toThrow('Player name cannot be empty');
    });

    it('should throw error when player name is only whitespace', () => {
      expect(() => new MarioGame({ playerName: '   ' })).toThrow('Player name cannot be empty');
    });

    it('should throw error when lives are negative', () => {
      expect(() => new MarioGame({ playerName: 'Mario', lives: -1 })).toThrow(
        'Lives cannot be negative'
      );
    });

    it('should throw error when start level is less than 1', () => {
      expect(() => new MarioGame({ playerName: 'Mario', startLevel: 0 })).toThrow(
        'Start level must be at least 1'
      );
    });

    it('should accept zero lives', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 0 });
      expect(game.getLives()).toBe(0);
    });

    it('should accept large values for lives', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 99 });
      expect(game.getLives()).toBe(99);
    });
  });

  describe('Level Management', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
    });

    it('should start level correctly', () => {
      game.startLevel(1);

      expect(game.getCurrentLevel()).toBe(1);
      expect(game.getGameState()).toBe('playing');
      expect(game.isLevelComplete()).toBe(false);
      expect(game.getPlayerPosition()).toBe(0);
    });

    it('should initialize enemies based on level number', () => {
      game.startLevel(1);
      const enemies = game.getEnemies();

      // Level 1 should have 3 enemies (levelNumber + 2)
      expect(enemies.length).toBe(3);
      expect(enemies.every((e) => !e.defeated)).toBe(true);
    });

    it('should initialize more enemies for higher levels', () => {
      game.startLevel(5);
      const enemies = game.getEnemies();

      // Level 5 should have 7 enemies (5 + 2)
      expect(enemies.length).toBe(7);
    });

    it('should throw error when starting level with invalid number', () => {
      expect(() => game.startLevel(0)).toThrow('Level number must be at least 1');
      expect(() => game.startLevel(-5)).toThrow('Level number must be at least 1');
    });

    it('should throw error when starting level while game is over', () => {
      game.startLevel(1);
      // Force game over by losing all lives
      game.hitEnemy('Goomba', false);
      game.hitEnemy('Koopa', false);
      game.hitEnemy('Piranha Plant', false);

      expect(() => game.startLevel(2)).toThrow('Cannot start level: Game is over');
    });

    it('should reset player position when starting new level', () => {
      game.startLevel(1);
      game.movePlayer(50);
      expect(game.getPlayerPosition()).toBe(50);

      game.startLevel(2);
      expect(game.getPlayerPosition()).toBe(0);
    });

    it('should complete level successfully', () => {
      game.startLevel(1);
      const scoreBefore = game.getScore();

      game.completeLevel();

      expect(game.isLevelComplete()).toBe(true);
      expect(game.getGameState()).toBe('completed');
      expect(game.getScore()).toBe(scoreBefore + 5000); // Completion bonus
    });

    it('should throw error when completing level while not playing', () => {
      expect(() => game.completeLevel()).toThrow(
        'Cannot complete level: Game is not in playing state'
      );
    });
  });

  describe('Player Movement', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should move player right', () => {
      game.movePlayer(10);
      expect(game.getPlayerPosition()).toBe(10);

      game.movePlayer(5);
      expect(game.getPlayerPosition()).toBe(15);
    });

    it('should move player left', () => {
      game.movePlayer(20);
      game.movePlayer(-5);
      expect(game.getPlayerPosition()).toBe(15);
    });

    it('should prevent moving off the left edge', () => {
      game.movePlayer(10);
      game.movePlayer(-20);
      expect(game.getPlayerPosition()).toBe(0);
    });

    it('should throw error when moving while not playing', () => {
      game.pause();
      expect(() => game.movePlayer(10)).toThrow('Cannot move player: Game is not in playing state');
    });

    it('should accept zero distance movement', () => {
      const initialPosition = game.getPlayerPosition();
      game.movePlayer(0);
      expect(game.getPlayerPosition()).toBe(initialPosition);
    });
  });

  describe('Jumping Mechanics', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should make player jump', () => {
      game.jump();

      expect(game.isPlayerJumping()).toBe(true);
    });

    it('should throw error when player is already jumping', () => {
      game.jump();
      expect(() => game.jump()).toThrow('Player is already jumping');
    });

    it('should land player after jump', () => {
      game.jump();
      game.land();

      expect(game.isPlayerJumping()).toBe(false);
    });

    it('should throw error when jumping while not playing', () => {
      game.pause();
      expect(() => game.jump()).toThrow('Cannot jump: Game is not in playing state');
    });

    it('should reset jumping state when starting new level', () => {
      game.jump();
      game.startLevel(2);

      expect(game.isPlayerJumping()).toBe(false);
    });
  });

  describe('Coin Collection', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should collect coins and increase score', () => {
      game.collectCoin();

      expect(game.getCoins()).toBe(1);
      expect(game.getScore()).toBe(10);
    });

    it('should grant extra life every 100 coins', () => {
      const initialLives = game.getLives();

      // Collect 100 coins
      for (let i = 0; i < 100; i++) {
        game.collectCoin();
      }

      expect(game.getCoins()).toBe(100);
      expect(game.getLives()).toBe(initialLives + 1);
    });

    it('should grant multiple extra lives for 200 coins', () => {
      const initialLives = game.getLives();

      for (let i = 0; i < 200; i++) {
        game.collectCoin();
      }

      expect(game.getLives()).toBe(initialLives + 2);
    });

    it('should throw error when collecting coin while not playing', () => {
      game.pause();
      expect(() => game.collectCoin()).toThrow('Cannot collect coin: Game is not in playing state');
    });
  });

  describe('Enemy Interactions', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should defeat enemy when hit from above', () => {
      const initialScore = game.getScore();

      game.hitEnemy('Goomba', true);

      expect(game.getScore()).toBeGreaterThan(initialScore);

      const enemies = game.getEnemies();
      const goomba = enemies.find((e) => e.type === 'Goomba');
      expect(goomba?.defeated).toBe(true);
    });

    it('should take damage when hit from side (small Mario)', () => {
      const initialLives = game.getLives();

      game.hitEnemy('Goomba', false);

      expect(game.getLives()).toBe(initialLives - 1);
    });

    it('should downgrade power-up when hit from side (big Mario)', () => {
      game.collectPowerUp('mushroom');
      expect(game.getPlayerState()).toBe('big');

      game.hitEnemy('Goomba', false);

      expect(game.getPlayerState()).toBe('small');
      expect(game.getLives()).toBe(3); // Lives unchanged
    });

    it('should not take damage when invincible', () => {
      game.collectPowerUp('star');
      const initialLives = game.getLives();

      game.hitEnemy('Goomba', false);

      expect(game.getLives()).toBe(initialLives);
      expect(game.getPlayerState()).toBe('invincible');
    });

    it('should throw error when hitting non-existent enemy', () => {
      expect(() => game.hitEnemy('Bowser', true)).toThrow(
        "Enemy 'Bowser' not found or already defeated"
      );
    });

    it('should throw error when hitting already defeated enemy', () => {
      game.hitEnemy('Goomba', true);
      expect(() => game.hitEnemy('Goomba', true)).toThrow(
        "Enemy 'Goomba' not found or already defeated"
      );
    });

    it('should throw error with empty enemy type', () => {
      expect(() => game.hitEnemy('', true)).toThrow('Enemy type cannot be empty');
      expect(() => game.hitEnemy('   ', true)).toThrow('Enemy type cannot be empty');
    });

    it('should throw error when hitting enemy while not playing', () => {
      game.pause();
      expect(() => game.hitEnemy('Goomba', true)).toThrow(
        'Cannot hit enemy: Game is not in playing state'
      );
    });

    it('should award correct points for different enemy types', () => {
      const initialScore = game.getScore();

      game.hitEnemy('Goomba', true); // 100 points
      const scoreAfterGoomba = game.getScore();
      expect(scoreAfterGoomba).toBe(initialScore + 100);

      game.hitEnemy('Koopa', true); // 200 points
      const scoreAfterKoopa = game.getScore();
      expect(scoreAfterKoopa).toBe(scoreAfterGoomba + 200);

      game.hitEnemy('Piranha Plant', true); // 300 points
      const scoreAfterPiranha = game.getScore();
      expect(scoreAfterPiranha).toBe(scoreAfterKoopa + 300);
    });

    it('should end game when all lives are lost', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 1 });
      game.startLevel(1);

      game.hitEnemy('Goomba', false);

      expect(game.isGameOver()).toBe(true);
      expect(game.getGameState()).toBe('gameOver');
    });
  });

  describe('Power-ups', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should collect mushroom and grow to big', () => {
      expect(game.getPlayerState()).toBe('small');

      game.collectPowerUp('mushroom');

      expect(game.getPlayerState()).toBe('big');
      expect(game.getScore()).toBe(1000);
    });

    it('should collect fire flower', () => {
      game.collectPowerUp('fireFlower');

      expect(game.getPlayerState()).toBe('fire');
      expect(game.getScore()).toBe(1000);
    });

    it('should collect star and become invincible', () => {
      game.collectPowerUp('star');

      expect(game.getPlayerState()).toBe('invincible');
      expect(game.getScore()).toBe(1000);
    });

    it('should not grow further when already big and collecting mushroom', () => {
      game.collectPowerUp('mushroom');
      const scoreAfterFirst = game.getScore();
      expect(game.getPlayerState()).toBe('big');

      game.collectPowerUp('mushroom');

      // Should still be big, but score increases
      expect(game.getPlayerState()).toBe('big');
      expect(game.getScore()).toBe(scoreAfterFirst + 1000);
    });

    it('should throw error with invalid power-up type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => game.collectPowerUp('invalid' as any)).toThrow('Invalid power-up type: invalid');
    });

    it('should throw error when collecting power-up while not playing', () => {
      game.pause();
      expect(() => game.collectPowerUp('mushroom')).toThrow(
        'Cannot collect power-up: Game is not in playing state'
      );
    });

    it('should downgrade fire Mario to small when hit', () => {
      game.collectPowerUp('fireFlower');
      expect(game.getPlayerState()).toBe('fire');

      game.hitEnemy('Goomba', false);

      expect(game.getPlayerState()).toBe('small');
    });
  });

  describe('Game State Management', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
    });

    it('should start in idle state', () => {
      expect(game.getGameState()).toBe('idle');
    });

    it('should transition to playing when level starts', () => {
      game.startLevel(1);
      expect(game.getGameState()).toBe('playing');
    });

    it('should pause the game', () => {
      game.startLevel(1);
      game.pause();

      expect(game.getGameState()).toBe('paused');
    });

    it('should resume the game', () => {
      game.startLevel(1);
      game.pause();
      game.resume();

      expect(game.getGameState()).toBe('playing');
    });

    it('should throw error when pausing while not playing', () => {
      expect(() => game.pause()).toThrow('Cannot pause: Game is not in playing state');
    });

    it('should throw error when resuming while not paused', () => {
      game.startLevel(1);
      expect(() => game.resume()).toThrow('Cannot resume: Game is not paused');
    });

    it('should transition to completed when level is complete', () => {
      game.startLevel(1);
      game.completeLevel();

      expect(game.getGameState()).toBe('completed');
    });

    it('should transition to gameOver when lives reach zero', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 1 });
      game.startLevel(1);
      game.hitEnemy('Goomba', false);

      expect(game.getGameState()).toBe('gameOver');
      expect(game.isGameOver()).toBe(true);
    });
  });

  describe('Game Reset', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);
    });

    it('should reset game to initial state', () => {
      // Play some game
      game.collectCoin();
      game.movePlayer(50);
      game.jump();
      game.collectPowerUp('mushroom');

      // Reset
      game.reset();

      expect(game.getScore()).toBe(0);
      expect(game.getCoins()).toBe(0);
      expect(game.getCurrentLevel()).toBe(1);
      expect(game.getGameState()).toBe('idle');
      expect(game.getLives()).toBe(3);
      expect(game.getPlayerState()).toBe('small');
      expect(game.getPlayerPosition()).toBe(0);
      expect(game.isPlayerJumping()).toBe(false);
      expect(game.isLevelComplete()).toBe(false);
      expect(game.getEnemies().length).toBe(0);
    });

    it('should allow starting new game after reset', () => {
      game.completeLevel();
      game.reset();

      expect(() => game.startLevel(1)).not.toThrow();
      expect(game.getGameState()).toBe('playing');
    });
  });

  describe('Getters and State Queries', () => {
    let game: MarioGame;

    beforeEach(() => {
      game = new MarioGame({ playerName: 'Mario', lives: 5, startLevel: 2 });
    });

    it('should return correct score', () => {
      game.startLevel(1);
      game.collectCoin();
      expect(game.getScore()).toBe(10);
    });

    it('should return correct coins count', () => {
      game.startLevel(1);
      game.collectCoin();
      game.collectCoin();
      expect(game.getCoins()).toBe(2);
    });

    it('should return correct lives count', () => {
      expect(game.getLives()).toBe(5);
    });

    it('should return correct current level', () => {
      expect(game.getCurrentLevel()).toBe(2);
    });

    it('should return correct game state', () => {
      expect(game.getGameState()).toBe('idle');
      game.startLevel(1);
      expect(game.getGameState()).toBe('playing');
    });

    it('should return correct player state', () => {
      expect(game.getPlayerState()).toBe('small');
      game.startLevel(1);
      game.collectPowerUp('mushroom');
      expect(game.getPlayerState()).toBe('big');
    });

    it('should return copy of enemies array', () => {
      game.startLevel(1);
      const enemies1 = game.getEnemies();
      const enemies2 = game.getEnemies();

      expect(enemies1).not.toBe(enemies2); // Different references
      expect(enemies1).toEqual(enemies2); // Same content
    });

    it('should not allow external modification of enemies', () => {
      game.startLevel(1);
      const enemies = game.getEnemies();
      enemies[0].defeated = true;

      const freshEnemies = game.getEnemies();
      expect(freshEnemies[0].defeated).toBe(false);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle rapid state transitions', () => {
      const game = new MarioGame({ playerName: 'Mario' });

      game.startLevel(1);
      game.pause();
      game.resume();
      game.pause();
      game.resume();

      expect(game.getGameState()).toBe('playing');
    });

    it('should handle collecting 100 coins exactly', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 1 });
      game.startLevel(1);

      for (let i = 0; i < 100; i++) {
        game.collectCoin();
      }

      expect(game.getCoins()).toBe(100);
      expect(game.getLives()).toBe(2);
    });

    it('should handle multiple level completions', () => {
      const game = new MarioGame({ playerName: 'Mario' });

      game.startLevel(1);
      game.completeLevel();

      game.startLevel(2);
      game.completeLevel();

      expect(game.getCurrentLevel()).toBe(2);
      expect(game.getScore()).toBe(10000); // 5000 * 2
    });

    it('should handle defeating all enemies in a level', () => {
      const game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);

      const enemies = game.getEnemies();
      enemies.forEach((enemy) => {
        game.hitEnemy(enemy.type, true);
      });

      const remainingEnemies = game.getEnemies().filter((e) => !e.defeated);
      expect(remainingEnemies.length).toBe(0);
    });

    it('should maintain correct state after multiple power-up transitions', () => {
      const game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);

      game.collectPowerUp('mushroom');
      expect(game.getPlayerState()).toBe('big');

      game.collectPowerUp('fireFlower');
      expect(game.getPlayerState()).toBe('fire');

      game.hitEnemy('Goomba', false);
      expect(game.getPlayerState()).toBe('small');

      game.collectPowerUp('star');
      expect(game.getPlayerState()).toBe('invincible');
    });

    it('should handle boundary case of zero lives', () => {
      const game = new MarioGame({ playerName: 'Mario', lives: 0 });
      expect(game.getLives()).toBe(0);
      expect(game.isGameOver()).toBe(false); // Not over until they start and lose
    });

    it('should handle large position values', () => {
      const game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);

      game.movePlayer(10000);
      expect(game.getPlayerPosition()).toBe(10000);

      game.movePlayer(10000);
      expect(game.getPlayerPosition()).toBe(20000);
    });

    it('should handle jump and land cycle multiple times', () => {
      const game = new MarioGame({ playerName: 'Mario' });
      game.startLevel(1);

      for (let i = 0; i < 5; i++) {
        game.jump();
        expect(game.isPlayerJumping()).toBe(true);
        game.land();
        expect(game.isPlayerJumping()).toBe(false);
      }
    });
  });
});
