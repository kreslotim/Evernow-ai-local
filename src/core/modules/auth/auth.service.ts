import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { Role } from '@prisma/client';

export interface LoginDto {
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const { password } = loginDto;

      if (!password) {
        throw new UnauthorizedException('Password is required');
      }

      const adminPassword = this.configService.getAdminPassword();
      if (password !== adminPassword) {
        this.logger.warn('Invalid admin login attempt');
        throw new UnauthorizedException('Invalid admin password');
      }

      const payload = {
        role: Role.ADMIN,
        sub: Role.ADMIN,
      };

      const token = this.jwtService.sign(payload, {
        secret: this.configService.getJwtSecret(),
        expiresIn: this.configService.getJwtExpiresIn(),
      });

      return {
        token,
        user: {
          role: 'ADMIN',
        },
      };
    } catch (error) {
      console.log(error);
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getJwtSecret(),
      });
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
