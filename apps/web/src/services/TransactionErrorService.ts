import { InvalidTxError } from 'polkadot-api';

export interface DispatchErrorInfo {
  type: string;
  message: string;
  details?: string;
  code?: string;
  moduleId?: number;
  moduleName?: string;
  moduleError?: string;
  rawError?: any;
}

// Enhanced Error interface with dispatch info
export interface EnhancedError extends Error {
  dispatchInfo: DispatchErrorInfo;
  type: string;
}

export class TransactionErrorService {
  /**
   * Recursively extracts error information from nested error objects
   */
  private static extractErrorDetails(value: any): { type?: string; message?: string; details?: any } {
    if (!value) return {};

    // If it's a string, use it as a message
    if (typeof value === 'string') {
      return { message: value };
    }

    // If it's an object, try to extract meaningful information
    if (typeof value === 'object') {
      const details: any = {};
      
      // Extract type if available
      if (value.type) {
        details.type = value.type;
      }

      // Extract message or name if available
      if (value.message) {
        details.message = value.message;
      } else if (value.name) {
        details.message = value.name;
      }

      // If there's a nested value, recursively extract its details
      if (value.value) {
        const nestedDetails = this.extractErrorDetails(value.value);
        
        // For module errors, prefer the nested type as the error type
        if (nestedDetails.type) {
          details.type = nestedDetails.type;
        }
        if (nestedDetails.message) {
          details.message = nestedDetails.message;
        }
        if (nestedDetails.details) {
          details.details = nestedDetails.details;
        }
      }

      return details;
    }

    return {};
  }

  /**
   * Formats error details into a human-readable message
   */
  private static formatErrorMessage(moduleName: string, details: any, rawError?: any): string {
    const parts: string[] = [];

    // Add module name if it exists and isn't part of the error type
    if (moduleName && moduleName !== 'Unknown') {
      parts.push(moduleName);
    }

    // For module errors, try to extract the specific error type
    if (rawError?.value?.value?.type) {
      parts.push(rawError.value.value.type);
    } else if (details.type && details.type !== moduleName) {
      parts.push(details.type);
    }

    // Add message if it provides additional information
    if (details.message && 
        details.message !== details.type && 
        details.message !== moduleName) {
      parts.push(details.message);
    }

    // Add any additional details
    if (rawError?.value?.value?.details) {
      const extraDetails = Object.entries(rawError.value.value.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (extraDetails) {
        parts.push(`(${extraDetails})`);
      }
    }

    // If we have no parts, use a default message
    if (parts.length === 0) {
      return 'Unknown error occurred';
    }

    return parts.filter(Boolean).join(': ');
  }

  /**
   * Parses a dispatch error from a transaction into a standardized format
   */
  static parseDispatchError(error: any): DispatchErrorInfo {
    if (!error) {
      return {
        type: 'Unknown',
        message: 'Unknown dispatch error'
      };
    }

    try {
      switch (error.type) {
        case 'Module': {
          const moduleName = error.value?.type || 'Unknown';
          const errorDetails = this.extractErrorDetails(error.value);
          
          // For module errors, get the actual error type from the nested value
          const moduleError = error.value?.value?.type || errorDetails.type;
          
          return {
            type: 'Module',
            message: this.formatErrorMessage(moduleName, errorDetails, error),
            details: JSON.stringify(error.value || {}),
            moduleName,
            moduleId: error.value?.index,
            moduleError,
            rawError: error
          };
        }
        
        case 'BadOrigin':
        case 'CannotLookup':
        case 'Token':
        case 'Arithmetic':
        case 'TooManyConsumers':
        case 'Other': {
          const errorDetails = this.extractErrorDetails(error.value);
          const message = errorDetails.message || this.formatErrorMessage(error.type, errorDetails, error);
          
          return {
            type: error.type,
            message,
            details: JSON.stringify(error.value || {}),
            rawError: error
          };
        }
        
        default: {
          const errorDetails = this.extractErrorDetails(error);
          return {
            type: error.type || 'Unknown',
            message: this.formatErrorMessage(error.type || 'Unknown', errorDetails, error),
            details: JSON.stringify(error),
            rawError: error
          };
        }
      }
    } catch (e) {
      console.error('Error parsing dispatch error:', e, 'Original error:', error);
      
      return {
        type: 'ParseError',
        message: 'Failed to parse error',
        details: JSON.stringify(error),
        rawError: error
      };
    }
  }

  /**
   * Creates an Error object from DispatchErrorInfo
   */
  static createErrorFromDispatchInfo(info: DispatchErrorInfo): EnhancedError {
    const error = new Error(info.message) as EnhancedError;
    error.dispatchInfo = info;
    error.type = info.type;
    error.name = `${info.type}Error`;
    
    // Modify the stack trace to not include TransactionErrorService methods
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      const filteredLines = stackLines.filter(line => !line.includes('TransactionErrorService'));
      error.stack = filteredLines.join('\n');
    }
    
    return error;
  }

  /**
   * Handles transaction errors comprehensively, including InvalidTxError
   */
  static handleTransactionError(error: any): Error {
    // If we already have an enhanced error, just return it
    if (error && error.dispatchInfo) {
      return error;
    }
    
    // Handle InvalidTxError from polkadot-api
    if (error instanceof InvalidTxError) {
      const errorDetails = this.extractErrorDetails(error.error);
      const enhancedError = new Error(errorDetails.message || error.message || 'The transaction is invalid') as EnhancedError;
      enhancedError.dispatchInfo = {
        type: 'InvalidTransaction',
        message: enhancedError.message,
        details: JSON.stringify(error.error || {}),
        rawError: error
      };
      enhancedError.type = 'InvalidTransaction';
      return enhancedError;
    }
    
    // Handle dispatch errors
    if (error?.dispatchError) {
      const dispatchInfo = this.parseDispatchError(error.dispatchError);
      return this.createErrorFromDispatchInfo(dispatchInfo);
    }
    
    // Handle error messages with known error codes
    if (typeof error?.message === 'string') {
      const enhancedError = new Error(error.message) as EnhancedError;
      enhancedError.dispatchInfo = {
        type: error.type || 'UnknownError',
        message: error.message,
        details: JSON.stringify(error),
        rawError: error
      };
      enhancedError.type = error.type || 'UnknownError';
      return enhancedError;
    }
    
    // Return original error or wrap unknown errors
    const finalError = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error occurred');
    (finalError as EnhancedError).dispatchInfo = {
      type: 'UnknownError',
      message: finalError.message,
      details: JSON.stringify(error),
      rawError: error
    };
    (finalError as EnhancedError).type = 'UnknownError';
    return finalError;
  }
} 