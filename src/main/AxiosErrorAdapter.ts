import axios, { AxiosError } from 'axios';

type ErrorContext = Record<string, string | number | boolean | undefined>;
type AxiosErrorBody = {
  error?: unknown;
  message?: unknown;
};

const toErrorString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Get details from an axios error
export const axiosErrorDetails = (
  error: unknown,
  context?: ErrorContext
): string => {
  let errorMessage = 'Unknown error';

  if (axios.isAxiosError<AxiosErrorBody>(error)) {
    const axiosError = error as AxiosError<AxiosErrorBody>;
    errorMessage = axiosError.message;

    const responseDetails =
      toErrorString(axiosError.response?.data?.error) ??
      toErrorString(axiosError.response?.data?.message) ??
      toErrorString(axiosError.response?.data);

    if (responseDetails) {
      errorMessage += `, ${responseDetails}`;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  if (context) {
    const contextStr = Object.entries(context)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    if (contextStr) {
      errorMessage += ` [${contextStr}]`;
    }
  }
  return errorMessage;
};
