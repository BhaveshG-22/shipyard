const express = require('express')
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');

const cors = require('cors');
const app = express()
const server = http.createServer(app);
require('dotenv').config()

app.use((req, res, next) => {
    console.log(`🌐 Incoming request from: ${req.headers.origin}`);
    next();
});

const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
console.log(`allowedOrigins: ${allowedOrigins}`)

const io = socketIO(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
    }
});




const PORT = process.env.PORT
const BASE_URL = process.env.BASE_URL
const REDIS_SERVICE_URL = process.env.REDIS_SERVICE_URL
const S3_BUCKET = process.env.S3_BUCKET
const AWS_REGION = process.env.AWS_REGION
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const ACCESSKEY_KEY_ID = process.env.ACCESSKEY_KEY_ID
const AWS_CLUSTER_ID = process.env.AWS_CLUSTER_ID
const AWS_TASK_ID = process.env.AWS_TASK_ID

const AWS_SUBNETS = process.env.AWS_SUBNETS
const AWS_SUBNETS_ARRAY = AWS_SUBNETS ? AWS_SUBNETS.split(',') : [];

const AWS_SECURITY_GROUP = process.env.AWS_SECURITY_GROUP
const AWS_SECURITY_GROUP_ARRAY = AWS_SECURITY_GROUP ? AWS_SECURITY_GROUP.split(',') : [];

const AWS_ECR_IMAGE = process.env.AWS_ECR_IMAGE


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



const { generateSlug } = require("random-word-slugs")
const { ECSClient, RunTaskCommand, StopTaskCommand } = require('@aws-sdk/client-ecs')
const Valkey = require("ioredis");




app.use(express.json())

const subscriber = new Valkey(REDIS_SERVICE_URL);
// const io = new Server({ cors: '*' })
let channelName



io.on('connection', socket => {
    socket.on('subscribe', channel => {
        console.log(`request to join channel ${channel}`);
        socket.join(channel)
        channel && socket.emit('message', { 'msg': `request in queue`, 'stage': 1 })
    })


    socket.on('disconnect', (channel) => {
        console.log(`request to disconnect channel ${channel}`);
        let attemptsToJoin = 5
        let currentAttempt = 0;

        while (currentAttempt <= attemptsToJoin) {
            try {
                socket.join(channel)
            } catch (error) {
                console.error(`ERROR RECONNECTING to ${channel}`);
                console.error(`${attemptsToJoin - currentAttempt} Attempts Left`);

            }

            currentAttempt = currentAttempt + 1
        }

    })


})



const ecsCredential = new ECSClient({
    region: AWS_REGION,
    credentials: {
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        accessKeyId: ACCESSKEY_KEY_ID,
    }
})

const config = {
    CLUSTER: AWS_CLUSTER_ID,
    TASK: AWS_TASK_ID
}

app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server Status</title>
          <style>
            body {
              background-color: #f4f4f4;
              font-family: Arial, sans-serif;
              text-align: center;
              margin-top: 100px;
            }
            .status {
              color: green;
              font-size: 2rem;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="status">✅ Server is Online</div>
        </body>
      </html>
    `);
});


app.get('/repo-folders', async (req, res) => {
    const repoUrl = req.query.repoUrl; // ?repoUrl=https://github.com/BhaveshG-22/shipyard
    if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

    const repoPath = repoUrl.replace('https://github.com/', '');
    const [owner, repo] = repoPath.split('/');

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`);
        const folders = response.data
            .filter(item => item.type === 'dir')
            .map(item => item.name);

        res.json({ folders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});


app.post('/', async (req, res) => {
    if (!req.body.gitURL || !req.body.folder) {
        return res.json({
            status: 'error',
            data: { errorMSG: `gitURL OR folder missing in req body received ${req.body}` }
        });
    }

    console.log('Request received');

    const projectSlug = generateSlug();
    const { gitURL, folder } = req.body;

    // Spin the container 
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
    const taskArn = response.tasks[0]?.taskArn;  // Capture the task ARN

    if (!taskArn) {
        return res.json({ status: 'error', data: { errorMSG: 'Failed to start ECS task' } });
    }

    console.log(`Started Task: ${taskArn}`);

    // Emit message after starting task
    io.to(`logs:${projectSlug}`).emit('message', { msg: `git cloning`, stage: 2 });

    res.json({
        status: 'queue',
        data: { projectSlug, taskArn, url: `http://${projectSlug}.${BASE_URL}` }
    });

    // Monitor completion and stop the task
    monitorTaskCompletion(taskArn);
});

// Function to stop the ECS task after completion
async function monitorTaskCompletion(taskArn) {
    subscriber.on('pmessage', async (pattern, channel, message) => {
        const msg = JSON.parse(message);
        try {
            if (msg.termLogs === 'Done') {  // Assume "done" means task completed
                console.log(`Stopping task: ${taskArn}`);

                const stopCommand = new StopTaskCommand({
                    cluster: config.CLUSTER,
                    task: taskArn, // Use the correct task ARN
                    reason: "Build completed"
                });

                await ecsCredential.send(stopCommand);
                console.log(`Task ${taskArn} stopped`);
            } else if (msg.termLogs === 'sudo kill') {  // Assume "sudo kill" means task took too long ,time to destroy container and spin new one : TODO-spin new one once this stops
                console.log(`Stopping task: ${taskArn}`);

                const stopCommand = new StopTaskCommand({
                    cluster: config.CLUSTER,
                    task: taskArn, // Use the correct task ARN
                    reason: "Task took more then 10 mins to complete"
                });

                await ecsCredential.send(stopCommand);
                console.log(`Task ${taskArn} stopped`);
            }
        } catch (error) {
            console.log(error);

        }
    });
}







server.listen(PORT, () => {
    console.log(`Server running with Express + Socket.IO on port ${PORT}`);
});



async function initRedisSuscribe() {
    console.log("Subscribed to redis logs");
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
        console.log('message');
        console.log(message);

    })
}

initRedisSuscribe()

