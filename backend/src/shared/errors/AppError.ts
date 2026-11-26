export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} (${id}) no encontrado` : `${resource} no encontrado`, 404);
  }
}

export class PromptInjectionError extends AppError {
  public readonly matchedPattern: string;

  constructor(message: string, matchedPattern: string) {
    super(message, 400);
    this.matchedPattern = matchedPattern;
  }
}
