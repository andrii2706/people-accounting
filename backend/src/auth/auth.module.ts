import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from '../common/auth.js';
import { loadEnv } from '../config/env.js';
import { User } from '../users/user.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { SessionService } from './session.service.js';

@Global()
@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      useFactory: () => ({ secret: loadEnv().jwtSecret, signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } }),
    }),
    // загальний ліміт запитів; для /auth/login — суворіший (див. @Throttle у контролері)
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      errorMessage: 'Забагато спроб. Зачекайте хвилину й спробуйте знову.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    SessionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtModule, SessionService],
})
export class AuthModule {}
