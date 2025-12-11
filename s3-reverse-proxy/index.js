const express = require('express');
const httpProxy = require('http-proxy');

const app = express();
const PORT = 8000;
const prisma  = require('../api-server/index.js');
const BASE_PATH = ''


const proxy = httpProxy.createProxy();

app.use(async (req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    const project = await prisma.project.findFirst({
        where: { subDomain: subdomain },
        select: { id: true }
    })

    const resolvesTo = `${BASE_PATH}/${project.id}`

    proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})

proxy.on('proxyReq',(proxyReq, req, res) => {
    const url = req.url;
    if(url == '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log(`Reverse proxy Running...${PORT}`))