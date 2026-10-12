import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db as defaultDb } from '../db/index';
import { accounts, users, refreshTokens, User, Account } from '../db/schema/index';
import { RegisterAccountDto, LoginDto } from '@corpchat/shared';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

export class AuthService {
  constructor(private db = defaultDb) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async registerAccount(dto: RegisterAccountDto) {
    // 1. Check if email is already taken
    const existingUser = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase().trim()),
    });

    if (existingUser) {
      throw new Error('E-mail já está em uso por outro usuário.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const trialUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days Pro trial

    // 2. Create account + owner in a transaction
    const [newAccount] = await this.db
      .insert(accounts)
      .values({
        name: dto.accountName.trim(),
        plan: 'pro',
        status: 'active',
        trialUntil,
      })
      .returning();

    const [newUser] = await this.db
      .insert(users)
      .values({
        accountId: newAccount.id,
        name: dto.userName.trim(),
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: 'owner',
        status: 'active',
      })
      .returning();

    return {
      account: newAccount,
      user: this.sanitizeUser(newUser),
      rawUser: newUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase().trim()),
      with: {
        account: true,
      },
    });

    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    if (user.status !== 'active') {
      throw new Error('Usuário inativo. Entre em contato com o administrador.');
    }

    if (user.account.status === 'suspended') {
      throw new Error('Esta conta está suspensa. Entre em contato com o suporte.');
    }

    const isMatch = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Credenciais inválidas.');
    }

    // Update lastSeenAt
    await this.db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      account: user.account,
      user: this.sanitizeUser(user),
      rawUser: user,
    };
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  async rotateRefreshToken(oldToken: string) {
    const storedToken = await this.db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.token, oldToken),
        gt(refreshTokens.expiresAt, new Date())
      ),
      with: {
        user: {
          with: {
            account: true,
          },
        },
      },
    });

    if (!storedToken || !storedToken.user) {
      throw new Error('Refresh token inválido ou expirado.');
    }

    // Delete old token
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, storedToken.id));

    // Generate new token
    const newRefreshToken = await this.createRefreshToken(storedToken.user.id);

    return {
      user: this.sanitizeUser(storedToken.user),
      rawUser: storedToken.user,
      account: storedToken.user.account,
      refreshToken: newRefreshToken,
    };
  }

  async revokeRefreshToken(token: string) {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }

  sanitizeUser(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
