/**
 * App7 - Ordenar Números
 * Simple app demonstrating sorting animation
 * No audio, visual only
 */

// State management
const state = {
  isOrdered: false,
  animating: false,
  balls: [] // Array of ball elements
};

// DOM elements
let ballsContainer = null;
let actionButton = null;

/**
 * Initialize the app
 */
function initApp() {
  const main = document.querySelector('main');

  // Create balls container
  ballsContainer = document.createElement('div');
  ballsContainer.className = 'balls-container';
  main.appendChild(ballsContainer);

  // Create action button
  actionButton = document.createElement('button');
  actionButton.className = 'action-button';
  actionButton.textContent = 'Ordenar';
  actionButton.addEventListener('click', handleActionClick);
  main.appendChild(actionButton);

  // Create balls with random positions
  createBalls();
}

/**
 * Check if two circles overlap more than maxOverlap percentage
 */
function checkCollision(x1, y1, x2, y2, radius, maxOverlap = 0.15) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Minimum distance to have maxOverlap or less overlap
  // If maxOverlap = 0.15 (15%), balls can touch up to 15% of radius
  const minDistance = 2 * radius * (1 - maxOverlap);

  return distance < minDistance;
}

/**
 * Generate random position that doesn't overlap more than 15% with existing balls
 */
function generateNonOverlappingPosition(existingPositions, containerWidth, containerHeight, ballSize, margin, maxAttempts = 50) {
  const radius = ballSize / 2;
  const maxX = containerWidth - ballSize - margin;
  const maxY = containerHeight - ballSize - margin;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomX = margin + Math.random() * maxX;
    const randomY = margin + Math.random() * maxY;

    // Check collision with all existing balls
    const centerX = randomX + radius;
    const centerY = randomY + radius;

    let hasCollision = false;
    for (const pos of existingPositions) {
      if (checkCollision(centerX, centerY, pos.x, pos.y, radius, 0.15)) {
        hasCollision = true;
        break;
      }
    }

    if (!hasCollision) {
      return { x: randomX, y: randomY, centerX, centerY };
    }
  }

  // If we can't find a position without collision after maxAttempts, return a random one anyway
  const randomX = margin + Math.random() * maxX;
  const randomY = margin + Math.random() * maxY;
  return { x: randomX, y: randomY, centerX: randomX + radius, centerY: randomY + radius };
}

/**
 * Create 9 balls with random positions (max 15% overlap)
 */
function createBalls() {
  state.balls = [];
  ballsContainer.innerHTML = '';

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Get container dimensions
  const containerWidth = ballsContainer.offsetWidth || 800;
  const containerHeight = ballsContainer.offsetHeight || 120;

  // Determine ball size based on viewport width
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
  const ballSize = isMobile ? 40 : isTablet ? 50 : 60;
  const margin = 10;

  const positions = []; // Store center positions for collision detection

  numbers.forEach(num => {
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.textContent = num;
    ball.dataset.number = num;

    // Generate position with anti-collision
    const pos = generateNonOverlappingPosition(positions, containerWidth, containerHeight, ballSize, margin);

    ball.style.left = `${pos.x}px`;
    ball.style.top = `${pos.y}px`;

    // Store center position for future collision checks
    positions.push({ x: pos.centerX, y: pos.centerY });

    ballsContainer.appendChild(ball);
    state.balls.push(ball);
  });
}

/**
 * Handle action button click (Ordenar/Desordenar)
 */
async function handleActionClick() {
  if (state.animating) return;

  if (!state.isOrdered) {
    await orderBalls();
  } else {
    await disorderBalls();
  }
}

/**
 * Order balls in horizontal line with numbers
 */
async function orderBalls() {
  state.animating = true;
  actionButton.disabled = true;

  // Get container dimensions
  const containerWidth = ballsContainer.offsetWidth || 800;
  const containerHeight = ballsContainer.offsetHeight || 120;

  // Determine ball size based on viewport width for better mobile support
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
  const ballSize = isMobile ? 40 : isTablet ? 50 : 60;

  // Calculate positions for ordered layout (horizontal line near top)
  const spacing = Math.min((containerWidth - ballSize * 2) / 8, isMobile ? 42 : isTablet ? 52 : 80);
  const totalWidth = 8 * spacing; // Width occupied by 9 balls
  const startX = (containerWidth - totalWidth) / 2; // Center horizontally
  const lineY = 30; // Gray line position
  const targetY = lineY - (ballSize / 2); // Center balls on the line

  // Sort balls by number and animate to ordered positions
  const sortedBalls = [...state.balls].sort((a, b) => {
    return parseInt(a.dataset.number) - parseInt(b.dataset.number);
  });

  sortedBalls.forEach((ball, index) => {
    const targetX = startX + index * spacing;

    // Animate to target position
    requestAnimationFrame(() => {
      ball.style.left = `${targetX}px`;
      ball.style.top = `${targetY}px`;
      ball.classList.add('ordered');
    });
  });

  // Wait for animation to complete
  await new Promise(resolve => setTimeout(resolve, 900));

  state.isOrdered = true;
  state.animating = false;
  actionButton.disabled = false;
  actionButton.textContent = 'Desordenar';
}

/**
 * Disorder balls back to random positions (with max 15% overlap)
 */
async function disorderBalls() {
  state.animating = true;
  actionButton.disabled = true;

  // Get container dimensions
  const containerWidth = ballsContainer.offsetWidth || 800;
  const containerHeight = ballsContainer.offsetHeight || 120;

  // Determine ball size based on viewport width
  const isMobile = window.innerWidth <= 480;
  const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
  const ballSize = isMobile ? 40 : isTablet ? 50 : 60;
  const margin = 10;

  const positions = []; // Store center positions for collision detection

  // Generate new random positions for each ball with anti-collision
  state.balls.forEach(ball => {
    const pos = generateNonOverlappingPosition(positions, containerWidth, containerHeight, ballSize, margin);

    // Store center position for future collision checks
    positions.push({ x: pos.centerX, y: pos.centerY });

    // Animate to random position
    requestAnimationFrame(() => {
      ball.style.left = `${pos.x}px`;
      ball.style.top = `${pos.y}px`;
      ball.classList.remove('ordered');
    });
  });

  // Wait for animation to complete
  await new Promise(resolve => setTimeout(resolve, 900));

  state.isOrdered = false;
  state.animating = false;
  actionButton.disabled = false;
  actionButton.textContent = 'Ordenar';
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
