/** All tunable physics constants live here. Distances in world px, speeds in px/s, angles in rad. */
export const PHYSICS = {
  stepSeconds: 1 / 60,
  substeps: 4,
  maxCatchUpSteps: 5,
  /** Gravity in px/s^2. */
  gravity: 1800,

  board: { length: 64, thickness: 6, mass: 2, inertia: 1200, friction: 0.25 },
  wheel: {
    radius: 9,
    offsetX: 24,
    offsetY: 11,
    mass: 2,
    friction: 0.9,
    frictionStatic: 0.6,
    restitution: 0.00,
  },
  /**
   * Rider body: a non-colliding mass held rigidly above the deck so the centre of mass sits over the board
   * instead of on it. Higher/heavier = tips over and over-rotates more easily. Mass 0 disables it.
   */
  rider: { mass: 3.5, height: 15, halfWidth: 8 },
  terrain: { halfThickness: 3.5, friction: 0.9, columnWidth: 400, activeColumns: 2 },

  /** Grounded propulsion: acceleration (px/s^2) that fades out as speed nears `cruiseSpeed`. */
  propulsion: 760,
  cruiseSpeed: 330,
  /**
   * Net fraction of velocity lost per tick while a wheel touches terrain. Slightly negative on purpose:
   * it cancels the energy Matter's solver bleeds off a rolling wheel, leaving a small net drag.
   */
  rollingResistance: -0.001,
  /** Speed cap in px/s; keeps collisions stable. */
  maxSpeed: 2000,

  /** Tilt angular acceleration (rad/s^2) and angular speed cap (rad/s). */
  tiltAcceleration: 18,
  /** Stronger tilt while a wheel is down: has to beat the weight to lift the other wheel. */
  groundTiltAcceleration: 80,
  groundMaxAngularSpeed: 3,
  maxAngularSpeed: 10,
  /** Per-tick angular velocity damping on the ground (air has none: angular momentum persists). */
  groundAngularDamping: 0.015,
  airAngularDamping: 0,

  jump: {
    maxChargeSeconds: 0.7,
    minSpeed: 360,
    maxSpeed: 780,
    /** Weight of world-up against the contact normal in the jump direction (1 - this goes to the normal). */
    worldUpWeight: 0.7,
    cooldownSeconds: 0.10,
  },
  /** Ticks a wheel stays "grounded" after its last contact (anti-flicker). */
  contactGraceTicks: 1,

  head: { radius: 7 },
  deathMargin: 700,
  /** Ticks after a reset during which head contact cannot kill (avoids spawn-overlap loops). */
  spawnImmunityTicks: 20,
  deathFlashSeconds: 0.15,
} as const;
