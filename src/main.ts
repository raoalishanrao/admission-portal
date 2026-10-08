import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const defaultCorsOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];
  const envCorsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...defaultCorsOrigins, ...envCorsOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser / same-origin tools send no Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      try {
        const host = new URL(origin).hostname;
        // Allow local Vite and ngrok tunnels used for phone/QR testing.
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host.endsWith('.ngrok-free.app') ||
          host.endsWith('.ngrok.app') ||
          host.endsWith('.ngrok.io')
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // fall through
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
  });

  const storageDriver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (!['s3', 'minio', 'b2', 'backblaze'].includes(storageDriver)) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/media/',
    });
  }

  // Older admit-card QR codes point at the API host (/attendance/qr/:token).
  // Send scanners to the admin portal attendance page.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/attendance/qr/:qrToken', (req: { params: { qrToken: string } }, res: { redirect: (code: number, url: string) => void }) => {
    const base = (
      process.env.F006_ATTENDANCE_PAGE_URL ??
      'http://localhost:5173/attendance/qr'
    ).replace(/\/$/, ''); // admin Vite default
    res.redirect(302, `${base}/${encodeURIComponent(req.params.qrToken)}`);
  });

  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) => {
        const collect = (list: typeof errors, prefix = ''): string[] =>
          list.flatMap((error) => {
            const path = prefix
              ? `${prefix}.${error.property}`
              : error.property;
            const own = error.constraints
              ? Object.values(error.constraints).map((m) => `${path}: ${m}`)
              : [];
            const nested = error.children?.length
              ? collect(error.children, path)
              : [];
            return [...own, ...nested];
          });
        const messages = collect(errors);
        return new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: messages.length > 0 ? messages : ['Validation failed'],
        });
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Admission Portal API')
    .setDescription(
      'ADM-F000 Admissions Intake & Offering Management, ADM-F001 applicant registration, ADM-F002 application completion, and ADM-F003 processing-fee payment APIs. ' +
        'Admin endpoints require `Authorization: Bearer <OAuth access token>` from `POST /auth/login`. ' +
        'Tenant is always `DEFAULT_TENANT_ID`; user id comes from the JWT `sub` claim. ' +
        'Applicant admissions catalogue reads are public. Applicant application and payment routes require the applicant JWT and enforce application ownership.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('Auth', 'IAM login bridge (password → OAuth JWT)')
    .addTag('Intake', 'Intake session configuration and application windows')
    .addTag('Programme Offering', 'Programme offerings within an intake')
    .addTag(
      'Admission Criteria',
      'Applicant-facing admission criteria on offerings',
    )
    .addTag('Fee Configuration', 'Offering fee configuration')
    .addTag(
      'Supporting Information',
      'Applicant-facing supporting information on offerings',
    )
    .addTag('General Criteria', 'Reusable admission criteria master records')
    .addTag('General Fees', 'Reusable programme fee master records')
    .addTag(
      'General Declarations',
      'Reusable institution-wide declaration masters',
    )
    .addTag(
      'Offering Declarations',
      'Offering-specific declaration configuration',
    )
    .addTag(
      'Intake Review & Publication',
      'Submit, review, publish, return, and close intakes',
    )
    .addTag(
      'Applicant Admissions',
      'Public published intake/offering reads and application handoff',
    )
    .addTag(
      'Applicant Registration',
      'Applicant registration, verification, and password setup',
    )
    .addTag(
      'Applicants Applications',
      'Application completion steps, uploads, and submission',
    )
    .addTag(
      'Applicant Processing Fee',
      'Applicant processing-fee challan, evidence and online payment APIs',
    )
    .addTag(
      'Processing Fee Administration',
      'Admissions payment verification and designated-bank configuration',
    )
    .addTag(
      'Bank Reconciliation',
      'Bank CSV imports matching processing-fee and offer-fee challans, plus exception resolution',
    )
    .addTag(
      'Offer Fee (Admission Challan)',
      'Post-offer admission fee challan, evidence verification, expire unpaid and promote waitlist',
    )
    .addTag(
      'Applicant Offer Fee',
      'Applicant view of admission/offer fee challan and evidence upload',
    )
    .addTag('Departments', 'Academic department master data')
    .addTag('Programmes', 'Programme master data')
    .addTag('Criteria Types', 'Criteria-type catalogue')
    .addTag('Fee Types', 'Fee-type catalogue')
    .addTag('Declaration Types', 'Declaration-type catalogue')
    .addTag(
      'Academic Level Requirements',
      'Required academic degree_type codes by programme degree level (e.g. Bachelor → MATRIC + FSC)',
    )
    .addTag(
      'Merit Formulas',
      'Weighted merit calculation templates (e.g. Matric 10% + FSC 45% + Entry test 45%) and offering overrides',
    )
    .addTag('Health', 'Service health')
    .addTag('Selection, Results & Admission Offers', 'ADM-F007 result processing, coordinated allocation and offers')
    .addTag('Applicant Results & Offer', 'Applicant result and offer reads')
    .addTag('F008 Internal Offer Events', 'Authenticated internal offer-response events')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Preserve DocumentBuilder / controller order (application step sequence).
  // 'alpha' sorts by path and breaks academic → programme → profile → …
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: () => 0,
      operationsSorter: () => 0,
    },
  });

  const port = config.get<number>('port', 3000);
  await app.listen(port);
}

await bootstrap();
