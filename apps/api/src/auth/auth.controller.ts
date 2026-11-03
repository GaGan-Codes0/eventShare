import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@eventshare/shared';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService } from './auth.service.js';

/** Public routes. Rate-limited per IP to slow down password guessing. */
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body(new ZodPipe(signupSchema)) body: SignupInput) {
    return this.auth.signup(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }
}
