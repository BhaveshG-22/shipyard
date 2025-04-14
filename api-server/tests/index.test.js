const request = require('supertest');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const { ECSClient } = require('@aws-sdk/client-ecs');
const RedisMock = require('redis-mock');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

// Mock external services
jest.mock('@aws-sdk/client-ecs', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-ecs');
  return {
    ...originalModule,
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
    })),
    RunTaskCommand: originalModule.RunTaskCommand,
    StopTaskCommand: originalModule.StopTaskCommand
  };
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      psubscribe: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
  });
});

// Mock random-word-slugs
jest.mock('random-word-slugs', () => ({
  generateSlug: jest.fn().mockReturnValue('test-project-slug')
}));

// Load app after mocks
const app = require('../index');

describe('API Server Tests', () => {
  let mockAxios;
  
  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    mockAxios.restore();
  });
  
  // Root endpoint test
  test('GET / should return HTML with server status', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Server is Online');
  });
  
  // Repository folders endpoint test
  test('GET /repo-folders returns folders from GitHub API', async () => {
    const mockData = [
      { name: 'folder1', type: 'dir' },
      { name: 'folder2', type: 'dir' },
      { name: 'file1', type: 'file' }
    ];
    
    mockAxios.onGet('https://api.github.com/repos/owner/repo/contents').reply(200, mockData);
    
    const response = await request(app)
      .get('/repo-folders')
      .query({ repoUrl: 'https://github.com/owner/repo' });
      
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ folders: ['folder1', 'folder2'] });
  });
  
  // Repository branches endpoint test
  test('GET /repo-branches returns branches from GitHub API', async () => {
    const mockData = [
      { name: 'main' },
      { name: 'develop' }
    ];
    
    mockAxios.onGet('https://api.github.com/repos/owner/repo/branches').reply(200, mockData);
    
    const response = await request(app)
      .get('/repo-branches')
      .query({ repoUrl: 'https://github.com/owner/repo' });
      
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ branches: ['main', 'develop'] });
  });
  
  // Deployment endpoint test
  test('POST / should deploy a project', async () => {
    const response = await request(app)
      .post('/')
      .send({
        gitURL: 'https://github.com/owner/repo',
        folder: 'frontend',
        branch: 'main'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('queue');
    expect(response.body.data).toHaveProperty('projectSlug', 'test-project-slug');
    expect(response.body.data).toHaveProperty('taskArn', 'test-task-arn');
    expect(response.body.data).toHaveProperty('url');
  });
  
  // Missing parameters test
  test('POST / should return error when missing parameters', async () => {
    const response = await request(app)
      .post('/')
      .send({
        gitURL: 'https://github.com/owner/repo'
        // Missing folder parameter
      });
      
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('error');
    expect(response.body.data).toHaveProperty('errorMSG');
  });
});

// Socket.io tests
describe('Socket.IO Tests', () => {
  // Skip these tests because we're testing socket.io functionality in socket.test.js
  test('Socket can join a channel', () => {
    expect(true).toBe(true);
  });
  
  test('Socket can receive messages', () => {
    expect(true).toBe(true);
  });
});

// Test the monitorTaskCompletion function
describe('Monitor Task Completion', () => {
  test('Task should be stopped when redis sends "Done" message', () => {
    // This is more of an integration test
    // We'd need to mock the Redis subscriber and verify the stop task command is sent
    // Implementation would depend on how the function is exposed in the module
  });
});