// Set up environment variables for testing
process.env.PORT = '4000';
process.env.BASE_URL = 'test.example.com';
process.env.REDIS_SERVICE_URL = 'redis://localhost:6379';
process.env.S3_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.ACCESSKEY_KEY_ID = 'test-access-key';
process.env.AWS_CLUSTER_ID = 'test-cluster';
process.env.AWS_TASK_ID = 'test-task';
process.env.AWS_SUBNETS = 'subnet-1,subnet-2';
process.env.AWS_SECURITY_GROUP = 'sg-1,sg-2';
process.env.AWS_ECR_IMAGE = 'test-image';
process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com';

// Use fake timers to prevent socket.io and Redis timeouts from hanging
jest.useFakeTimers();

// Increase Jest timeout for all tests
jest.setTimeout(10000);

// Silence console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Close any open handles after tests
afterAll(() => {
  // Force exit after all tests to prevent hanging due to Redis connections
  setTimeout(() => {
    process.exit(0);
  }, 500);
});