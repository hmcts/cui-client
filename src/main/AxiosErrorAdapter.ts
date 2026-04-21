import axios, { AxiosError } from 'axios';

type ErrorContext = Record<string, string | number | boolean | undefined>;

// Get details from an axios error
export const axiosErrorDetails = (
  error: unknown,
  context?: ErrorContext
): string => {
  let errorMessage = 'Unknown error';

  if (axios.isAxiosError<{ error?: string }>(error)) {
    const axiosError = error as AxiosError<{ error?: string }>;
    errorMessage = axiosError.message;
    if (axiosError.response?.data?.error) {
      errorMessage += `, ${axiosError.response.data.error}`;
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
