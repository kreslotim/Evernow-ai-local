import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Logger } from 'src/common/utils/logger';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ErrorsInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract context information
    const contextInfo = {
      httpMethod: request?.method,
      url: request?.url,
      userAgent: request?.headers?.['user-agent'],
      ip: request?.ip || request?.connection?.remoteAddress,
      correlationId: request?.headers?.['x-correlation-id'],
      userId: request?.user?.id,
      timestamp: new Date().toISOString(),
    };

    return next.handle().pipe(
      catchError((error) => {
        this.logError(error, contextInfo);
        return throwError(() => this.transformError(error));
      }),
    );
  }

  private logError(error: any, context: any) {
    const errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.status || error.statusCode,
      ...context,
    };

    // Log HTTP exceptions
    if (error instanceof HttpException) {
      this.logger.error(`HTTP Exception: ${error.message}`, error, {
        statusCode: error.getStatus(),
        response: error.getResponse(),
        ...context,
      });
      return;
    }

    // Log Axios/HTTP client errors
    if (error.response && error.response.data) {
      this.logger.error('External API Error', error, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
        config: {
          method: error.config?.method,
          url: error.config?.url,
          timeout: error.config?.timeout,
        },
        ...context,
      });
      return;
    }

    // Log validation errors
    if (error.name === 'ValidationError' || error.errors) {
      this.logger.error('Validation Error', error, {
        validationErrors: error.errors || error.details,
        ...context,
      });
      return;
    }

    // Log general errors
    this.logger.error(`Unexpected Error: ${error.message}`, error, errorDetails);
  }

  private transformError(error: any): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    // Axios/HTTP client errors
    if (error.response?.data) {
      const status = error.response.status || HttpStatus.BAD_GATEWAY;
      return new HttpException(
        {
          message: 'External Service Error',
          details: error.response.data,
          status: error.response.status,
        },
        status,
      );
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.errors) {
      return new HttpException(
        {
          message: 'Validation Failed',
          errors: error.errors || error.details,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new HttpException(
        {
          message: 'Request Timeout',
          details: error.message,
        },
        HttpStatus.REQUEST_TIMEOUT,
      );
    }

    // Default to internal server error
    return new HttpException(
      {
        message: 'Internal Server Error',
        details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
