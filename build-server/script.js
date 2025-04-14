require('dotenv').config()
const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Valkey = require("ioredis");

const requiredEnvVars = [
    'REDIS_URI',
    'S3_BUCKET',
    'ACCESS_KEY_ID',
    'SECRET_ACCESS_KEY',
    'REGION',
    'PROJECT_ID',
    'REVERSE_PROXY_URL'
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
    const errMsg = `❌ Missing required environment variables: ${missingEnvVars.join(', ')}`;
    console.error(errMsg);
    process.exit(1);
}

const serviceUri = process.env.REDIS_URI;
const S3_BUCKET = process.env.S3_BUCKET;
const valkey = new Valkey(serviceUri);
const PROJECT_ID = process.env.PROJECT_ID;

async function publishLog(log) {
    try {
        const logData = {};
        if (log.msg) logData.msg = log.msg;
        if (log.stage !== undefined) logData.stage = log.stage;
        if (log.termLogs) logData.termLogs = log.termLogs;

        await valkey.publish(`logs:${PROJECT_ID}`, JSON.stringify(logData));
    } catch (err) {
        console.error(`❌ Failed to publish log: ${err.message}`);
    }
}

setTimeout(() => {
    publishLog({ termLogs: `❌ Timeout reached. Killing process.` });
    process.exit(1);
}, 1000 * 60 * 7.5);

function filesAtDir(recursive) {
    try {
        if (typeof recursive !== 'boolean') {
            throw new Error(`Expected boolean, received: ${recursive}`);
        }
        let files = fs.readdirSync(path.join(__dirname, 'output'), { recursive });
        return files.filter(f => !f.startsWith('node_modules'));
    } catch (err) {
        publishLog({ msg: `❌ filesAtDir error: ${err.message}`, stage: -1 });
        throw err;
    }
}

function getFilesDiff(beforeFiles, afterFiles) {
    try {
        const beforeSet = new Set(beforeFiles);
        const newFiles = afterFiles.filter(f =>
            !beforeSet.has(f) &&
            !['node_modules', 'package.json', 'package-lock.json', 'tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo'].includes(f)
        );

        if (newFiles.length !== 1) {
            throw new Error(`Unexpected newFiles: ${JSON.stringify(newFiles)}`);
        }

        return newFiles[0];
    } catch (err) {
        publishLog({ msg: `❌ getFilesDiff error: ${err.message}`, stage: -1 });
        throw err;
    }
}

const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }
});

async function init() {
    try {
        console.log('🚀 Executing script.js');
        filesBeforeBuild = filesAtDir(false);
        await publishLog({ msg: '⚙️ Build Started...', stage: 3 });

        const outDirPath = path.join(__dirname, 'output');

        const p = exec(`cd ${outDirPath} && npm install && npm run build`);

        p.stdout.on('data', async (data) => {
            console.log(data.toString());
            await publishLog({ termLogs: data.toString() });
        });

        p.stderr?.on('data', async (data) => {
            console.error('Build error:', data.toString());
            await publishLog({ msg: `❌ Build Error: ${data.toString()}`, stage: -1 });
        });

        p.on('close', async (code) => {
            if (code !== 0) {
                await publishLog({ msg: `❌ Build exited with code ${code}`, stage: -1 });
                return;
            }

            await publishLog({ msg: '✅ Build Completed', stage: 4 });
            filesAfterBuild = filesAtDir(false);

            const diff = getFilesDiff(filesBeforeBuild, filesAfterBuild);

            console.log(diff);

            const distPath = path.join(__dirname, 'output', diff);
            const contents = fs.readdirSync(distPath, { recursive: true });

            await publishLog({ msg: '📤 Starting upload', stage: 5 });

            for (const file of contents) {
                const filePath = path.join(distPath, file);
                if (fs.lstatSync(filePath).isDirectory()) continue;

                try {
                    await publishLog({ termLogs: `Uploading ${file}` });

                    const command = new PutObjectCommand({
                        Bucket: S3_BUCKET,
                        Key: `__outputs/${PROJECT_ID}/${file}`,
                        Body: fs.createReadStream(filePath),
                        ContentType: mime.lookup(filePath)
                    });

                    await s3Client.send(command);
                    await publishLog({ termLogs: `✅ Uploaded ${file}` });
                } catch (err) {
                    await publishLog({ msg: `❌ Upload error for ${file}: ${err.message}`, stage: -1 });
                }
            }

            await publishLog({ msg: '🌐 Assigning domain', stage: 6 });
            await publishLog({ termLogs: `Visit http://${PROJECT_ID}.${process.env.REVERSE_PROXY_URL}` });
            await publishLog({ termLogs: `✅ Done` });

            console.log('Done!');
        });

    } catch (err) {
        console.error(`Fatal Error: ${err.message}`);
        await publishLog({ msg: `❌ Fatal Error: ${err.message}`, stage: -1 });
    }
}

init();
