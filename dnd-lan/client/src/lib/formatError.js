import { ERROR_CODES } from "./errorCodes.js";
import { mapError } from "./errorMapper.js";

export function formatError(error, fallback = ERROR_CODES.REQUEST_FAILED) {
  return mapError(error, fallback).message;
}
