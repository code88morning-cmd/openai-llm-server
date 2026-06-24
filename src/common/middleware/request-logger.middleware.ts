import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();

    res.on('finish', () => {
      const elapsedMs = Date.now() - startedAt;
      const logLine = [
        new Date().toISOString(),
        req.method,
        req.originalUrl,
        String(res.statusCode),
        `${elapsedMs}ms`,
      ].join(' ');

      this.writeLog(logLine);
    });

    next();
  }

  private writeLog(logLine: string): void {
    const logFilePath = this.configService.get<string>('LOG_FILE_PATH') || 'logs/access.log';
    const absolutePath = path.resolve(process.cwd(), logFilePath);
    const logDirectory = path.dirname(absolutePath);

    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }

    fs.appendFileSync(absolutePath, `${logLine}\n`, { encoding: 'utf8' });
  }
}
