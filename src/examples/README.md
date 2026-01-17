# MarioGame Module

A comprehensive example module demonstrating best practices for documentation, testing, and TypeScript implementation in the CiKnight project.

## Overview

The `MarioGame` module is a simplified Mario-style game implementation that showcases:

- **Complete JSDoc documentation** for all classes, methods, and types
- **Comprehensive unit tests** with 100% line coverage and 98.52% branch coverage
- **TypeScript type safety** with proper interfaces and type annotations
- **Input validation** and error handling
- **State management** patterns
- **Usage examples** in documentation

## Features

- Player movement and jumping mechanics
- Enemy interactions (defeat enemies or take damage)
- Power-up system (mushroom, fire flower, star)
- Coin collection with extra life rewards
- Level progression and completion
- Score tracking
- Game state management (idle, playing, paused, completed, gameOver)
- Comprehensive error handling

## Installation

The module is located at `src/examples/MarioGame.ts` and can be imported as:

```typescript
import { MarioGame } from './src/examples/MarioGame';
```

## Basic Usage

### Creating a Game

```typescript
import { MarioGame } from './src/examples/MarioGame';

// Create a new game instance
const game = new MarioGame({
  playerName: 'Mario',
  lives: 3,
  startLevel: 1,
});
```

### Starting a Level

```typescript
// Start level 1
game.startLevel(1);
console.log(game.getGameState()); // 'playing'
```

### Player Movement

```typescript
// Move player right
game.movePlayer(10);

// Move player left
game.movePlayer(-5);

// Jump
game.jump();

// Land after jump
game.land();
```

### Collecting Items

```typescript
// Collect a coin (+10 points, +1 coin)
game.collectCoin();

// Collect power-ups
game.collectPowerUp('mushroom');    // Grow to big Mario
game.collectPowerUp('fireFlower');  // Become fire Mario
game.collectPowerUp('star');        // Become invincible
```

### Enemy Interactions

```typescript
// Defeat enemy by jumping on it (awards points)
game.hitEnemy('Goomba', true);

// Hit enemy from side (takes damage)
game.hitEnemy('Koopa', false);
```

### Checking Game State

```typescript
// Check various game properties
console.log(game.getScore());           // Current score
console.log(game.getCoins());           // Number of coins collected
console.log(game.getLives());           // Remaining lives
console.log(game.getCurrentLevel());    // Current level number
console.log(game.getPlayerState());     // Player state (small, big, fire, invincible)
console.log(game.isGameOver());         // Whether game is over
console.log(game.isLevelComplete());    // Whether level is complete
```

### Level Completion

```typescript
// Complete the current level
game.completeLevel();

// Start next level
if (game.isLevelComplete()) {
  game.startLevel(game.getCurrentLevel() + 1);
}
```

### Pause and Resume

```typescript
// Pause the game
game.pause();

// Resume the game
game.resume();
```

### Reset Game

```typescript
// Reset game to initial state
game.reset();
```

## Complete Example

Here's a complete example showing typical gameplay:

```typescript
import { MarioGame } from './src/examples/MarioGame';

// Create game
const game = new MarioGame({ playerName: 'Mario', lives: 3 });

// Start level 1
game.startLevel(1);

// Play through the level
game.movePlayer(10);
game.collectCoin();
game.collectCoin();
console.log(`Score: ${game.getScore()}`); // Score: 20

// Collect power-up
game.collectPowerUp('mushroom');
console.log(`Player state: ${game.getPlayerState()}`); // Player state: big

// Jump on enemy
game.jump();
game.hitEnemy('Goomba', true);
game.land();
console.log(`Score: ${game.getScore()}`); // Score increased by 100

// Complete level
game.completeLevel();
console.log(`Level complete! Final score: ${game.getScore()}`);

// Check if game over
if (!game.isGameOver()) {
  game.startLevel(2);
}
```

## API Reference

### Types

#### `GameConfig`
Configuration options for initializing a new game.

```typescript
interface GameConfig {
  playerName: string;     // The name of the player character
  lives?: number;         // Initial number of lives (default: 3)
  startLevel?: number;    // Starting level (default: 1)
}
```

#### `GameState`
Represents the possible states of the game.

```typescript
type GameState = 'idle' | 'playing' | 'paused' | 'completed' | 'gameOver';
```

#### `PlayerState`
Represents the possible states of the player.

```typescript
type PlayerState = 'small' | 'big' | 'fire' | 'invincible';
```

### Class Methods

#### Constructor

- `constructor(config: GameConfig)` - Creates a new MarioGame instance

#### Level Management

- `startLevel(levelNumber: number): void` - Starts a new level
- `completeLevel(): void` - Marks the current level as complete

#### Player Actions

- `movePlayer(distance: number): void` - Moves the player horizontally
- `jump(): void` - Makes the player jump
- `land(): void` - Lands the player after a jump

#### Item Collection

- `collectCoin(): void` - Collects a coin (+10 points, extra life every 100 coins)
- `collectPowerUp(powerUpType): void` - Collects a power-up (mushroom, fireFlower, or star)

#### Enemy Interactions

- `hitEnemy(enemyType: string, fromAbove: boolean): void` - Handles player-enemy collision

#### Game State

- `pause(): void` - Pauses the game
- `resume(): void` - Resumes the game
- `reset(): void` - Resets the game to initial state

#### Getters

- `getScore(): number` - Returns current score
- `getCoins(): number` - Returns number of coins collected
- `getLives(): number` - Returns remaining lives
- `getCurrentLevel(): number` - Returns current level number
- `getGameState(): GameState` - Returns current game state
- `getPlayerState(): PlayerState` - Returns player's power-up state
- `getPlayerPosition(): number` - Returns player's horizontal position
- `isPlayerJumping(): boolean` - Returns whether player is jumping
- `isLevelComplete(): boolean` - Returns whether current level is complete
- `isGameOver(): boolean` - Returns whether game is over
- `getEnemies(): Enemy[]` - Returns array of all enemies in current level

## Testing

### Running Tests

```bash
# Run MarioGame tests
npm test -- MarioGame.test.ts

# Run tests with coverage
npm run test:coverage -- MarioGame.test.ts
```

### Test Coverage

The MarioGame module has comprehensive test coverage:

- **Line Coverage**: 100%
- **Branch Coverage**: 98.52%
- **Function Coverage**: 100%
- **Statement Coverage**: 100%

### Test Categories

The test suite includes:

1. **Constructor and Initialization** - Tests for game creation and configuration
2. **Level Management** - Tests for starting levels, enemy initialization, and completion
3. **Player Movement** - Tests for horizontal movement and boundary conditions
4. **Jumping Mechanics** - Tests for jumping and landing
5. **Coin Collection** - Tests for coin collection and extra life rewards
6. **Enemy Interactions** - Tests for defeating enemies and taking damage
7. **Power-ups** - Tests for collecting and using power-ups
8. **Game State Management** - Tests for pause, resume, and state transitions
9. **Game Reset** - Tests for resetting game state
10. **Getters and State Queries** - Tests for all getter methods
11. **Edge Cases and Complex Scenarios** - Tests for boundary conditions and complex interactions

## Error Handling

The module includes comprehensive error handling:

- Invalid player names (empty or whitespace)
- Negative lives or invalid start levels
- Actions performed in wrong game states
- Invalid enemy types or power-ups
- Attempting to jump while already jumping
- Starting levels when game is over

All errors throw descriptive Error objects with clear messages.

## Design Patterns

The MarioGame module demonstrates several design patterns:

1. **Encapsulation** - Private methods and properties
2. **State Pattern** - Clear game state transitions
3. **Validation** - Input validation on all public methods
4. **Immutability** - Getters return copies to prevent external modification
5. **Single Responsibility** - Each method has a clear, focused purpose

## Best Practices Demonstrated

1. **Complete Documentation** - Every public method, type, and property is documented
2. **Usage Examples** - JSDoc includes practical usage examples
3. **Type Safety** - Full TypeScript type annotations
4. **Input Validation** - All inputs are validated with clear error messages
5. **Test Coverage** - Comprehensive test suite with >90% coverage
6. **Error Messages** - Clear, actionable error messages
7. **Immutability** - Data returned from getters cannot be modified externally
8. **Edge Cases** - Tests cover boundary conditions and edge cases

## Contributing

When modifying the MarioGame module:

1. Maintain 100% documentation coverage
2. Keep test coverage above 90%
3. Add tests for any new features
4. Update this README with any new functionality
5. Follow TypeScript and ESLint guidelines
6. Run linter and formatter before committing

## License

This module is part of the CiKnight project and follows the same MIT License.
