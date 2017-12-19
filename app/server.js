#!/usr/bin/env node
/**
 * Created by klingac on 27.11.17.
 */
const lighthouse = require('lighthouse');
const log = require('lighthouse-logger');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const mkdirp = require('mkdirp');
const debug = require('debug')('perflytics');
const argparse = require('yargs-parser');
const winston = require('winston');

const env = process.env.NODE_ENV !== 'production';

//initialization,config
const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const DEFAULT_LIGHTHOUSE_OPTIONS = {logLevel: 'silent', output: 'json'};
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

async function createReportDir(reportDir) {
    logger.info('Storing files to %s', reportDir);
    mkdirp.sync(reportDir, (err) => {
        if (err) {
            logger.error('Cannot create directory ', reportDir);
            logger.error(err);
        }
    });
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

async function createLockFile(dirname) {
    var fd = fs.openSync(dirname+'/.lock', 'a');
    return fd;
}

function deleteLockFile(dirname) {
    fs.unlinkSync(dirname+'/.lock');
    logger.info('deleting lockfile');
}

async function processTargets(reportOptions, reportDir, lighthouseOptions) {
    for (let target of reportOptions.targets) {
        let resultFile = reportDir + '/' + target.reportPageID + '.json';
        let reportStatusLog = reportDir + '/' + target.reportPageID + '.status';
        let reportWarnLog = reportDir + '/' + target.reportPageID + '.warn';

        try {
            let statusStream = registerLighthouseListener('status', reportStatusLog);
            let warnStream = registerLighthouseListener('warning', reportWarnLog);

            let results = await lighthouse(target.url, lighthouseOptions);

            writeResultsToFile(resultFile, JSON.stringify(results));
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
    let reportID = reportOptions.reportID;
    var chromeFlags = [...DEFAULT_CHROME_FLAGS, ...reportOptions.config.chromeFlags];
    var lighthouseOptions = Object.assign(DEFAULT_LIGHTHOUSE_OPTIONS, argparse(reportOptions.config.options.join(' ')));

    try {
        let chrome = await launchChrome({chromeFlags: chromeFlags});
        lighthouseOptions.port = chrome.port;
        logger.info('Started chrome with debug port on %s', chrome.port);

        let reportDir = outputDir+'/'+reportID;

        createReportDir(reportDir).then(() => {
            return createLockFile(reportDir)
        });

        await processTargets(reportOptions, reportDir, lighthouseOptions);

        chrome.kill();

        deleteLockFile(reportDir);

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
