import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  API_PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string()
    .trim()
    .pattern(/^[a-z0-9/-]+$/)
    .default('api/v1'),
  CORS_ORIGINS: Joi.string().trim().default('http://localhost:3000'),
  ENABLE_SWAGGER: Joi.boolean().truthy('true').falsy('false').default(true),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  IAM_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Joi.string()
    .pattern(/^[A-Za-z0-9+/]{43}=$/)
    .invalid(Joi.ref('IAM_ACCESS_TOKEN_SECRET'))
    .required(),
  CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Joi.string()
    .pattern(/^[A-Za-z0-9+/]{43}=$/)
    .invalid(
      Joi.ref('IAM_ACCESS_TOKEN_SECRET'),
      Joi.ref('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
    )
    .required(),
  CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: Joi.number()
    .integer()
    .min(1)
    .required(),
  MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Joi.string()
    .pattern(/^[A-Za-z0-9+/]{43}=$/)
    .invalid(
      Joi.ref('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      Joi.ref('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
    )
    .required(),
  DOCUMENTS_STORAGE_ROOT: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().trim().required(),
      otherwise: Joi.string().trim().default('.data/documents'),
    }),
  DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: Joi.string()
    .pattern(/^[A-Za-z0-9+/]{43}=$/)
    .invalid(
      Joi.ref('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
      Joi.ref('CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
      Joi.ref('MASTER_DATA_IMPORT_TOKEN_KEY_BASE64'),
    )
    .required(),
});
