require('dotenv').config()
const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const port = process.env.PORT || PORT;

// http://400.localhost:9001/react-gh-pages/static/js/main.8ed17e14.js ---> wrong link
// http://400.localhost:9001/static/js/main.8ed17e14.js ---> right link
// https://bg-vercel-clone-7.s3.us-east-2.amazonaws.com/__outputs/400/static/js/main.8ed17e14.js


const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    console.log(subdomain);

    // http://3091.localhost:9001/index.html
    // subdomain=3091

    // Custom Domain - DB Query

    const resolvesTo = `${process.env.BASE_PATH}/${subdomain}`
    console.log('resolvesTo');
    console.log(resolvesTo);

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url == '/') {
        proxyReq.path += 'index.html '
    }

    return proxyReq
})


app.listen(port, () => console.log(`Reverse Proxy Running on port ${port}`));
