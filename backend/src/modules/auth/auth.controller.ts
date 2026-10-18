import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/auth.service';
import { LoginDtoSchema, RegisterAccountDtoSchema } from '@/shared';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private signAccessToken(payload: { userId: string; accountId: string; role: string; email: string }) {
    const secret = process.env.JWT_SECRET || 'supersecret_corporate_messenger_key_change_in_production';
    return jwt.sign(payload, secret, { expiresIn: '15m' });
  }

  @Post('register')
  async register(@Body() body: any) {
    const parse = RegisterAccountDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados inválidos.');
    }
    try {
      const result = await this.authService.registerAccount(parse.data);
      const accessToken = this.signAccessToken({
        userId: result.rawUser.id,
        accountId: result.account.id,
        role: result.rawUser.role,
        email: result.rawUser.email,
      });
      const refreshToken = await this.authService.createRefreshToken(result.rawUser.id);
      return {
        user: result.user,
        account: result.account,
        accessToken,
        refreshToken,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao registrar conta.');
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    const parse = LoginDtoSchema.safeParse(body);
    if (!parse.success) {
      throw new BadRequestException(parse.error.errors[0]?.message || 'Dados inválidos.');
    }
    try {
      const result = await this.authService.login(parse.data);
      const accessToken = this.signAccessToken({
        userId: result.rawUser.id,
        accountId: result.account.id,
        role: result.rawUser.role,
        email: result.rawUser.email,
      });
      const refreshToken = await this.authService.createRefreshToken(result.rawUser.id);
      return {
        user: result.user,
        account: result.account,
        accessToken,
        refreshToken,
      };
    } catch (err: any) {
      throw new UnauthorizedException(err.message || 'Falha na autenticação.');
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token é obrigatório.');
    }
    try {
      const result = await this.authService.rotateRefreshToken(refreshToken);
      const accessToken = this.signAccessToken({
        userId: result.rawUser.id,
        accountId: result.account.id,
        role: result.rawUser.role,
        email: result.rawUser.email,
      });
      return {
        user: result.user,
        account: result.account,
        accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (err: any) {
      throw new UnauthorizedException(err.message || 'Token expirado ou inválido.');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body('refreshToken') refreshToken: string) {
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    return { success: true };
  }
}
