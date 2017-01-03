const execa = require('execa');
const path = require('path');
const request = require('request');
const Hapi = require('hapi');
const server = new Hapi.Server();

const CONVERTER_FILE = 'C:/mp4_converter/manual.py';
const ROOT_DIR = 'C:/Users/ben/Projects/cuddly-palm-tree';
const DEST_FOLDER = '/temp/done';
const WEBHOOK_URL = 'https://hooks.slack.com/services/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';

const PROCESSING_QUEUE = [];

server.connection({ port: 3210 });

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply('Hello, world!');
    }
});

server.route({
    method: 'GET',
    path: '/queue/{id}',
    handler: function (request, reply) {
        console.log('Queue ID:', request.params.id);

        const queueItem = PROCESSING_QUEUE.find(x => x.id === parseInt(request.params.id));

        if (queueItem) {
            reply({
                completed: queueItem.status === 2,
                status: queueItem.status,
            });
        } else {
            reply().code(404);
        }
    }
});

server.route({
    method: 'POST',
    path: '/process',
    handler: function (request, reply) {
        console.log('Files:', request.payload.files);

        // Add files to the process queue

        const queueId = Date.now();

        PROCESSING_QUEUE.push({
            id: queueId,
            status: 0,
            files: request.payload.files,
        });

        reply({ id: queueId });
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }

    console.log(`Server running at: ${server.info.uri}`);
});

setInterval(() => {
    console.log('Checking queue...');
    console.log('Current queue:', JSON.stringify(PROCESSING_QUEUE));

    if (PROCESSING_QUEUE.length === 0) {
        return;
    }

    const currentActive = PROCESSING_QUEUE.find(x => x.status === 1) || 0;
    const nextItem = PROCESSING_QUEUE.find(x => x.status === 0);
    
    console.log('currentActive', currentActive);
    console.log('nextItem', nextItem);
    if (currentActive < 1 && nextItem !== undefined) {
        processItem(nextItem);
    }
}, 10000);

function processItem(item) {
    console.log('Item 1:', item);
    item.status = 1;

    function run(arr) {
        if (arr.length === 0) {
            console.log('Item 2:', item);
            item.status = 2;
        } else {
            const i = arr.shift();

            processFile(i).then(() => {
                console.log('Running next file');
                run(arr);
            });
        }
    }

    run(item.files.slice(0));
}

function processFile(file) {
    const filename = path.basename(file);
    const command = `python ${CONVERTER_FILE} -a -i "${ROOT_DIR}${file}" -m "${ROOT_DIR}${DEST_FOLDER}"`;

    console.log('Processing file:', file);

    sendNotification(`Converting: ${filename}`);

    return execa.shell(command).then(result => {
        sendNotification(`Converted: ${filename}`); 
    });
}

function sendNotification(text) {
    request.post(WEBHOOK_URL, {
        json: {
            text
        }
    }, (error, response, body) => {
        if (error) {
            throw Error(error);
        }
    });
}

