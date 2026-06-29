import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

const defaultCorsOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8100',
  'http://localhost:8081',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://freetiful.com',
  'https://www.freetiful.com',
];

function corsOrigins() {
  return Array.from(new Set([...(process.env.ALLOWED_ORIGINS?.split(',') ?? []), ...defaultCorsOrigins]));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Body parser — 파트너 신청 시 base64 사진 여러 장 업로드를 위해 큰 용량 허용
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve uploaded files statically
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // 업로드 이미지/영상은 공개 리소스 — CORP 기본값(same-origin)이면 타 출처(웹뷰/다른 도메인) <img>/<video>
  // 로딩이 차단됨(안드 채팅 미디어·홈 프로 이미지 안 뜨던 원인). 공개 정적 리소스라 cross-origin 허용.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  // /uploads/* 는 정적 자원처럼 서빙되므로 글로벌 prefix(api/v1) 에서 제외
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'uploads/(.*)', method: RequestMethod.ALL }] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Prettyful API')
    .setDescription('Prettyful platform API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Prettyful API running on port ${port}`);
}

bootstrap();
