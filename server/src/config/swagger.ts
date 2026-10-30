import { OpenAPIV3 } from 'openapi-types';

const auth = [{ bearerAuth: [] }];
const json = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.RequestBodyObject => ({
  required: true,
  content: { 'application/json': { schema } },
});
const objectSchema = (properties: Record<string, OpenAPIV3.SchemaObject>, required: string[] = []) => ({
  type: 'object' as const,
  properties,
  required,
});
const response = (description = 'Success'): OpenAPIV3.ResponsesObject => ({
  '200': { description },
  '400': { description: 'Invalid request' },
  '401': { description: 'Unauthenticated' },
  '403': { description: 'Forbidden' },
  '500': { description: 'Internal server error' },
});

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Rental Management API',
    version: '1.0.0',
    description: 'API documentation for the rental management backend',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Auth', description: 'Authentication and account recovery' },
    { name: 'Posts', description: 'Rental listing management' },
    { name: 'Properties', description: 'Landlord property management' },
    { name: 'Rooms', description: 'Room and amenity management' },
    { name: 'Contracts', description: 'Rental contracts' },
    { name: 'Invoices', description: 'Monthly invoices' },
    { name: 'Meter readings', description: 'Utility meter readings' },
    { name: 'Chat', description: 'Conversations and messages' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      LoginRequest: objectSchema({
        email: { type: 'string', format: 'email', example: 'tenant.test@rental.local' },
        password: { type: 'string', format: 'password', example: 'TestPassword123!' },
      }, ['email', 'password']),
      RefreshTokenRequest: objectSchema({
        refreshToken: { type: 'string' },
      }, ['refreshToken']),
      RegisterRequest: objectSchema({
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', minLength: 6 },
        fullName: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string', enum: ['TENANT', 'LANDLORD', 'AGENT'] },
      }, ['email', 'password', 'fullName']),
      Error: objectSchema({
        success: { type: 'boolean', example: false },
        message: { type: 'string' },
      }),
    },
  },
  paths: {
    '/auth/register': {
      post: { tags: ['Auth'], summary: 'Register a user', requestBody: json({ $ref: '#/components/schemas/RegisterRequest' }), responses: { '201': { description: 'Registered' }, ...response() } },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Login and receive access/refresh tokens', requestBody: json({ $ref: '#/components/schemas/LoginRequest' }), responses: response('Logged in') },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Rotate the refresh token', requestBody: json({ $ref: '#/components/schemas/RefreshTokenRequest' }), responses: response('Token refreshed') },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke a refresh token', requestBody: json({ $ref: '#/components/schemas/RefreshTokenRequest' }), responses: { '204': { description: 'Logged out' }, ...response() } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Get the current user', security: auth, responses: response() },
    },
    '/posts': {
      get: { tags: ['Posts'], summary: 'List approved posts', responses: response() },
      post: { tags: ['Posts'], summary: 'Create a post', security: auth, requestBody: { required: true, content: { 'multipart/form-data': { schema: objectSchema({ title: { type: 'string' }, description: { type: 'string' }, postType: { type: 'string', enum: ['RENT_OUT', 'FIND_ROOM', 'FIND_ROOMMATE'] }, images: { type: 'array', items: { type: 'string', format: 'binary' } } }, ['title', 'description', 'postType']) } } }, responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/posts/search': {
      get: { tags: ['Posts'], summary: 'Search approved posts', parameters: [{ name: 'keyword', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: response() },
    },
    '/properties': {
      post: { tags: ['Properties'], summary: 'Create a property', security: auth, requestBody: json(objectSchema({ name: { type: 'string' }, address: { type: 'string' }, province: { type: 'string' }, district: { type: 'string' }, ward: { type: 'string' } }, ['name', 'address', 'province', 'district', 'ward'])), responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/properties/my': {
      get: { tags: ['Properties'], summary: 'List my properties', security: auth, responses: response() },
    },
    '/rooms/amenities': {
      get: { tags: ['Rooms'], summary: 'List amenities', responses: response() },
    },
    '/rooms': {
      post: { tags: ['Rooms'], summary: 'Create a room', security: auth, requestBody: json(objectSchema({ propertyId: { type: 'string', format: 'uuid' }, roomNumber: { type: 'string' }, priceMonthly: { type: 'number' }, area: { type: 'number' } }, ['propertyId', 'roomNumber', 'priceMonthly', 'area'])), responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/contracts': {
      post: { tags: ['Contracts'], summary: 'Create a contract', security: auth, requestBody: json(objectSchema({ roomId: { type: 'string', format: 'uuid' }, tenantId: { type: 'string', format: 'uuid' }, startDate: { type: 'string', format: 'date-time' }, depositPaid: { type: 'number' }, monthlyRent: { type: 'number' } }, ['roomId', 'tenantId', 'startDate', 'depositPaid', 'monthlyRent'])), responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/contracts/my': {
      get: { tags: ['Contracts'], summary: 'List my contracts', security: auth, responses: response() },
    },
    '/invoices/generate': {
      post: { tags: ['Invoices'], summary: 'Generate an invoice', security: auth, requestBody: json(objectSchema({ roomId: { type: 'string', format: 'uuid' }, month: { type: 'integer', minimum: 1, maximum: 12 }, year: { type: 'integer' } }, ['roomId', 'month', 'year'])), responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/invoices/my': {
      get: { tags: ['Invoices'], summary: 'List my invoices', security: auth, responses: response() },
    },
    '/meter-readings': {
      post: { tags: ['Meter readings'], summary: 'Record utility meters', security: auth, requestBody: json(objectSchema({ roomId: { type: 'string', format: 'uuid' }, month: { type: 'integer' }, year: { type: 'integer' }, electricityStart: { type: 'integer' }, electricityEnd: { type: 'integer' }, waterStart: { type: 'integer' }, waterEnd: { type: 'integer' } }, ['roomId', 'month', 'year'])), responses: { '201': { description: 'Created' }, ...response() } },
    },
    '/chats/conversations': {
      get: { tags: ['Chat'], summary: 'List my conversations', security: auth, responses: response() },
      post: { tags: ['Chat'], summary: 'Create or get a conversation', security: auth, requestBody: json(objectSchema({ targetUserId: { type: 'string', format: 'uuid' } }, ['targetUserId'])), responses: response() },
    },
  },
};
