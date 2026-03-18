import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiration: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // Refresh token uses a different secret so access tokens can't be used as refresh tokens
    this.refreshSecret = this.configService.get<string>('JWT_SECRET') + '-refresh';
    this.refreshExpiration = '30d';
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: dto.email
        ? { email: dto.email }
        : { username: dto.username },
      include: { garage: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...this.generateTokens(user),
      user: this.formatUser(user),
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const garage = await this.prisma.garage.create({
      data: {
        name: dto.garageName,
        specializations: ['MECHANICAL'],
      },
    });

    const user = await this.prisma.user.create({
      data: {
        garageId: garage.id,
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: 'OWNER',
      },
      include: { garage: true },
    });

    // Activate free modules
    const freeModules = ['dashboard', 'customers', 'cars', 'appointments'];
    await this.prisma.garageModule.createMany({
      data: freeModules.map(moduleId => ({
        garageId: garage.id,
        moduleId,
      })),
    });

    return {
      ...this.generateTokens(user),
      user: this.formatUser(user),
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify the refresh token with the refresh secret
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });

      // Ensure it's actually a refresh token (has the refresh flag)
      if (!payload.isRefresh) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { garage: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        ...this.generateTokens(user),
        user: this.formatUser(user),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { garage: true },
    });
    if (!user) throw new UnauthorizedException();
    const { password, ...result } = user;
    return result;
  }

  // ── Private helpers ───────────────────────────────────

  private generateTokens(user: any) {
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      garageId: user.garageId,
    };

    const access_token = this.jwtService.sign(jwtPayload);

    const refresh_token = this.jwtService.sign(
      { ...jwtPayload, isRefresh: true },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiration },
    );

    return { access_token, refresh_token };
  }

  private formatUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      garage: {
        id: user.garage.id,
        name: user.garage.name,
      },
    };
  }
}
