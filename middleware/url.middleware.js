import fs from 'fs';

export function logResAndRes(filename) {
    const logStream = fs.createWriteStream(filename, {
        flags: "a"
    });
    return (req, res, next) => {
        const currentTimestamp = new Date();
        res.on('finish', () => {
            const log = {
                timestamp: currentTimestamp.toString(),
                responseTime: `${Date.now() - currentTimestamp} ms`,
                url: req.originalUrl,
                method: req.method,
                request: req.body,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage
            };
            logStream.write(JSON.stringify(log) + '\n')

        });
        next();
    }

}
