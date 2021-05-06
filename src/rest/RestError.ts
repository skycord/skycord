export type RestErrorType = any;

export class RestError extends Error {
  public readonly bodyMessage: string;

  public readonly bodyCode: number;

  public readonly bodyErrors: RestErrorType[] | undefined;

  constructor(body: {
    bodyMessage: string;
    bodyCode: number;
    bodyErrors: RestErrorType[] | undefined;
  }) {
    super();
    this.bodyMessage = body.bodyMessage;
    this.bodyCode = body.bodyCode;
    this.bodyErrors = body.bodyErrors;
  }

  get message() {
    return `RestError: ${this.bodyCode} - ${this.bodyMessage}\n${this.formatErrors()}`;
  }

  // Adapted from: https://github.com/abalabahaha/eris/blob/master/lib/errors/DiscordRESTError.js
  private formatErrors(errors?: RestErrorType[], errorType: string = ''): string {
    const determinedErrors = errors ?? this.bodyErrors;
    if (!determinedErrors) {
      return 'The errors were not defined.';
    }
    let output = '';
    for (let i = 0; i < determinedErrors.length; i += 1) {
      // Disable the no underscore rule so we can get the error without the linter complaining.
      // eslint-disable-next-line no-underscore-dangle
      output += determinedErrors[i]._errors.map((e: Error) => `${errorType}${i}: ${e.message}\n`) ?? this.formatErrors(determinedErrors[i], `${errorType}${i}.`);
    }
    return output;
  }
}
