import { Module, Global } from '@nestjs/common';
import { db, pool, schema } from './index';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useValue: db,
    },
    {
      provide: PG_POOL,
      useValue: pool,
    },
    {
      provide: 'SCHEMA',
      useValue: schema,
    },
  ],
  exports: [DRIZZLE_DB, PG_POOL, 'SCHEMA'],
})
export class DatabaseModule {}
