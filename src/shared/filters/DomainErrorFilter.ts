import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ValidationError } from 'yup';
import { DomainError } from '../errors/DomainError';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof DomainError) {
      this.sendDomainError(response, error);
      return;
    }

    if (error instanceof ValidationError) {
      this.sendDomainError(
        response,
        DomainError.validationFailed({ errors: error.errors }),
      );
      return;
    }

    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }

    console.error(error);

    response.status(500).json({
      result: 'ERROR',
      reason: 'INTERNAL_SERVER_ERROR',
    });
  }

  private sendDomainError(response: Response, error: DomainError): void {
    if (!error.reason) {
      response.status(error.statusCode).send();
      return;
    }

    response.status(error.statusCode).json({
      result: 'ERROR',
      reason: error.reason,
      data: error.data,
    });
  }
}
