import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  appleSignInSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type AppleSignInInput,
  type ForgotPasswordInput,
  type GoogleSignInInput,
  type LoginInput,
  type ResetPasswordInput,
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

  /** Forgot password: emails a code. Always 204, so it never tells whether an email has an account. */
  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    await this.auth.requestPasswordReset(body);
  }

  /** Forgot password: the emailed code and a new password; signs in and signs every other phone out. */
  @Post('password/reset')
  @HttpCode(200)
  resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    return this.auth.resetPassword(body);
  }
}
