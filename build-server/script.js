const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const dotenv = require('dotenv');
const { Kafka } = require('kafkajs');
dotenv.config();

const s3Client = new S3Client({
    region: '',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY_ID
    }
})

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID;

const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
    brokers: [''],
    ssl: {
        ca: [ fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        username: 'process.env.SASL_USERNAME',
        password: 'process.env.SASL_PASSWORD',
        mechanism: 'process.env.SASL_MECHANISM'
    }
})

const producer = kafka.producer()

async function publishLog(log){
    await producer.send({topic: `container-logs`, messages: [{key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYEMENT_ID, log})}]})
}

async function init() {

    await producer.connect()

    console.log("Executing script.js");
    await publishLog('Build Started...');
    const outDirPath = path.join(__dirname, 'output');
  
    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', async function (data) {
        await publishLog(data.toString());
        console.log(data.toString());
    })

    p.stdout.on('error', async function (data) {
        await publishLog(`error: ${data.toString()}`);
        console.log("Error", data.toString());
    })

    p.on('close', async function() {
        await publishLog('Build Complete');
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
        await publishLog("Done!");
        console.log('Done!');
        process.exit(0);
    }) 

}

init();