import { Request, Response, NextFunction } from 'express';

// Standard Express 5.x compatible types
export interface StandardRequest extends Request {}
export interface StandardResponse extends Response {}

// Route handler types for Express 5.x (must return void)
export type RouteHandler = (req: StandardRequest, res: StandardResponse) => Promise<void>;
export type RouteHandlerWithNext = (req: StandardRequest, res: StandardResponse, next: NextFunction) => Promise<void>;

// Parameterized route handlers
export type ParameterizedRouteHandler<P = {}> = (req: Request<P>, res: Response) => Promise<void>;

// Error handling utilities
export const handleError = (res: Response, error: any, message: string): void => {
  console.error(message, error);
  const errorMessage = error?.message || 'Unknown error';
  res.status(500).json({ 
    error: message,
    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
  });
};

export const handleValidationError = (res: Response, message: string): void => {
  res.status(400).json({ error: message });
};

export const handleNotFound = (res: Response, resource: string): void => {
  res.status(404).json({ error: `${resource} not found` });
};

export const handleSuccess = (res: Response, data: any, message?: string): void => {
  const response: any = { success: true, data };
  if (message) response.message = message;
  res.json(response);
};