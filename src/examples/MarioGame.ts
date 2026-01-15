/**
 * MarioGame Module
 *
 * A simple Mario-style game implementation demonstrating player movement,
 * enemy interactions, scoring, and level completion mechanics.
 *
 * @example
 * ```typescript
 * // Create a new game instance
 * const game = new MarioGame({ playerName: 'Mario', lives: 3 });
 *
 * // Start playing
 * game.startLevel(1);
 * game.movePlayer(10); // Move player forward
 * game.jump();         // Make player jump
 *
 * // Interact with game elements
 * game.collectCoin();
 * game.hitEnemy('Goomba');
 *
 * // Check game state
 * console.log(game.getScore());    // Current score
 * console.log(game.isGameOver());  // Game over status
 * ```
 *
 * @module MarioGame
 */

/**
 * Represents the possible states of the game
 */
export type GameState = 'idle' | 'playing' | 'paused' | 'completed' | 'gameOver';

/**
 * Represents the possible states of the player
 */
export type PlayerState = 'small' | 'big' | 'fire' | 'invincible';

/**
 * Configuration options for initializing a new game
 */
export interface GameConfig {
  /** The name of the player character */
  playerName: string;
  /** Initial number of lives (must be positive, default: 3) */
  lives?: number;
  /** Starting level (must be positive, default: 1) */
  startLevel?: number;
}

/**
 * Represents a player in the Mario game
 */
export interface Player {
  /** Player's name */
  name: string;
  /** Current number of lives */
  lives: number;
  /** Current power-up state */
  state: PlayerState;
  /** Horizontal position on the screen */
  position: number;
  /** Vertical position (for jumping) */
  verticalPosition: number;
  /** Whether player is currently jumping */
  isJumping: boolean;
}

/**
 * Represents an enemy in the game
 */
export interface Enemy {
  /** Type of enemy (e.g., 'Goomba', 'Koopa', 'Piranha Plant') */
  type: string;
  /** Whether the enemy has been defeated */
  defeated: boolean;
  /** Points awarded for defeating this enemy */
  points: number;
}

/**
 * MarioGame class - Main game controller
 *
 * Manages the game state, player actions, scoring, and level progression.
 * This class demonstrates best practices for game logic implementation
 * including input validation, state management, and error handling.
 */
export class MarioGame {
  private player: Player;
  private score: number;
  private coins: number;
  private currentLevel: number;
  private gameState: GameState;
  private enemies: Enemy[];
  private levelComplete: boolean;
  private readonly initialConfig: GameConfig;

  // Enemy configuration lookup for maintainability
  private static readonly ENEMY_CONFIG: Record<string, number> = {
    Goomba: 100,
    Koopa: 200,
    'Piranha Plant': 300,
  };

  /**
   * Creates a new MarioGame instance
   *
   * @param config - Game configuration options
   * @throws {Error} If playerName is empty or invalid
   * @throws {Error} If lives or startLevel are negative
   *
   * @example
   * ```typescript
   * const game = new MarioGame({
   *   playerName: 'Mario',
   *   lives: 3,
   *   startLevel: 1
   * });
   * ```
   */
  constructor(config: GameConfig) {
    if (!config.playerName || config.playerName.trim() === '') {
      throw new Error('Player name cannot be empty');
    }

    const lives = config.lives ?? 3;
    const startLevel = config.startLevel ?? 1;

    if (lives < 0) {
      throw new Error('Lives cannot be negative');
    }

    if (startLevel < 1) {
      throw new Error('Start level must be at least 1');
    }

    // Store initial config for reset
    this.initialConfig = {
      playerName: config.playerName,
      lives,
      startLevel,
    };

    // Store initial config for reset
    this.initialConfig = {
      playerName: config.playerName,
      lives,
      startLevel,
    };

    this.player = {
      name: config.playerName,
      lives: lives,
      state: 'small',
      position: 0,
      verticalPosition: 0,
      isJumping: false,
    };

    this.score = 0;
    this.coins = 0;
    this.currentLevel = startLevel;
    this.gameState = 'idle';
    this.enemies = [];
    this.levelComplete = false;
  }

  /**
   * Starts a new level
   *
   * @param levelNumber - The level number to start (must be positive)
   * @throws {Error} If level number is invalid
   * @throws {Error} If game is already over
   *
   * @example
   * ```typescript
   * game.startLevel(1); // Start level 1
   * ```
   */
  public startLevel(levelNumber: number): void {
    if (levelNumber < 1) {
      throw new Error('Level number must be at least 1');
    }

    if (this.gameState === 'gameOver') {
      throw new Error('Cannot start level: Game is over');
    }

    this.currentLevel = levelNumber;
    this.gameState = 'playing';
    this.levelComplete = false;
    this.player.position = 0;
    this.player.verticalPosition = 0;
    this.player.isJumping = false;

    // Initialize enemies for the level
    this.initializeEnemies(levelNumber);
  }

  /**
   * Initializes enemies for a given level
   *
   * @param levelNumber - The level number
   * @private
   */
  private initializeEnemies(levelNumber: number): void {
    this.enemies = [];

    // Add enemies based on level difficulty
    const enemyCount = levelNumber + 2;
    const enemyTypes = Object.keys(MarioGame.ENEMY_CONFIG);

    for (let i = 0; i < enemyCount; i++) {
      const type = enemyTypes[i % enemyTypes.length];
      this.enemies.push({
        type,
        defeated: false,
        points: MarioGame.ENEMY_CONFIG[type],
      });
    }
  }

  /**
   * Moves the player horizontally
   *
   * @param distance - Distance to move (positive = right, negative = left)
   * @throws {Error} If game is not in playing state
   *
   * @example
   * ```typescript
   * game.movePlayer(10);  // Move right
   * game.movePlayer(-5);  // Move left
   * ```
   */
  public movePlayer(distance: number): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot move player: Game is not in playing state');
    }

    this.player.position += distance;

    // Prevent moving off the left edge
    if (this.player.position < 0) {
      this.player.position = 0;
    }
  }

  /**
   * Makes the player jump
   *
   * @throws {Error} If game is not in playing state
   * @throws {Error} If player is already jumping
   *
   * @example
   * ```typescript
   * game.jump(); // Player jumps
   * ```
   */
  public jump(): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot jump: Game is not in playing state');
    }

    if (this.player.isJumping) {
      throw new Error('Player is already jumping');
    }

    this.player.isJumping = true;
    this.player.verticalPosition = 5; // Jump height
  }

  /**
   * Lands the player after a jump
   *
   * @example
   * ```typescript
   * game.jump();
   * // ... jump animation ...
   * game.land(); // Player lands
   * ```
   */
  public land(): void {
    this.player.isJumping = false;
    this.player.verticalPosition = 0;
  }

  /**
   * Collects a coin, incrementing the coin counter and score
   *
   * @throws {Error} If game is not in playing state
   *
   * @example
   * ```typescript
   * game.collectCoin(); // +1 coin, +10 points
   * ```
   */
  public collectCoin(): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot collect coin: Game is not in playing state');
    }

    this.coins += 1;
    this.score += 10;

    // Extra life every 100 coins
    if (this.coins % 100 === 0) {
      this.player.lives += 1;
    }
  }

  /**
   * Handles interaction when player hits an enemy
   *
   * @param enemyType - Type of enemy hit (e.g., 'Goomba', 'Koopa')
   * @param fromAbove - Whether player hit enemy from above (jump attack)
   * @throws {Error} If game is not in playing state
   * @throws {Error} If enemy type is invalid
   *
   * @example
   * ```typescript
   * // Jump on enemy
   * game.hitEnemy('Goomba', true);  // Defeats enemy, awards points
   *
   * // Hit enemy from side
   * game.hitEnemy('Goomba', false); // Player takes damage
   * ```
   */
  public hitEnemy(enemyType: string, fromAbove: boolean = false): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot hit enemy: Game is not in playing state');
    }

    if (!enemyType || enemyType.trim() === '') {
      throw new Error('Enemy type cannot be empty');
    }

    const enemy = this.enemies.find((e) => e.type === enemyType && !e.defeated);

    if (!enemy) {
      throw new Error(`Enemy '${enemyType}' not found or already defeated`);
    }

    if (fromAbove) {
      // Player defeats enemy by jumping on it
      enemy.defeated = true;
      this.score += enemy.points;
    } else {
      // Player takes damage
      this.takeDamage();
    }
  }

  /**
   * Applies damage to the player
   *
   * Handles power-up downgrades and life loss. If player has no lives left,
   * game ends.
   *
   * @private
   *
   * @example
   * ```typescript
   * // Called internally when player takes damage
   * this.takeDamage();
   * ```
   */
  private takeDamage(): void {
    if (this.player.state === 'invincible') {
      return; // Invincible players don't take damage
    }

    if (this.player.state === 'fire' || this.player.state === 'big') {
      // Downgrade to small
      this.player.state = 'small';
    } else {
      // Lose a life
      this.player.lives -= 1;

      if (this.player.lives <= 0) {
        this.gameState = 'gameOver';
      }
    }
  }

  /**
   * Collects a power-up item
   *
   * @param powerUpType - Type of power-up ('mushroom', 'fireFlower', 'star')
   * @throws {Error} If game is not in playing state
   * @throws {Error} If power-up type is invalid
   *
   * @example
   * ```typescript
   * game.collectPowerUp('mushroom');    // Grow to big Mario
   * game.collectPowerUp('fireFlower');  // Become fire Mario
   * game.collectPowerUp('star');        // Become invincible
   * ```
   */
  public collectPowerUp(powerUpType: 'mushroom' | 'fireFlower' | 'star'): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot collect power-up: Game is not in playing state');
    }

    const validPowerUps = ['mushroom', 'fireFlower', 'star'];
    if (!validPowerUps.includes(powerUpType)) {
      throw new Error(`Invalid power-up type: ${powerUpType}`);
    }

    switch (powerUpType) {
      case 'mushroom':
        if (this.player.state === 'small') {
          this.player.state = 'big';
        }
        this.score += 1000;
        break;
      case 'fireFlower':
        this.player.state = 'fire';
        this.score += 1000;
        break;
      case 'star':
        this.player.state = 'invincible';
        this.score += 1000;
        // In a real game, invincibility would have a timer
        break;
    }
  }

  /**
   * Completes the current level
   *
   * @throws {Error} If game is not in playing state
   *
   * @example
   * ```typescript
   * game.completeLevel(); // Mark level as complete
   * ```
   */
  public completeLevel(): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot complete level: Game is not in playing state');
    }

    this.levelComplete = true;
    this.gameState = 'completed';
    this.score += 5000; // Bonus for completing level
  }

  /**
   * Pauses the game
   *
   * @throws {Error} If game is not in playing state
   *
   * @example
   * ```typescript
   * game.pause(); // Pause the game
   * ```
   */
  public pause(): void {
    if (this.gameState !== 'playing') {
      throw new Error('Cannot pause: Game is not in playing state');
    }

    this.gameState = 'paused';
  }

  /**
   * Resumes the game from paused state
   *
   * @throws {Error} If game is not paused
   *
   * @example
   * ```typescript
   * game.resume(); // Resume from pause
   * ```
   */
  public resume(): void {
    if (this.gameState !== 'paused') {
      throw new Error('Cannot resume: Game is not paused');
    }

    this.gameState = 'playing';
  }

  /**
   * Gets the current score
   *
   * @returns The current score
   *
   * @example
   * ```typescript
   * const score = game.getScore(); // Returns current score
   * ```
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * Gets the number of coins collected
   *
   * @returns The number of coins
   *
   * @example
   * ```typescript
   * const coins = game.getCoins(); // Returns coin count
   * ```
   */
  public getCoins(): number {
    return this.coins;
  }

  /**
   * Gets the player's current number of lives
   *
   * @returns The number of lives
   *
   * @example
   * ```typescript
   * const lives = game.getLives(); // Returns remaining lives
   * ```
   */
  public getLives(): number {
    return this.player.lives;
  }

  /**
   * Gets the current level number
   *
   * @returns The current level
   *
   * @example
   * ```typescript
   * const level = game.getCurrentLevel(); // Returns current level
   * ```
   */
  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Gets the current game state
   *
   * @returns The current game state
   *
   * @example
   * ```typescript
   * const state = game.getGameState(); // Returns 'playing', 'paused', etc.
   * ```
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Gets the player's current state
   *
   * @returns The player state
   *
   * @example
   * ```typescript
   * const playerState = game.getPlayerState(); // Returns 'small', 'big', etc.
   * ```
   */
  public getPlayerState(): PlayerState {
    return this.player.state;
  }

  /**
   * Gets the player's current position
   *
   * @returns The player position
   *
   * @example
   * ```typescript
   * const position = game.getPlayerPosition(); // Returns horizontal position
   * ```
   */
  public getPlayerPosition(): number {
    return this.player.position;
  }

  /**
   * Checks if the player is currently jumping
   *
   * @returns True if player is jumping, false otherwise
   *
   * @example
   * ```typescript
   * if (game.isPlayerJumping()) {
   *   console.log('Player is in the air!');
   * }
   * ```
   */
  public isPlayerJumping(): boolean {
    return this.player.isJumping;
  }

  /**
   * Checks if the current level is complete
   *
   * @returns True if level is complete, false otherwise
   *
   * @example
   * ```typescript
   * if (game.isLevelComplete()) {
   *   game.startLevel(game.getCurrentLevel() + 1);
   * }
   * ```
   */
  public isLevelComplete(): boolean {
    return this.levelComplete;
  }

  /**
   * Checks if the game is over
   *
   * @returns True if game is over, false otherwise
   *
   * @example
   * ```typescript
   * if (game.isGameOver()) {
   *   console.log('Game Over! Final score:', game.getScore());
   * }
   * ```
   */
  public isGameOver(): boolean {
    return this.gameState === 'gameOver';
  }

  /**
   * Gets all enemies in the current level
   *
   * @returns Array of enemies
   *
   * @example
   * ```typescript
   * const enemies = game.getEnemies();
   * const activeEnemies = enemies.filter(e => !e.defeated);
   * ```
   */
  public getEnemies(): Enemy[] {
    return this.enemies.map((enemy) => ({ ...enemy })); // Return deep copy to prevent external modification
  }

  /**
   * Resets the game to initial state
   *
   * @example
   * ```typescript
   * game.reset(); // Start fresh with original configuration
   * ```
   */
  public reset(): void {
    this.score = 0;
    this.coins = 0;
    this.currentLevel = this.initialConfig.startLevel ?? 1;
    this.gameState = 'idle';
    this.enemies = [];
    this.levelComplete = false;
    this.player.lives = this.initialConfig.lives ?? 3;
    this.player.state = 'small';
    this.player.position = 0;
    this.player.verticalPosition = 0;
    this.player.isJumping = false;
  }
}
