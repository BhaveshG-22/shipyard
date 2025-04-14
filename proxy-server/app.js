require('dotenv').config()
const express = require('express')
const httpProxy = require('http-proxy')

const app = express()

// http://400.localhost:9001/react-gh-pages/static/js/main.8ed17e14.js ---> wrong link
// http://400.localhost:9001/static/js/main.8ed17e14.js ---> right link
// https://awslink.s3.us-east-2.amazonaws.com/__outputs/400/static/js/main.8tn17e14.js


const proxy = httpProxy.createProxy()
const port = process.env.PORT;
const BASE_PATH = process.env.BASE_PATH;
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN || 'shipyard.bhaveshg.dev';


app.use((req, res) => {



    const hostHeader = req.headers['host'];
    const subdomain = hostHeader ? hostHeader.split('.')[0] : 'default';


    if (subdomain == hostHeader) {

        res.send(`
      <html>
        <head>
          <title>Proxy Server Status</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
            .status { color: green; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Proxy Server Status</h1>
          <p class="status">Server is alive!</p>
          <p>You accessed this server from: <strong>${hostHeader}</strong></p>

          <h2>How to use this proxy:</h2>
          <p>Access your project using the subdomain pattern: <pre><em>project-id</em>.${PRIMARY_DOMAIN}</pre></p>
          <p>For example: <pre>it-works-my-fam.${PRIMARY_DOMAIN}</pre></p>
          <p>This will proxy to: <pre>${BASE_PATH}/it-works-my-fam/</pre></p>
        </body>
      </html>
    `);
    }

    console.log('hostHeader--->', 'subdomain');
    console.log(hostHeader, subdomain);


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
    console.log('url');
    console.log(url);

    if (url == '/') {
        proxyReq.path += 'index.html'
    }

    return proxyReq
})


app.listen(port, () => console.log(`Reverse Proxy Running on port ${port}`));
