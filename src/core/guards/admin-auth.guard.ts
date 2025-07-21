import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../modules/config/config.service';
import { Role } from '@prisma/client';

export interface JwtPayload {
  role: Role;
  sub: Role;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        this.logger.warn('No token provided in request');
        throw new UnauthorizedException('Access token is required');
      }

      // Validate and decode the JWT token
      const payload = await this.validateToken(token);

      if (!this.isAdmin(payload)) {
        throw new UnauthorizedException('Admin access required');
      }

      // Attach the payload to the request for use in controllers
      request.user = payload;

      return true;
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);

      // Re-throw UnauthorizedException, wrap other errors
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type === 'Bearer' && token) {
      return token;
    }

    if (type === 'Token' && token) {
      return token;
    }

    // If no prefix, assume the entire header is the token
    if (!token && authHeader) {
      return authHeader;
    }

    return null;
  }

  private async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getJwtSecret(),
      }) as JwtPayload;

      if (!payload) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token format');
      }

      if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet');
      }

      this.logger.error(`Token validation error: ${error.message}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private isAdmin(payload: JwtPayload): boolean {
    return payload.role === Role.ADMIN;
  }
}
