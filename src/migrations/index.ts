import * as migration_20260510_150350_initial from './20260510_150350_initial';
import * as migration_20260510_184114_add_all_collections from './20260510_184114_add_all_collections';

export const migrations = [
  {
    up: migration_20260510_150350_initial.up,
    down: migration_20260510_150350_initial.down,
    name: '20260510_150350_initial',
  },
  {
    up: migration_20260510_184114_add_all_collections.up,
    down: migration_20260510_184114_add_all_collections.down,
    name: '20260510_184114_add_all_collections'
  },
];
