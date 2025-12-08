const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');
const Redis = require('ioredis');
const { Server } = require('socket.io');
const { z } = require('zod');
const { PrismaClient } = require('./generated/prisma/client')
dotenv.config();

const prisma = new PrismaClient({});
const app = express();
const PORT = 9000;

const subscriber = new Redis("rediss://default:AZStAAIncDIxNThmZWY4ZjMyMzU0MzM3OGU5ZjlmNWM1NzhmNWRkZnAyMzgwNjE@chief-elephant-38061.upstash.io:6379");

const io = new Server({ cors: '*' });

io.on('connection', (socket) => {
    socket.on('subscribe', channel => {
        socket.join(channel)
        socket.emit('message', `Joined ${channel}`)
    })
})

io.listen(9002, () => console.log(`Socket server is listening at port 9002`))

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

    return res.json({ status: 'queued', data: { projectSlug, url:`http://${projectSlug}.localhost:8000` } })

})

async function initRedisSubscribe(){
    console.log('Subscribed to logs...')
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {
        console.log(`[${channel}] ${message}`);
        io.to(channel).emit('message', message); 
    })
}

initRedisSubscribe();

app.listen(PORT, () => {console.log(`API server Running...${PORT}`)});