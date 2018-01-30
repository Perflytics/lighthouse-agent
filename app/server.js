#!/usr/bin/env node
/**
 * Created by klingac on 27.11.17.
 */
const lighthouse = require('lighthouse');
const log = require('lighthouse-logger');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const debug = require('debug')('perflytics'); // TODO not used?
const argparse = require('yargs-parser');
const winston = require('winston');
const stringify = require('json-stringify-safe');
const path = require('path'); // TODO not used?
const amqp = require('amqplib');
const argv = require('yargs')
    .usage('Run lighthouse configured by JSON file')
    .example('$0', 'Run lighthouse script')
    .alias('o', 'output-dir').describe('o', 'Output directory')
    .default('o', arg => arg ? arg : __dirname)
    .alias('v', 'verbose').describe('v', 'Verbose output')
    .alias('i', 'input')
    .describe('i', 'Input file with tests definitions')
    .coerce('i', function (arg) {
        return JSON.parse(fs.readFileSync(arg, 'utf8'));
    })
    .alias('q', 'queue')
    .describe('q', 'Queue name')
    .implies('q', 'w')
    .conflicts('q', 'i')
    .alias('w', 'work-queue')
    .describe('w', 'AMQP URI from which will tasks be provided. See examples here: https://www.rabbitmq.com/uri-spec.html')
    .conflicts('w', 'i')
    .implies('w', 'q')
    .check(function (argv) {
        if (argv.i && argv.w) {
            throw(new Error('Argument check failed: You cannot setup both input file and MQ'));
        } else {
            return true;
        }
    })
    .help('h').alias('h', 'help')
    .argv;

const outputDir = argv.o;

const tsFormat = () => (new Date()).toLocaleTimeString();
const logger = new winston.Logger({
    level: 'info',
    transports: [
        new (winston.transports.Console)({
            colorize: true,
            timestamp: tsFormat,
        }),
        new (winston.transports.File)({
            filename: `${outputDir}/agent.log`,
            json: false,
            timestamp: tsFormat,
        })
    ]
});

const defaultLighthouseOptions = {
    logLevel: 'info',
    disableStorageReset: false,
    disableDeviceEmulation: false,
    disableCpuThrottling: false,
    disableNetworkThrottling: false,
    saveAssets: false,
    saveArtifacts: false,
    maxWaitForLoad: 45000,
    enableErrorReporting: false
};

const defaultChromeFlags = ['--headless', '--disable-gpu', '--no-sandbox'];

log.setLevel(defaultLighthouseOptions.logLevel); // exported by lighthouse-logger module


async function launchChrome(flags = {}) {
    return chromeLauncher.launch({chromeFlags: flags.chromeFlags});
}

/* logs Lighthouse internal events */
async function registerLighthouseListener(event, reportStatusLog) {
    let writeStream = await fs.createWriteStream(reportStatusLog);
    writeStream.on('open', (fd) => {
        log.events.addListener(event, (data) => {
            writeStream.write(data.join(' ') + "\n");
        });
    });
    writeStream.on('error', function (err) {
        console.error(err);
    });

    return writeStream;
}

function writeResultsToFile(resultFile, results) {
    fs.writeFileSync(resultFile, results, (err) => {
        if (err) {
            logger.error('Cannot write report to file ', resultFile);
            logger.error(err);
        }
    });
    logger.info('The result was saved to %s', resultFile);
}

async function createLockFile(fileName) {
    return fs.openSync(fileName, 'a');
}

function deleteLockFile(fileName) {
    fs.unlinkSync(fileName);
    logger.info(`Deleting lockfile ${fileName}`);
}

async function getReportOptions() {
    let options;

    if (argv.i) {
        logger.info(`Using options from input file`);
        options = argv.i;
    }

    if (argv.w) {
        logger.info(`Getting options from WorkQueue ${argv.q} in ${argv.w}`);
        try {
            options = await getReportOptionsFromMQ()
                .then((response) => {
                    return JSON.parse(response);
                })
                .catch(logger.error);
            if (options === null) {
                process.exit(0);
            }
        } catch (e) {
            logger.error(e);
        }
    }

    return options;
}

async function getReportOptionsFromMQ() {
    logger.info(`Connecting to AMQP server ${argv.w}`);
    let repOptions = amqp.connect(argv.w)
        .then(function (conn) {
            logger.info('Connection to AMQP success');
            return conn.createChannel();
        })
        .then(function (channel) {
            logger.info('Channel created');
            return channel.assertQueue(argv.q, {durable: true})
                .then(function () {
                    logger.info(`Using queue ${argv.q}`);
                    // channel.prefetch(1);
                    return channel;
                })
                .catch(logger.error);
        })
        .then(function (channel) {
            logger.info('Trying to get message');
            return channel.get(argv.q, {noAck: true});
        })
        .then(task => {
            if (!task) {
                logger.info('No messages in queue');
                return null;
                // throw new Error('No messages in queue');
            }
            else {
                let message = task.content.toString();
                logger.info(`We get 1 message. Messages left ${task.fields.messageCount}`);
                return message;
            }
        })
        .catch(logger.error);

    return repOptions;
}

async function processTargets(reportOptions, reportDir, lighthouseOptions) {
    for (let target of reportOptions.targets) {
        let reportPageID = target.id;
        let reportPageURL = target.url;
        let resultFile = `${reportDir}/${reportPageID}.json`;
        let reportStatusLog = `${reportDir}/${reportPageID}.status`;
        let reportWarnLog = `${reportDir}/${reportPageID}.warn`;

        logger.info(`Processing URL ${reportPageURL}`);

        try {
            await createLockFile(`${outputDir}/${reportPageID}.lock`);

            registerLighthouseListener('status', reportStatusLog);
            registerLighthouseListener('warning', reportWarnLog);

            let results = await lighthouse(reportPageURL, lighthouseOptions);
            delete results.artifacts;
            // delete results.audits;

            writeResultsToFile(resultFile, stringify(results, null, 4));

        } catch (e) {
            logger.error("Failed to process target %s", reportPageURL, e);

            fs.writeFile(`${reportDir}/${reportPageID}.exception`, e, function (err) {
                if (err) {
                    logger.error("Failed to write exception file", err);
                }
            });
        } finally {
            deleteLockFile(`${outputDir}/${reportPageID}.lock`);
        }
    }
}


async function main() {
    logger.debug('Input file provided is %s', argv.i);

    logger.debug('Output will be placed to %s', outputDir);


    try {
        //parsing input file
        let reportOptions = await getReportOptions();

        logger.info('Using options report options: %j', reportOptions);

        let chromeFlags = [...defaultChromeFlags, ...reportOptions.config.chromeFlags];

        let lighthouseOptions = Object.assign(defaultLighthouseOptions, // TODO zmenit options v input.json na mapu properties a vyhodit tohle parsovani?
            argparse(reportOptions.config.options.join(' '),
                {
                    configuration: {
                        'camel-case-expansion': true
                    }
                }
            )
        );

        logger.info('Starting chrome with flags: %j', chromeFlags);

        let chrome = await launchChrome({chromeFlags: chromeFlags});
        lighthouseOptions.port = chrome.port;
        logger.info('Started chrome with debug port on %s', chrome.port);

        await createLockFile(`${outputDir}/.lock`);

        logger.info('Processing targets with lighthouse options: %j', lighthouseOptions);
        await processTargets(reportOptions, outputDir, lighthouseOptions);

        chrome.kill();
    } catch (e) {
        logger.error(e);
    } finally {
        deleteLockFile(`${outputDir}/.lock`);
    }
}

module.exports = main;

if (require.main === module) {
    logger.info('Starting ..');
    main()
        .then(() => {
            logger.info('Done');
        })
        .catch(logger.error);
}