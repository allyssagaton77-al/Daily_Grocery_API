import { randomUUID } from 'node:crypto';

export const ok = (res, data, meta) =>
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = (res, data) =>
  res.status(201).json({ success: true, data });

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const fail = (res, status, code, message, details = null) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
    requestId: randomUUID(),
  });

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
