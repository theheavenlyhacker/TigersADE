import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export function setupApiDocs(app: import('@nestjs/common').INestApplication) {
  if (process.env.NODE_ENV === 'production') return;
  const config = new DocumentBuilder()
    .setTitle('Tigers ADE API')
    .setDescription('API for Tigers café Access Data Environment')
    .setVersion('1.0')
    .addCookieAuth('ade_session')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  setupApiDocs(app);
  return app;
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4000);
}
if (require.main === module) void bootstrap();
