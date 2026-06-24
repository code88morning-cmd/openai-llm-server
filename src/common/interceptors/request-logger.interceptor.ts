import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsedMs = Date.now() - startedAt;
        this.logger.log(`${request.method} ${request.url} - ${elapsedMs}ms`);
      }),
    );
  }
}
