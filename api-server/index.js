const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const {v4: uuidv4} = require('uuid');
const { PrismaClient } = require('./generated/prisma/client');
const { createClient } = require('@clickhouse/client');
const { Kafka } = require('kafkajs');
dotenv.config();

module.exports = prisma = new PrismaClient({
    accelerateUrl: process.env.ACCELERATE_URL
})
const app = express();
const PORT = 9000;

const kafka = new Kafka({
    clientId: `api-server`,
    brokers: ['kafka-1294ff1-chaitanyarathi91-621c.d.aivencloud.com:14027'],
    ssl: {
        ca: [ fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        username: 'avnadmin',
        password: 'AVNS_yJnX8lMpmR7Trf4s3h0',
        mechanism: 'plain'
    }
});

const client = createClient({
    host: 'https://avnadmin:AVNS_pzbwg8rXs9YvCJQ45Ak@clickhouse-3831f89c-chaitanyarathi91-621c.c.aivencloud.com:14015',
    database: 'buildspace-vercel-clone',
    username: 'avnadmin',
    password: 'AVNS_pzbwg8rXs9YvCJQ45Ak'
});

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer'})

const ecsClient = new ECSClient({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY_ID
    }
})

const config = {
    CLUSTER: process.env.CLUSTER_ARN,
    TASK: process.env.TASK_ARN
}

app.use(express.json());

app.get('/logs/:id', async (req, res) => {
    const id = req.params.id;
    const logs = await client.query({
        query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
        query_params: {
            deployment_id: id
        },
        format: "JSONEachRow"
    })

    const rawLogs = await logs.json();

    return res.json({ rawLogs });
})

app.post('/project', async (req,res)=> {
    const schema = z.object({
        name: z.string(),
        gitUrl: z.string()
    })
    const safeParseResult = schema.safeParse(req.body);
    
    if(safeParseResult.error) return res.status(400).json({ error: safeParseResult.error });
    
    const {name, gitUrl} = safeParseResult.data;

    const project = await prisma.project.create({
        data: {
            name,
            gitUrl,
            subDomain: generateSlug()
        }
    }) 

    return res.json({ status: 'success', data: { project } })

})

app.post('/deploy', async (req, res) => {
    const { projectId } = req.body;
    
    const project = await prisma.project.findUnique({
        where: { id: projectId }
    })

    if(!project) return res.status(404).json({ error: 'Project not found' })
    
    const deployement = await prisma.deployement.create({
        data:{
            project: {connect: { id: projectId }},
            status: 'QUEUED'
        }
    })
    console.log('db done');
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE', 
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0bd8453ed958ffd08','subnet-0abff033857c9c12c','subnet-0a62a0cc8342b2980'],
                securityGroups: ['sg-0fc91e4539c0b567d']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY_URL', value: project.gitUrl },
                        { name: 'PROJECT_ID', value: projectId },
                        { name: 'DEPLOYEMENT_ID', value: deployement.id }
                    ]
                }
            ]
        }
    });
    await ecsClient.send(command);

    return res.json({ status: 'queued', data: {deployement: deployement.id } })

})

async function initKafkaConsumer(){
    await client.ping();
    console.log("CLICKHOUSE CONNECTED!");
    await consumer.connect();
     console.log('CONNECTED');
    await consumer.subscribe({ topics: ['container-logs']});
    console.log('inside kafka');
    await consumer.run({
        autoCommit: false,
        eachBatch: async function ({batch, heartbeat, commitOffsetsIfNecessary,resolveOffset}) {
            const messages = batch.messages;
            console.log(`Recv ${messages.length} messages..`)
            for(const message of messages) {
                const stringMessage = message.value.toString()
                const { PROJECT_ID, DEPLOYEMENT_ID,  log } = JSON.parse(stringMessage);
                console.log(PROJECT_ID," ", DEPLOYEMENT_ID," ", log);
                try {
                    const { query_id } = await client.insert({
                        table: 'log_events',
                        values: [{ event_id: uuidv4(), deployment_id: DEPLOYEMENT_ID, log}],
                        format: 'JSONEachRow'
                    })
                    console.log(query_id);
                    resolveOffset(message.offset);
                    await commitOffsetsIfNecessary(message.offset);
                    await heartbeat();
                } catch (error) {
                    console.log("ERRORRRRRR:",error);
                }
            }
        }
    }) 
}

initKafkaConsumer();

app.listen(PORT, () => {console.log(`API server Running...${PORT}`)});