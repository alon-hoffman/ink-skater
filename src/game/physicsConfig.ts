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
    restitution: 0.02,
  },
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
  maxSpeed: 1800,

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
    /** Weight of the contact normal against the board's up vector. */
    normalWeight: 0.65,
    cooldownSeconds: 0.15,
  },
  /**
   * Grounded alignment assist (only while no tilt is held): eases the deck toward the surface normal so
   * the board follows curves, walls and ceilings instead of peeling off one wheel. Zero in the air.
   */
  groundAlign: { acceleration: 700, damping: 0.25, maxAngularSpeed: 22 },
  /** Extra pull into non-floor surfaces (walls, ceilings) while moving fast; see Simulation.applyGrip. */
  grip: { acceleration: 4500, minSpeed: 120, rampSpeed: 150, maxFloorNormalY: -0.5 },
  /** Ticks a wheel stays "grounded" after its last contact (anti-flicker). */
  contactGraceTicks: 1,

  head: { radius: 7 },
  deathMargin: 700,
  /** Ticks after a reset during which head contact cannot kill (avoids spawn-overlap loops). */
  spawnImmunityTicks: 20,
  deathFlashSeconds: 0.15,
} as const;
