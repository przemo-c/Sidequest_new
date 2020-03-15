const { parse } = require('url');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { basename } = require('path');

const TIMEOUT = 60000;

module.exports = function(url, path, progress) {
    const uri = parse(url);
    if (!path) {
        path = basename(uri.path);
    }
    const file = fs.createWriteStream(path);

    return new Promise(function(resolve, reject) {
        const request = (uri.protocol === 'https' ? https : http).get(uri.href).on('response', function(res) {
            const len = parseInt(res.headers['content-length'], 10);
            let downloaded = 0;
            let percent = 0;
            res.on('data', function(chunk) {
                file.write(chunk);
                downloaded += chunk.length;
                percent = Math.round((10000 * downloaded) / len) / 100;
                progress(percent);
            })
                .on('end', function() {
                    file.end();
                    resolve();
                })
                .on('error', function(err) {
                    reject(err);
                });
        });
        request.setTimeout(TIMEOUT, function() {
            request.abort();
            reject(new Error(`request timeout after ${TIMEOUT / 1000.0}s`));
        });
    });
};
