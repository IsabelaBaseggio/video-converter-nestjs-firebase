// src/common/filters/global-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const responseBody =
            exception instanceof HttpException
                ? exception.getResponse()
                : { message: 'Internal server error' };

        response.status(status).json({
            statusCode: status,
            message:
                typeof responseBody === 'string'
                    ? responseBody
                    : responseBody['message'],
        });
    }
}