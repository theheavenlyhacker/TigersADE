import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { CLOCK, SystemClock } from './clock';

@Module({
  imports: [DbModule],
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class AppModule {}
