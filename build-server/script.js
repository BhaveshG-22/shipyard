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
    throw new Error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
}


const serviceUri = process.env.REDIS_URI;
const S3_BUCKET = process.env.S3_BUCKET;
const valkey = new Valkey(serviceUri);



//function to kill container if it runs for more thsn 7.5 minutes
setTimeout(() => {
    publishLog({ termLogs: `sudo kill` })
}, 1000 * 60 * 7.5) // 7.5 minutes

async function publishLog(log) {
    // console.log('Logs Publishing Start: ', log);

    const logData = {};

    if (log.msg !== undefined) logData.msg = log.msg;
    if (log.stage !== undefined) logData.stage = log.stage;
    if (log.termLogs !== undefined) logData.termLogs = log.termLogs;

    await valkey.publish(`logs:${PROJECT_ID}`, JSON.stringify(logData));
}


function filesAtDir(recursive) {
    if (typeof recursive !== 'boolean') {
        throw new Error(`FilesAtDir: incorrect argument received, expected boolean but received: ${recursive}`);
    }
    let files = fs.readdirSync(path.join(__dirname, 'output'), { recursive: recursive })
    console.log(files);
    console.log(`files.length ${files.length}`);


    files = [...files].filter((file) => {
        let parent = file.split('/')[0]

        return parent !== 'node_modules'
    })

    return files
}

function getFilesDiff(beforeFiles, afterFiles) {

    let newFiles = new Set()
    const beforeFilesSet = new Set(beforeFiles)
    const afterFilesSet = new Set(afterFiles)

    newFiles = [...afterFiles].filter((file) => {

        if (file == 'node_modules') {
            return
        }
        if (file == 'package.json') {
            return
        }
        if (file == 'package-lock.json') {
            return
        }
        if (file == 'tsconfig.app.tsbuildinfo') {
            return
        }
        if (file == 'tsconfig.node.tsbuildinfo') {
            return
        }

        if (!beforeFilesSet.has(file)) {
            return file
        }
    })

    if (newFiles.length !== 1) {
        console.log(newFiles);

        throw new Error("newFiles present which was not expected");
    }

    return newFiles[0]
}

let filesBeforeBuild;
let filesAfterBuild;

const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        accessKeyId: process.env.ACCESS_KEY_ID,
    }
})

const PROJECT_ID = process.env.PROJECT_ID


async function cleanupDocker() {
    console.log("Stopping and removing Docker container...");
    exec(`docker stop <container_id_or_name> && docker rm <container_id_or_name>`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error stopping container: ${stderr}`);
        } else {
            console.log(`Container stopped and removed: ${stdout}`);
        }
    });
}

async function init() {
    console.log('Executing script.js')
    filesBeforeBuild = filesAtDir(false)
    publishLog({ msg: 'Build Started...', stage: 3 })
    const outDirPath = path.join(__dirname, 'output')

    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', function (data) {
        console.log(data.toString())
        publishLog({ termLogs: data.toString() })

    })

    p.stdout.on('error', function (data) {
        console.log('Error', data.toString())
        publishLog({ msg: `Error ${data.toString()}`, stage: -1 })

    })

    p.on('close', async function () {
        console.log('Build Complete')
        publishLog({ msg: 'Build Completed', stage: 4 })




        filesAfterBuild = filesAtDir(false)

        console.log("filesBeforeBuild");
        console.log(filesBeforeBuild);
        console.log(filesBeforeBuild.length);

        console.log("filesAfterBuild");
        console.log(filesAfterBuild);
        console.log(filesAfterBuild.length);

        let diff = getFilesDiff(filesBeforeBuild, filesAfterBuild)
        console.log("diff----------------->");
        console.log(diff);
        console.log(diff.length);

        console.log("filesAtDir(true)");
        console.log(filesAtDir(true));


        const distFolderPath = path.join(__dirname, 'output', diff)
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

        publishLog({ msg: 'Starting to upload', stage: 5 })

        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file)
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('uploading', filePath)
            publishLog({ termLogs: `uploading ${file}` })


            const command = new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })
            await s3Client.send(command)
            publishLog({ termLogs: `uploaded ${file}` })
            console.log('uploaded', filePath)
        }
        publishLog({ msg: 'Assigning Domain', stage: 6 })
        publishLog({ termLogs: `Visit http://${process.env.PROJECT_ID}.${process.env.REVERSE_PROXY_URL}` })
        publishLog({ termLogs: `Done` })


        console.log('Done...');
        console.log(`Visit http://${process.env.PROJECT_ID}.${process.env.REVERSE_PROXY_URL}`);



        await cleanupDocker();

    })
}

init()








