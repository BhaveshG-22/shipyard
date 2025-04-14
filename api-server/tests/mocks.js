// Mock implementation for AWS SDK
const mockAWS = {
  ECSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation((command) => {
      if (command.constructor.name === 'RunTaskCommand') {
        return Promise.resolve({
          tasks: [{ taskArn: 'test-task-arn' }]
        });
      }
      if (command.constructor.name === 'StopTaskCommand') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    })
  }))
};

// Mock implementation for Redis
const mockRedis = {
  on: jest.fn(),
  psubscribe: jest.fn(),
  emit: jest.fn()
};

// Mock implementation for Socket.IO
const mockSocketIO = {
  on: jest.fn((event, callback) => {
    if (event === 'connection') {
      callback({
        on: jest.fn(),
        join: jest.fn(),
        to: jest.fn().mockReturnValue({
          emit: jest.fn()
        })
      });
    }
  }),
  to: jest.fn().mockReturnValue({
    emit: jest.fn()
  })
};

// Mock Express server
const mockExpressServer = {
  listen: jest.fn((port, callback) => {
    callback();
    return mockExpressServer;
  })
};

// Mock environment variables
const mockEnv = {
  PORT: 4000,
  BASE_URL: 'test.example.com',
  REDIS_SERVICE_URL: 'redis://localhost:6379',
  S3_BUCKET: 'test-bucket',
  AWS_REGION: 'us-east-1',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  ACCESSKEY_KEY_ID: 'test-access-key',
  AWS_CLUSTER_ID: 'test-cluster',
  AWS_TASK_ID: 'test-task',
  AWS_SUBNETS: 'subnet-1,subnet-2',
  AWS_SECURITY_GROUP: 'sg-1,sg-2',
  AWS_ECR_IMAGE: 'test-image',
  CORS_ORIGINS: 'http://localhost:3000,https://example.com'
};

module.exports = {
  mockAWS,
  mockRedis,
  mockSocketIO,
  mockExpressServer,
  mockEnv
};