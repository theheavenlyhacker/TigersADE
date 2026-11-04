import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, COOKIE } from './auth.service';

const sessionToken = (req: Request) => {
  const pair = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  return pair?.slice(COOKIE.length + 1);
};

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Log in with an email and password' })
  @ApiBody({ schema: { example: { email: 'owner@tigerscafe.ph', password: 'tigers123' } } })
  async login(@Body() body: { email?: string; password?: string }, @Res({ passthrough: true }) res: Response) {
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string') throw new UnauthorizedException('Invalid email or password');
    const result = await this.auth.login(body.email.trim(), body.password);
    res.setHeader('Set-Cookie', result.cookie);
    return result.user;
  }

  @Post('auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(sessionToken(req));
    res.setHeader('Set-Cookie', this.auth.clearCookie());
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) { return this.auth.current(sessionToken(req)); }
}
