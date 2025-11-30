const express = require('express');
const httpProxy = require('http-proxy');

const app = express();
const PORT = 8000;

const BASE_PATH = 'https://buildspace-vercel-clone.s3.eu-north-1.amazonaws.com/__outputs'

const proxy = httpProxy.createProxy();

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    const resolvesTo = `${BASE_PATH}/${subdomain}`

    proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})

proxy.on('proxyReq',(proxyReq, req, res) => {
    const url = req.url;
    if(url == '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log(`Reverse proxy Running...${PORT}`))