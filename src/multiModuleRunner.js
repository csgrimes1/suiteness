'use strict';

const _ = require('lodash'),
    path = require('path'),
    constants = require('./constants'),
    degent = require('degent'),
    runner = require('./testFromModuleRunner'),
    colors = require('colors/safe'),
    loadModuleInfos = function (modules) {
        return _.map(modules, (m) => {
            try {
                const imports = require(m),
                    testCount = _.keys(imports.tests).length;

                return {module: m, testCount: testCount};
            } catch (x) {
                console.error(colors.red(`${m} failed to load - run file directly from NodeJS to find offending line of code.`));
                throw new Error('FATAL');
            }
        });
    },
    runTests = function(module, testCount, eventEmitter) {
        eventEmitter.emit(constants.EVENTNAME, {
            notify:    'STARTMODULE',
            module:    module,
            dateTime:  new Date(),
            testCount: testCount
        });
        let passes = 0;
        return degent( function *() {
            try {
                for (let n = 0; n < testCount; n++) {
                    yield runner(module, n, eventEmitter);
                    passes++;
                }

                eventEmitter.emit(constants.EVENTNAME, {
                    notify: 'ENDMODULE',
                    module: module,
                    dateTime: new Date(),
                    testCount: testCount,
                    passes: passes
                });
            } catch (x) {
                console.error(colors.red(`${module} failed:\n${x.stack}`));
                throw new Error('FATAL');
            }
        });
    },
    runModules = function (moduleInfos, eventEmitter) {
        return degent(function *() {
            try {
                for (let n = 0; n < moduleInfos.length; n++) {
                    let mi = moduleInfos[n];
                    yield runTests(mi.module, mi.testCount, eventEmitter);
                }
            } catch (x) {
                throw new Error('FATAL');
            }
        });
    },
    appRoot = require('app-root-path'),
    requirify = function (moduleName) {
        return path.isAbsolute(moduleName) ? moduleName : path.join(appRoot.toString(), moduleName);
    };

module.exports = function (modules, eventEmitter) {
    const moduleInfos = loadModuleInfos(modules.map(requirify)),
        baseEvent = {
            notify:    'STARTMODULE',
            dateTime:  new Date(),
            testCount: _.sumBy(moduleInfos, m => m.testCount)
        };

    eventEmitter.emit(constants.EVENTNAME, _.merge({}, baseEvent, {
        notify: 'STARTSUITE'
    }));

    return runModules(moduleInfos, eventEmitter).then(() => {
        const d = new Date();

        eventEmitter.emit(constants.EVENTNAME, _.merge({}, baseEvent, {
            notify:   'ENDSUITE',
            dateTime: d,
            elapsed:  d.getTime() - baseEvent.dateTime.getTime()
        }));
    });
};
