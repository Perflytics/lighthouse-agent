#!/usr/bin/env node
/**
 * Created by klingac on 27.11.17.
 */
const lighthouse = require('lighthouse');
const log = require('lighthouse-logger');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const mkdirp = require('mkdirp');
const debug = require('debug')('perflytics')

const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const DEFAULT_LIGHTHOUSE_OPTIONS = {logLevel: 'info', output: 'json'};
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

async function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
    return chromeLauncher.launch().then(chrome => {
        flags.port = chrome.port;
        return lighthouse(url, flags, config).then(results =>
            chrome.kill().then(() => results));
    });
}

async function launchChrome(flags = {}){
    return chromeLauncher.launch({chromeFlags: flags.chromeFlags});
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
    debug('Output will be palced to provided is %s', outputDir);

    let reportOptions = JSON.parse(fs.readFileSync(argv.i, 'utf8'));
    let chromeFlags = [...DEFAULT_CHROME_FLAGS, ...reportOptions.config.chromeFlags]
    let lighthouseOptions = Object.assign(DEFAULT_LIGHTHOUSE_OPTIONS, reportOptions);
    delete lighthouseOptions.config.chromeFlags;
    // lighthouseOptions.flags = reportOptions.config.options;

    debug('Lighhouse options', lighthouseOptions);

    try {
        let chrome = await launchChrome({chromeFlags: chromeFlags});
        lighthouseOptions.port = chrome.port;
        debug('Started chrome with debug port on %s', chrome.port);

        for (let target of reportOptions.targets) {
            let reportDir = outputDir+'/'+target.reportID;

            mkdirp(reportDir, (err) => {
                if (err) {
                    console.error('Cannot create directory ', reportDir);
                    console.error(err)
                }
                else {
                    debug('Storing files to %s', reportDir);
                }
            });

            try {
                let results = await lighthouse(target.url, lighthouseOptions);
                let resultFile = reportDir+'/'+target.reportID+'.json';
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


module.exports = launchChromeAndRunLighthouse;
if(require.main == module) {
    debug('Starting app');
    main();
}
