const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const dotenv = require('dotenv');
const Redis = require('ioredis');
dotenv.config();

const publisher = new Redis("rediss://default:AZStAAIncDIxNThmZWY4ZjMyMzU0MzM3OGU5ZjlmNWM1NzhmNWRkZnAyMzgwNjE@chief-elephant-38061.upstash.io:6379");

const s3Client = new S3Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY_ID
    }
})

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log){
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
    console.log("Executing script.js");
    publishLog('Build Started...');
    const outDirPath = path.join(__dirname, 'output');
  
    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', function (data) {
        publishLog(data.toString());
        console.log(data.toString());
    })

    p.stdout.on('error', function (data) {
        publishLog(`error: ${data.toString()}`);
        console.log("Error", data.toString());
    })

    p.on('close', async function() {
        publishLog('Build Complete');
        console.log('Build Complete');
        const distFolderPath = path.join(__dirname, 'output', 'dist');
        const distFolderContents = fs.readdirSync(distFolderPath, {recursive: true} )  //["index.html","assets","assets/app.js","assets/style.css"]
 
        for(const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file);
            if(fs.lstatSync(filePath).isDirectory()) continue;
            
            publishLog(`uploading ${file}`);
            console.log("uploading", filePath);

            const command = new PutObjectCommand({
                Bucket: 'buildspace-vercel-clone',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) // tells browser how to interpret the file like js,html
            })

            await s3Client.send(command);

            publishLog(`uploaded ${file}`);
            console.log("uploaded", filePath);

        }
        publishLog("Done!");
        console.log('Done!');
        publisher.disconnect();
    }) 

}

init();