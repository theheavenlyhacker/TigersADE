import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { CLOCK, SystemClock } from './clock';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DbModule, AuthModule],
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class AppModule {}
