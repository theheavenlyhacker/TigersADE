import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '../application/auth.service';
import { CurrentUser as Current } from '../domain/current-user';
import { AccessGuard, CurrentUser } from './access.guard';
import { LoginDto } from './auth.dto';
import { clearedCookie, sessionCookie, sessionToken } from './session-cookie';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Log in with an email and password' })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(body.email.trim(), body.password);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return user;
  }

  @Post('auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(sessionToken(req));
    res.setHeader('Set-Cookie', clearedCookie());
    return { ok: true };
  }

  @Get('me') @UseGuards(AccessGuard)
  /** Reissue the cookie so its 7-day Max-Age slides with the session row. */
  me(@CurrentUser() current: Current, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = sessionToken(req);
    if (token) res.setHeader('Set-Cookie', sessionCookie(token));
    return current;
  }
}
