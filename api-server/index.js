const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const dotenv = require('dotenv');
const Redis = require('ioredis');
const { Server } = require('socket.io');
dotenv.config();

const app = express();
const PORT = 9000;

const subscriber = new Redis("rediss://default:AZStAAIncDIxNThmZWY4ZjMyMzU0MzM3OGU5ZjlmNWM1NzhmNWRkZnAyMzgwNjE@chief-elephant-38061.upstash.io:6379");

const io = new Server({ cors: '*' });

io.on('connection', socket => {
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

app.post('/project', async (req, res) => {
    const { gitUrl, slug } = req.body;
    const projectSlug = slug ? slug : generateSlug();

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
                        { name: 'GIT_REPOSITORY_URL', value: gitUrl },
                        { name: 'PROJECT_ID', value: projectSlug }
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