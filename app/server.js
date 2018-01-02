#!/usr/bin/env node
/**
 * Created by klingac on 27.11.17.
 */
const lighthouse = require('lighthouse');
const log = require('lighthouse-logger');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const debug = require('debug')('perflytics');
const argparse = require('yargs-parser');
const winston = require('winston');
const stringify = require('json-stringify-safe');

const env = process.env.NODE_ENV !== 'production';

//initialization,config
const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const DEFAULT_LIGHTHOUSE_OPTIONS = {
    logLevel: 'silent',
    output: 'json',
    disableStorageReset: false,
    disableDeviceEmulation: true,
    disableCpuThrottling: false,
    disableNetworkThrottling: true,
    saveAssets: false,
    saveArtifacts: false,
    listAllAudits: false,
    listTraceCategories: false,
    perf: true,
    view: false,
    verbose: false,
    quiet: false,
    hostname: 'localhost',
    maxWaitForLoad: 45000,
    enableErrorReporting: false
};
const DEFAULT_CHROME_FLAGS = ['--headless', '--disable-gpu', '--no-sandbox'];
log.setLevel(DEFAULT_LIGHTHOUSE_OPTIONS.logLevel);

var argv = require('yargs')
    .usage('Run lighthouse configured by JSON file')
    .example('$0', 'Run lighthouse script')
    .alias('o', 'output-dir').describe('o', 'Output directory')
    .default('o', arg => arg ? arg : __dirname)
    .alias('v', 'verbose').describe('v', 'Verbose output')
    .required('i', 'Input file must be provided').alias('i', 'input file').describe('i', 'Input file with tests definitions')
    .help('h').alias('h', 'help')
    .argv;

//setup logging
const outputDir = argv.o;
const logDir = outputDir;
const tsFormat = () => (new Date()).toLocaleTimeString();
const logger = new (winston.Logger)({
    transports: [
        // colorize the output to the console
        new (winston.transports.Console)({
            timestamp: tsFormat,
            colorize: true,
            level: 'info'
        }),
        new (winston.transports.File)({
            filename: `${logDir}/agent.log`,
            timestamp: tsFormat,
            level: env === 'development' ? 'debug' : 'info'
        })
    ]
});

async function launchChrome(flags = {}){
    return chromeLauncher.launch({chromeFlags: flags.chromeFlags});
}

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
        if(err) {
            logger.error('Cannot write report to dile ', resultFile);
            logger.error(err);
        }
    });
    logger.info('The result was saved to %s', resultFile);
}

async function createLockFile(fileName) {
    var fd = fs.openSync(fileName, 'a');
    return fd;
}

function deleteLockFile(fileName) {
    fs.unlinkSync(fileName);
    logger.info(`Deleting lockfile ${fileName}`);
}

async function processTargets(reportOptions, reportDir, lighthouseOptions) {
    for (let target of reportOptions.targets) {
        let reportPageID = target.id;
        let reportPageURL = target.url;
        let resultFile = `${reportDir}/${reportPageID}.json`;
        let reportStatusLog = `${reportDir}/${reportPageID}.status`;
        let reportWarnLog = `${reportDir}/${reportPageID}.warn`;

        try {
            await createLockFile(`${outputDir}/${reportPageID}.lock`);
            logger.info(`Processing URL ${reportPageURL}`);
            let statusStream = registerLighthouseListener('status', reportStatusLog);
            let warnStream = registerLighthouseListener('warning', reportWarnLog);

            let results = await lighthouse(reportPageURL, lighthouseOptions);
            delete results.artifacts;
            delete results.audits;

            writeResultsToFile(resultFile, stringify(results, null, 4));
            deleteLockFile(`${outputDir}/${reportPageID}.lock`);
        } catch (e) {
            logger.error(e);
        }
    }
}


async function main() {
    logger.debug('Inputfile provided is %s', argv.i);

    logger.debug('Output will be placed to %s', outputDir);

    //parsing input file
    let reportOptions = JSON.parse(fs.readFileSync(argv.i, 'utf8'));
    var chromeFlags = [...DEFAULT_CHROME_FLAGS, ...reportOptions.config.chromeFlags];
    var lighthouseOptions = Object.assign(DEFAULT_LIGHTHOUSE_OPTIONS, argparse(reportOptions.config.options.join(' ')));

    try {
        let chrome = await launchChrome({chromeFlags: chromeFlags});
        lighthouseOptions.port = chrome.port;
        logger.info('Started chrome with debug port on %s', chrome.port);

        await createLockFile(`${outputDir}/.lock`);

        await processTargets(reportOptions, outputDir, lighthouseOptions);

        chrome.kill();

        deleteLockFile(`${outputDir}/.lock`);

    } catch(e) {
        logger.error(e);
    }
}

module.exports = main;
if(require.main == module) {
    logger.info('Starting app');
    main().then(() => {
        logger.info('Done');
    });
}
