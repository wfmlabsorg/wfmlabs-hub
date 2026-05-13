import * as migration_20260510_150350_initial from './20260510_150350_initial';
import * as migration_20260510_184114_add_all_collections from './20260510_184114_add_all_collections';
import * as migration_20260512_115656_profile_redesign from './20260512_115656_profile_redesign';
import * as migration_20260513_175112_add_briefs_collection from './20260513_175112_add_briefs_collection';

export const migrations = [
  {
    up: migration_20260510_150350_initial.up,
    down: migration_20260510_150350_initial.down,
    name: '20260510_150350_initial',
  },
  {
    up: migration_20260510_184114_add_all_collections.up,
    down: migration_20260510_184114_add_all_collections.down,
    name: '20260510_184114_add_all_collections',
  },
  {
    up: migration_20260512_115656_profile_redesign.up,
    down: migration_20260512_115656_profile_redesign.down,
    name: '20260512_115656_profile_redesign',
  },
  {
    up: migration_20260513_175112_add_briefs_collection.up,
    down: migration_20260513_175112_add_briefs_collection.down,
    name: '20260513_175112_add_briefs_collection'
  },
];
