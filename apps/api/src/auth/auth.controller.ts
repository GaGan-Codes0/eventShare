import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  appleSignInSchema,
  googleSignInSchema,
  loginSchema,
  signupSchema,
  type AppleSignInInput,
  type GoogleSignInInput,
  type LoginInput,
  type SignupInput,
} from '@eventshare/shared';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService } from './auth.service.js';

/** Public routes. Rate-limited per account to slow down password guessing (see AppModule). */
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

  @Post('apple')
  @HttpCode(200)
  apple(@Body(new ZodPipe(appleSignInSchema)) body: AppleSignInInput) {
    return this.auth.signInWithApple(body);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body(new ZodPipe(googleSignInSchema)) body: GoogleSignInInput) {
    return this.auth.signInWithGoogle(body);
  }
}
