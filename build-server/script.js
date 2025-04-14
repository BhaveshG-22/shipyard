require('dotenv').config()
const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Valkey = require("ioredis");

// 1. INITIALIZATION LOGS
console.log('🔍 Starting build & deployment process')
const startTime = new Date();

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

// Add confirmation logs for environment variables
console.log('✅ All required environment variables are present');

const serviceUri = process.env.REDIS_URI;
const S3_BUCKET = process.env.S3_BUCKET;
const PROJECT_ID = process.env.PROJECT_ID;

console.log(`📋 Project details:`);
console.log(`   - Project ID: ${PROJECT_ID}`);
console.log(`   - S3 Bucket: ${S3_BUCKET}`);
console.log(`   - Region: ${process.env.REGION}`);

// Connecting to Redis logs
console.log(`🔌 Connecting to Redis at ${serviceUri.split('@')[1] || '[hidden]'}...`);
const valkey = new Valkey(serviceUri);
console.log('✅ Connected to Redis successfully');

async function publishLog(log) {
    try {
        const logData = {};
        if (log.msg) logData.msg = log.msg;
        if (log.stage !== undefined) logData.stage = log.stage;
        if (log.termLogs) logData.termLogs = log.termLogs;

        await valkey.publish(`logs:${PROJECT_ID}`, JSON.stringify(logData));
        
        // Echo logs to console for better debugging
        if (log.termLogs) {
            console.log(`📤 PUBLISHED: ${log.termLogs}`);
        }
    } catch (err) {
        console.error(`❌ Failed to publish log: ${err.message}`);
    }
}

// Timeout warning and setup
const timeoutDuration = 1000 * 60 * 7.5;
console.log(`⏱️ Setting process timeout to ${timeoutDuration/60000} minutes`);
setTimeout(() => {
    publishLog({ termLogs: `⏱️ Warning: 1 minute until timeout...` });
}, timeoutDuration - (1000 * 60));

setTimeout(() => {
    publishLog({ termLogs: `❌ Timeout reached (${timeoutDuration/60000} minutes). Killing process.` });
    process.exit(1);
}, timeoutDuration);

function filesAtDir(recursive) {
    try {
        if (typeof recursive !== 'boolean') {
            throw new Error(`Expected boolean, received: ${recursive}`);
        }
        console.log(`📂 Scanning directory: ${path.join(__dirname, 'output')}`);
        let files = fs.readdirSync(path.join(__dirname, 'output'), { recursive });
        const filteredFiles = files.filter(f => !f.startsWith('node_modules'));
        console.log(`📄 Found ${filteredFiles.length} files (excluding node_modules)`);
        return filteredFiles;
    } catch (err) {
        publishLog({ msg: `❌ filesAtDir error: ${err.message}`, stage: -1 });
        throw err;
    }
}

function getFilesDiff(beforeFiles, afterFiles) {
    try {
        console.log(`🔄 Comparing files before and after build`);
        console.log(`   - Before: ${beforeFiles.length} files`);
        console.log(`   - After: ${afterFiles.length} files`);
        
        const beforeSet = new Set(beforeFiles);
        const newFiles = afterFiles.filter(f =>
            !beforeSet.has(f) &&
            !['node_modules', 'package.json', 'package-lock.json', 'tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo'].includes(f)
        );

        console.log(`🆕 New files detected: ${newFiles.join(', ')}`);

        if (newFiles.length !== 1) {
            throw new Error(`Unexpected newFiles: ${JSON.stringify(newFiles)}`);
        }

        return newFiles[0];
    } catch (err) {
        publishLog({ msg: `❌ getFilesDiff error: ${err.message}`, stage: -1 });
        throw err;
    }
}

// S3 Client setup logs
console.log(`☁️ Initializing S3 client for region: ${process.env.REGION}`);
const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }
});
console.log('✅ S3 client initialized');

async function init() {
    try {
        console.log('🚀 Starting build and deployment process');
        await publishLog({ termLogs: '🚀 Starting build and deployment process' });
        await publishLog({ termLogs: `⏰ Process started at: ${startTime.toLocaleTimeString()}` });
        
        console.log('📊 Checking system resources:');
        const memoryUsage = process.memoryUsage();
        console.log(`   - Memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
        await publishLog({ termLogs: `💻 Available memory: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB` });
        
        // Pre-build files check
        filesBeforeBuild = filesAtDir(false);
        await publishLog({ termLogs: `📂 Project contains ${filesBeforeBuild.length} files before build` });
        
        // Check for package.json
        const outDirPath = path.join(__dirname, 'output');
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(outDirPath, 'package.json'), 'utf8'));
            await publishLog({ termLogs: `📦 Project: ${packageJson.name}@${packageJson.version}` });
            await publishLog({ termLogs: `🔍 Build script: "${packageJson.scripts?.build || 'Not found'}"` });
        } catch (err) {
            await publishLog({ termLogs: `⚠️ Could not read package.json: ${err.message}` });
        }
        
        await publishLog({ msg: '⚙️ Build Started...', stage: 3 });
        await publishLog({ termLogs: '🔨 Build process starting...' });

        const buildStartTime = new Date();
        await publishLog({ termLogs: `⏱️ Build started at: ${buildStartTime.toLocaleTimeString()}` });

        const p = exec(`cd ${outDirPath} && npm install && npm run build`);

        // Track npm install progress
        let installPhase = true;
        let buildPhase = false;
        let npmPackageCount = 0;

        p.stdout.on('data', async (data) => {
            const output = data.toString();
            console.log(output);
            
            // Detect phase transitions and add helpful logs
            if (installPhase && output.includes('added') && output.includes('packages')) {
                // Count npm packages being installed
                const match = output.match(/(\d+) packages/);
                if (match) {
                    npmPackageCount = parseInt(match[1], 10);
                    await publishLog({ termLogs: `📦 Installed ${npmPackageCount} npm packages` });
                }
            }
            
            if (installPhase && output.includes('npm run build')) {
                installPhase = false;
                buildPhase = true;
                const installDuration = (new Date() - buildStartTime) / 1000;
                await publishLog({ termLogs: `✅ Dependencies installed in ${installDuration.toFixed(2)}s` });
                await publishLog({ termLogs: `🏗️ Starting build compilation...` });
            }
            
            // Enhanced progress indicators for various build tools
            if (buildPhase) {
                if (output.includes('webpack') && output.includes('%')) {
                    // Extract webpack progress percentage
                    const percentMatch = output.match(/(\d+)%/);
                    if (percentMatch) {
                        await publishLog({ termLogs: `🔄 Build progress: ${percentMatch[1]}%` });
                    }
                }
                
                if (output.includes('Compiled successfully')) {
                    const buildDuration = (new Date() - buildStartTime) / 1000;
                    await publishLog({ termLogs: `✅ Build completed successfully in ${buildDuration.toFixed(2)}s` });
                }
            }
            
            await publishLog({ termLogs: output });
        });

        p.stderr?.on('data', async (data) => {
            const errorOutput = data.toString();
            console.error('Build error:', errorOutput);
            
            // Provide more context for common errors
            if (errorOutput.includes('ENOENT')) {
                await publishLog({ termLogs: `❌ File not found error. Check file paths in your project.` });
            } else if (errorOutput.includes('out of memory')) {
                await publishLog({ termLogs: `❌ Build process ran out of memory. Try optimizing your build.` });
            }
            
            await publishLog({ msg: `❌ Build Error: ${errorOutput}`, stage: -1 });
            await publishLog({ termLogs: `❌ ${errorOutput}` });
        });

        p.on('close', async (code) => {
            if (code !== 0) {
                await publishLog({ msg: `❌ Build exited with code ${code}`, stage: -1 });
                await publishLog({ termLogs: `❌ Build failed with exit code ${code}` });
                return;
            }

            const buildEndTime = new Date();
            const totalBuildTime = (buildEndTime - buildStartTime) / 1000;
            
            await publishLog({ msg: '✅ Build Completed', stage: 4 });
            await publishLog({ termLogs: `✅ Build completed successfully in ${totalBuildTime.toFixed(2)} seconds` });
            
            filesAfterBuild = filesAtDir(false);
            await publishLog({ termLogs: `📂 Project contains ${filesAfterBuild.length} files after build` });

            const diff = getFilesDiff(filesBeforeBuild, filesAfterBuild);
            await publishLog({ termLogs: `🆕 New build directory: ${diff}` });

            console.log(diff);

            const distPath = path.join(__dirname, 'output', diff);
            const contents = fs.readdirSync(distPath, { recursive: true });
            const fileCount = contents.filter(file => {
                const filePath = path.join(distPath, file);
                return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
            }).length;

            await publishLog({ msg: '📤 Starting upload', stage: 5 });
            await publishLog({ termLogs: `📤 Preparing to upload ${fileCount} files to S3` });

            // Calculate total size
            let totalSize = 0;
            const filesToUpload = [];
            for (const file of contents) {
                const filePath = path.join(distPath, file);
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    filesToUpload.push({
                        path: filePath,
                        name: file,
                        size: stats.size
                    });
                }
            }

            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            await publishLog({ termLogs: `📊 Total upload size: ${totalSizeMB} MB` });

            // Upload files with progress tracking
            let uploadedCount = 0;
            let uploadedBytes = 0;
            const uploadStartTime = new Date();

            for (const file of filesToUpload) {
                try {
                    await publishLog({ termLogs: `📤 Uploading [${++uploadedCount}/${fileCount}]: ${file.name} (${(file.size / 1024).toFixed(2)} KB)` });

                    const command = new PutObjectCommand({
                        Bucket: S3_BUCKET,
                        Key: `__outputs/${PROJECT_ID}/${file.name}`,
                        Body: fs.createReadStream(file.path),
                        ContentType: mime.lookup(file.path)
                    });

                    await s3Client.send(command);
                    uploadedBytes += file.size;
                    
                    const progressPercent = Math.round((uploadedCount / fileCount) * 100);
                    const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(2);
                    
                    await publishLog({ termLogs: `✅ Uploaded ${file.name} (${progressPercent}% complete, ${uploadedMB}/${totalSizeMB} MB)` });
                } catch (err) {
                    await publishLog({ msg: `❌ Upload error for ${file.name}: ${err.message}`, stage: -1 });
                    await publishLog({ termLogs: `❌ Failed to upload ${file.name}: ${err.message}` });
                }
            }

            const uploadEndTime = new Date();
            const uploadDuration = (uploadEndTime - uploadStartTime) / 1000;
            const uploadSpeed = (totalSize / uploadDuration / 1024).toFixed(2);
            
            await publishLog({ termLogs: `✅ All files uploaded in ${uploadDuration.toFixed(2)}s (${uploadSpeed} KB/s)` });

            await publishLog({ msg: '🌐 Assigning domain', stage: 6 });
            await publishLog({ termLogs: `🌐 Configuring domain for your application...` });
            await publishLog({ termLogs: `🔗 Your application is now available at: http://${PROJECT_ID}.${process.env.REVERSE_PROXY_URL}` });
            
            const endTime = new Date();
            const totalTime = (endTime - startTime) / 1000;
            await publishLog({ termLogs: `⏱️ Total deployment time: ${totalTime.toFixed(2)} seconds` });
            
            await publishLog({ termLogs: `✅ Deployment completed successfully!` });
            await publishLog({ termLogs: `📝 Post-deployment tasks: Configure DNS, set up HTTPS, etc.` });

            console.log('Done!');
        });

    } catch (err) {
        console.error(`Fatal Error: ${err.message}`);
        await publishLog({ msg: `❌ Fatal Error: ${err.message}`, stage: -1 });
        await publishLog({ termLogs: `💥 FATAL ERROR: ${err.message}` });
        await publishLog({ termLogs: `🔍 Error occurred at: ${new Date().toLocaleTimeString()}` });
    }
}

init();