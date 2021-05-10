import { RestResponse } from './RestClient';

export interface RestErrorBody {

  code: number;

  errors?: unknown[];
}

export class RestError extends Error {
  public response: RestResponse<RestErrorBody>;

  public errors: unknown[];

  constructor(response: RestResponse<RestErrorBody>) {
    super(`Error ${response.status} occurred during rest request.`);
    this.response = response;

    if (response.body.code === 50035 && response.body.errors) {
      this.errors = response.body.errors;
    }
  }
}
