/**
 * Goal & Constraints:
 * Schema/taxonomy/classifier upgrades keep old observations replayable via
 * representation migrations—not individual fact corrections.
 */

/**
 * @typedef {object} RepresentationMigration
 * @property {string} from_version
 * @property {string} to_version
 * @property {string} family_id
 * @property {(observation: object) => object} migrate
 */

/** @type {Map<string, RepresentationMigration[]>} */
const migrationsByFamily = new Map();

/**
 * Clears registered migrations (tests).
 * @returns {void}
 */
export function clearRepresentationMigrations() {
  migrationsByFamily.clear();
}

/**
 * Registers a representation migration for a family.
 * @param {RepresentationMigration} migration
 * @returns {void}
 */
export function registerRepresentationMigration(migration) {
  if (
    !migration?.family_id ||
    !migration.from_version ||
    !migration.to_version
  ) {
    throw new Error("migration requires family_id, from_version, to_version");
  }
  if (typeof migration.migrate !== "function") {
    throw new Error("migration requires migrate()");
  }
  const list = migrationsByFamily.get(migration.family_id) || [];
  list.push(migration);
  migrationsByFamily.set(migration.family_id, list);
}

/**
 * Migrates an observation payload forward to a target schema version.
 * @param {object} observation
 * @param {{ family_id: string, target_version: string }} options
 * @returns {object}
 */
export function migrateObservationRepresentation(observation, options) {
  const familyId = String(options.family_id || "");
  const target = String(options.target_version || "");
  let current = { ...observation };
  let version = String(current.schema_version || current.schemaVersion || "1");
  const chain = migrationsByFamily.get(familyId) || [];
  const guard = new Set();
  while (version !== target) {
    const step =
      chain.find(
        (entry) =>
          entry.from_version === version && entry.to_version === target,
      ) || chain.find((entry) => entry.from_version === version);
    if (!step) {
      throw new Error(
        `no migration path for ${familyId} from ${version} to ${target}`,
      );
    }
    const key = `${step.from_version}->${step.to_version}`;
    if (guard.has(key)) {
      throw new Error(`migration cycle for ${familyId}: ${key}`);
    }
    guard.add(key);
    current = step.migrate(current);
    version = step.to_version;
    current.schema_version = version;
  }
  return current;
}

/**
 * Default Uses evidence schema bump: rename legacy source_body_hash alias.
 * @returns {void}
 */
export function registerDefaultUsesMigrations() {
  registerRepresentationMigration({
    family_id: "uses",
    from_version: "1",
    to_version: "2",
    migrate(observation) {
      const next = { ...observation };
      if (next.source_body_hash && !next.source_hash) {
        next.source_hash = next.source_body_hash;
      }
      return next;
    },
  });
}
