require('dotenv').config()
const express = require('express')
const httpProxy = require('http-proxy')

const app = express()

// http://400.localhost:9001/react-gh-pages/static/js/main.8ed17e14.js ---> wrong link
// http://400.localhost:9001/static/js/main.8ed17e14.js ---> right link
// https://awslink.s3.us-east-2.amazonaws.com/__outputs/400/static/js/main.8tn17e14.js


const proxy = httpProxy.createProxy()

app.get('/', (req, res) => {
    res.send('Server is alive!');
});


app.use((req, res) => {


    const hostHeader = req.headers['host'];
    const subdomain = hostHeader ? hostHeader.split('.')[0] : 'default';

    console.log(subdomain);

    if (req.url.includes('/react-gh-pages/')) {
        req.url = req.url.replace('/react-gh-pages', '');
    }

    const resolvesTo = `${process.env.BASE_PATH}/${subdomain}`
    console.log('resolvesTo');
    console.log(resolvesTo);

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url == '/') {
        proxyReq.path += 'index.html'
    }

    return proxyReq
})


app.listen(9001, () => console.log(`Reverse Proxy Running on port `));
