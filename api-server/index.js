const express = require('express')
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config()

const app = express()
const server = http.createServer(app);

// CORS SETUP BASED ON ENV
const allowedOrigins =
    process.env.NODE_ENV === 'development'
        ? ['*']
        : (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []);

if (process.env.NODE_ENV === 'development') {
    app.use(cors());
    console.log('✅ CORS enabled for all (development)');
} else {
    app.use(cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                console.log(`✅ Allowed CORS request from: ${origin}`);
                callback(null, true);
            } else {
                console.log(`❌ Blocked CORS request from: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
    }));
    console.log(`✅ CORS restricted to: ${allowedOrigins}`);
}

app.use((req, res, next) => {
    console.log(`🌐 Incoming request from: ${req.headers.origin}`);
    next();
});

// SOCKET.IO
const io = socketIO(server, {
    cors: {
        origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    }
});

app.use(express.json());

const PORT = process.env.PORT;
const BASE_URL = process.env.BASE_URL;
const REDIS_SERVICE_URL = process.env.REDIS_SERVICE_URL;
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const ACCESSKEY_KEY_ID = process.env.ACCESSKEY_KEY_ID;
const AWS_CLUSTER_ID = process.env.AWS_CLUSTER_ID;
const AWS_TASK_ID = process.env.AWS_TASK_ID;
const AWS_ECR_IMAGE = process.env.AWS_ECR_IMAGE;

const AWS_SUBNETS = process.env.AWS_SUBNETS;
const AWS_SUBNETS_ARRAY = AWS_SUBNETS ? AWS_SUBNETS.split(',') : [];
const AWS_SECURITY_GROUP = process.env.AWS_SECURITY_GROUP;
const AWS_SECURITY_GROUP_ARRAY = AWS_SECURITY_GROUP ? AWS_SECURITY_GROUP.split(',') : [];

const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;


const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand, StopTaskCommand } = require('@aws-sdk/client-ecs');
const Valkey = require("ioredis");

const subscriber = new Valkey(REDIS_SERVICE_URL);
const ecsCredential = new ECSClient({
    region: AWS_REGION,
    credentials: {
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        accessKeyId: ACCESSKEY_KEY_ID,
    }
});
const config = {
    CLUSTER: AWS_CLUSTER_ID,
    TASK: AWS_TASK_ID
};

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        console.log(`request to join channel ${channel}`);
        socket.join(channel)
        channel && socket.emit('message', { 'msg': `request in queue`, 'stage': 1 })
    });

    socket.on('disconnect', (channel) => {
        console.log(`request to disconnect channel ${channel}`);
        let attemptsToJoin = 5;
        let currentAttempt = 0;
        while (currentAttempt <= attemptsToJoin) {
            try {
                socket.join(channel)
            } catch (error) {
                console.error(`ERROR RECONNECTING to ${channel}`);
                console.error(`${attemptsToJoin - currentAttempt} Attempts Left`);
            }
            currentAttempt = currentAttempt + 1;
        }
    });
});

app.get('/', (req, res) => {
    res.send(`<html><body><div style="text-align:center;margin-top:100px;font-size:24px;color:green;">✅ Server is Online</div></body></html>`);
});

app.get('/repo-folders', async (req, res) => {
    const repoUrl = req.query.repoUrl;
    if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

    const repoPath = repoUrl.replace('https://github.com/', '');
    const [owner, repo] = repoPath.split('/');

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, {
            headers: {
                Authorization: `Bearer ${GITHUB_API_TOKEN}`,
                Accept: 'application/vnd.github+json'
            }
        }); const folders = response.data
            .filter(item => item.type === 'dir')
            .map(item => item.name);
        res.json({ folders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

app.get('/repo-branches', async (req, res) => {
    const repoUrl = req.query.repoUrl;
    if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

    const repoPath = repoUrl.replace('https://github.com/', '');
    const [owner, repo] = repoPath.split('/');

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers: {
                Authorization: `Bearer ${GITHUB_API_TOKEN}`,
                Accept: 'application/vnd.github+json'
            }
        }); const branches = response.data.map(branch => branch.name);
        res.json({ branches });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

app.post('/', async (req, res) => {
    if (!req.body.gitURL || !req.body.folder) {
        return res.json({
            status: 'error',
            data: { errorMSG: `gitURL OR folder missing in req body received ${req.body}` }
        });
    }

    const projectSlug = generateSlug();
    const { gitURL, folder, branch } = req.body;

    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: AWS_SUBNETS_ARRAY,
                securityGroups: AWS_SECURITY_GROUP_ARRAY,
                assignPublicIp: 'ENABLED',
            }
        },
        overrides: {
            containerOverrides: [{
                name: AWS_ECR_IMAGE,
                environment: [
                    { name: 'GIT_URL', value: gitURL },
                    { name: 'GIT_ROOT', value: folder },
                    { name: 'GIT_BRANCH', value: branch || 'main' },
                    { name: 'REDIS_URI', value: REDIS_SERVICE_URL },
                    { name: 'S3_BUCKET', value: S3_BUCKET },
                    { name: 'ACCESS_KEY_ID', value: ACCESSKEY_KEY_ID },
                    { name: 'SECRET_ACCESS_KEY', value: AWS_SECRET_ACCESS_KEY },
                    { name: 'REGION', value: AWS_REGION },
                    { name: 'PROJECT_ID', value: projectSlug },
                    { name: 'REVERSE_PROXY_URL', value: BASE_URL },
                ]
            }]
        }
    });

    const response = await ecsCredential.send(command);
    const taskArn = response.tasks[0]?.taskArn;

    if (!taskArn) {
        return res.json({ status: 'error', data: { errorMSG: 'Failed to start ECS task' } });
    }

    io.to(`logs:${projectSlug}`).emit('message', { msg: `git cloning`, stage: 2 });

    res.json({
        status: 'queue',
        data: { projectSlug, taskArn, url: `http://${projectSlug}.${BASE_URL}` }
    });

    monitorTaskCompletion(taskArn);
});

async function monitorTaskCompletion(taskArn) {
    subscriber.on('pmessage', async (pattern, channel, message) => {
        try {
            const msg = JSON.parse(message);
            if (msg.termLogs === 'Done' || msg.termLogs === 'sudo kill') {
                console.log(`Stopping task: ${taskArn}`);
                const stopCommand = new StopTaskCommand({
                    cluster: config.CLUSTER,
                    task: taskArn,
                    reason: msg.termLogs === 'Done' ? 'Build completed' : 'Timeout',
                });
                await ecsCredential.send(stopCommand);
                console.log(`Task ${taskArn} stopped`);
            }
        } catch (error) {
            console.log(error);
        }
    });
}

async function initRedisSuscribe() {
    console.log("Subscribed to redis logs");
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message);
        console.log('message');
        console.log(message);
    });
}

initRedisSuscribe();

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

module.exports = app;
module.exports.server = server;
module.exports.io = io;
