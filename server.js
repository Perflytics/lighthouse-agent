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

const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const DEFAULT_LIGHTHOUSE_OPTIONS = {logLevel: 'silent', output: 'json'};
const DEFAULT_CHROME_FLAGS = ['--headless', '--disable-gpu'];
log.setLevel(DEFAULT_LIGHTHOUSE_OPTIONS.logLevel);

var argv = require('yargs')
    .usage('Run lighthouse configured by JSON file')
    .example('$0', 'Run lighthouse script')
    .alias('o', 'output-dir').describe('o', 'Output directory')
    .alias('v', 'verbose').describe('v', 'Verbose output')
    .required('i', 'Input file must be provided').alias('i', 'input file').describe('i', 'Input file with tests definitions')
    .help('h').alias('h', 'help')
    .argv;

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

async function main() {
    debug('Inputfile provided is %s', argv.i);
    var outputDir;

    if(argv.o) {
        outputDir = argv.o;
    }
    else {
        outputDir = __dirname;
    }
    debug('Output will be placed to %s', outputDir);

    let reportOptions = JSON.parse(fs.readFileSync(argv.i, 'utf8'));
    let chromeFlags = [...DEFAULT_CHROME_FLAGS, ...reportOptions.config.chromeFlags]
    let lighthouseOptions = Object.assign(DEFAULT_LIGHTHOUSE_OPTIONS, reportOptions);
    delete lighthouseOptions.config.chromeFlags;

    debug('Lighhouse options', lighthouseOptions);

    try {
        let chrome = await launchChrome({chromeFlags: chromeFlags});
        lighthouseOptions.port = chrome.port;
        debug('Started chrome with debug port on %s', chrome.port);

        for (let target of reportOptions.targets) {
            let reportDir = outputDir+'/'+target.reportID;
            let resultFile = reportDir+'/'+target.reportID+'.json';
            let reportStatusLog = reportDir+'/'+target.reportID+'status.log';
            let reportWarnLog = reportDir+'/'+target.reportID+'warn.log';

            try {
                mkdirp.sync(reportDir, (err) => {
                    if (err) {
                        console.error('Cannot create directory ', reportDir);
                        console.error(err);
                    }
                    else {
                        debug('Storing files to %s', reportDir);
                    }
                });

                let statusStream = registerLighthouseListener('status',reportStatusLog);
                let warnStream = registerLighthouseListener('warning',reportWarnLog);

                let results = await lighthouse(target.url, lighthouseOptions, perfConfig);

                //@todo ne takto, ale radsi odchytavat results z LH pomoci streamu a ten pak zapisovat
                fs.writeFile(resultFile, JSON.stringify(results), (err) => {
                    if(err) {
                        console.error('Cannot write report to dile ', resultFile);
                        console.error(err);
                    }
                    else {
                        debug('The result was saved to %s', resultFile);
                    }
                });

            } catch(e) {
                console.error(e);
            }
        }

        chrome.kill();
    } catch(e) {
        console.error(e);
    }
}

module.exports = main;
if(require.main == module) {
    debug('Starting app');
    main();
}
