import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-response.dto.js';

/** Bearer JWT auth — tenantId/userId are taken from the token + DEFAULT_TENANT_ID. */
export function ApiTenantHeaders() {
  return applyDecorators(ApiBearerAuth('bearer'));
}

export function ApiWrappedOkResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful response',
) {
  return ApiOkResponse({
    description,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(model) },
      },
      required: ['success', 'data'],
    },
  });
}

export function ApiWrappedCreatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Resource created',
) {
  return ApiCreatedResponse({
    description,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(model) },
      },
      required: ['success', 'data'],
    },
  });
}

export function ApiWrappedOkArrayResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful list response',
) {
  return ApiOkResponse({
    description,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(model) },
            },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                total: { type: 'number', example: 42 },
                totalPages: { type: 'number', example: 3 },
              },
            },
          },
        },
      },
    },
  });
}

export function ApiWrappedCreatedArrayResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Resources created',
) {
  return ApiCreatedResponse({
    description,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(model) } },
      },
      required: ['success', 'data'],
    },
  });
}

/** Wrapped response whose data is a plain array rather than a paginated list. */
export function ApiWrappedRawArrayResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful response',
) {
  return ApiOkResponse({
    description,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(model) } },
      },
      required: ['success', 'data'],
    },
  });
}

export function ApiStandardErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Missing or invalid Bearer access token',
      type: ApiErrorResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'Validation error or missing required headers',
      type: ApiErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: 'Operation not allowed in current intake state',
      type: ApiErrorResponseDto,
    }),
    ApiNotFoundResponse({
      description: 'Resource not found for tenant',
      type: ApiErrorResponseDto,
    }),
    ApiConflictResponse({
      description: 'Conflict (e.g. duplicate code within tenant)',
      type: ApiErrorResponseDto,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Business rule violation',
      type: ApiErrorResponseDto,
    }),
  );
}
