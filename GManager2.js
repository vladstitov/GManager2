/// <reference path="Scripts/typings/node/node.d.ts" />
var child = require('child_process');

var error = 0;
var INSTALL_FOLDER = 'myapp';

var GITURL = 'https://github.com/vladvaldtitov/node_CPanel.git';

//var APP_FOLDER: string = INSTALL_FOLDER + '/node_CPanel';
var APP_FOLDER = INSTALL_FOLDER + '';

var settings = {
    INSTALL_FOLDER: INSTALL_FOLDER,
    GITURL: GITURL,
    APP_FOLDER: APP_FOLDER,
    CHECK_TIMER: 20000,
    APP_NAME: 'server.js',
    isProd: 0
};

var gitCtr;
var myapp;

var onGitReady = function () {
    console.log('onGitReady');

    gitCtr.startTimer();
    myapp.startApplication();
};

var mytimer;

var startClone = function () {
    gitCtr.runClone();
    // gitCtr.runInstall();
    //gitCtr.runFetch();
};

var onAppTaskComlete = function (mode, code) {
    switch (mode) {
        case 'stoped':
            console.log('application  stoped update start in 10 second otherwise type =>no ');
            mytimer = setTimeout(function () {
                gitCtr.runPull();
            }, 15000);
            break;
    }
};

var onGitTaskComlete = function (mode, code) {
    console.log('onGitTaskComlete ' + mode + '  ' + code);
    switch (mode) {
        case 'clone':
            console.log('will pull in 10 second otherwise type =>no ');
            mytimer = setTimeout(function () {
                gitCtr.runPull();
            }, 15000);

            break;
        case 'install':
            console.log('will start application in 10 second otherwise type =>no ');
            mytimer = setTimeout(function () {
                myapp.startApplication();
                gitCtr.startTimer();
            }, 15000);

            break;
        case 'haveupdate':
            console.log('have updates stopping git conntroller ');
            gitCtr.stopTimer();
            console.log('will stop application in 10 second otherwise type =>no ');
            mytimer = setTimeout(function () {
                myapp.stopApplication();
            }, 15000);
            break;
        case 'fetch':
            break;
        case 'pull':
            console.log('will install in 10 second otherwise type =>no ');
            mytimer = setTimeout(function () {
                gitCtr.runInstall();
            }, 15000);

            break;
    }
};

function initMe(child) {
    error = 0;
    gitCtr = new GitCommander(child, settings);
    gitCtr.onComplete = onGitTaskComlete;

    myapp = new AppCommander(child, settings);
    myapp.onAppTaskComplete = onAppTaskComlete;
    setTimeout(startClone, 1000);

    // var exec = child.exec;
    process.stdin.setEncoding('utf8');
    process.on('uncaughtException', function (err) {
        error = err.stack;
        console.error('An uncaught error occurred!', err.stack);
    });

    var onData = function (err, stdout, stdin) {
        console.log('err: ', err);
        console.log('out :', stdout);
        console.log('stdin: ', stdin);
    };

    process.stdin.on('readable', function () {
        var chunk = process.stdin.read();
        if (!chunk)
            return;
        switch (chunk.trim()) {
            case 'stop':
                myapp.stopApplication();
                break;
            case 'start':
                myapp.startApplication();
                break;
            case 'no':
                clearTimeout(mytimer);
                console.log('next operation interrupted to manual control');
                break;
            case 'killapp':
                myapp.killApplication();
                break;
            case 'apphi':
                myapp.sendToApplication('hello');
                break;
            case 'help':
                console.log('Known commands: stop, start, no, killapp, apphi help');
                break;
        }
    });
}

var GitCommander = (function () {
    function GitCommander(child, settings) {
        this.child = child;
        this.CHECK_TIMER = 200000;
        // private settings;
        this.inProcess = 0;
        this.pc = 0;
        this.fs = require('fs');
        this.onData = function (err, stdout, stdin) {
            console.log('err: ', err);
            console.log('out :', stdout);
            console.log('stdin: ', stdin);
        };
        this.exec = child.exec;
        for (var str in settings)
            this[str] = settings[str];
        this.PREF = 'cd ' + this.INSTALL_FOLDER + ' && ';
    }
    GitCommander.prototype.doCommand = function (cmd, callBack, onClose) {
        var pc = this.exec(cmd, null, callBack);
        pc.on('close', function (code) {
            return onClose(code);
        });
        return pc;
    };

    GitCommander.prototype.sendError = function (err) {
        err = '\n ' + new Date() + "\n " + err;
        this.fs.appendFile('err.txt', err, 'utf8', function (err) {
            if (err)
                throw err;
        });
        // console.log('ERROR : ' + new Date() + "\n" + err);
    };
    GitCommander.prototype.sendLog = function (log) {
        log = '\n ' + new Date() + "\n " + log;
        this.fs.appendFile('log.txt', log, 'utf8', function (err) {
            if (err)
                throw err;
        });
        // console.log('ERROR : ' + new Date() + "\n" + err);
    };

    ///////////////////////////////////////////////////////////
    GitCommander.prototype.haveNewData = function () {
        if (this.onNewData)
            this.onNewData();
    };

    GitCommander.prototype.startTimer = function () {
        var _this = this;
        console.log('Starting timer ' + this.CHECK_TIMER);
        this.fetchTimer = setInterval(function () {
            return _this.runFetch();
        }, this.CHECK_TIMER);
    };

    GitCommander.prototype.stopTimer = function () {
        clearInterval(this.fetchTimer);
    };

    GitCommander.prototype.onComplete = function (mode, code) {
    };

    GitCommander.prototype.reset = function () {
        this.pc = 0;
        this.inProcess = 0;
        return 0;
    };

    GitCommander.prototype.onFetching = function (err, stdout, stdin) {
        if (err)
            return;
        this.fetchData += stdin;
    };

    GitCommander.prototype.onFetchDone = function (code) {
        if (code == 0 && this.fetchData.indexOf('origin/master') != -1)
            this.onCommandDone(0, 'haveupdate');
        else
            this.onCommandDone(code, 'fetch');
    };
    GitCommander.prototype.runFetch = function () {
        var _this = this;
        this.fetchData = '';
        var mode = 'fetch';
        var cmd = this.PREF + 'git fetch ';
        console.log(' Running fetch ' + cmd);
        this.pc = this.doCommand(cmd, function (err, stdout, stdin) {
            return _this.onFetching(err, stdout, stdin);
        }, function (code) {
            return _this.onFetchDone(code);
        });
    };

    GitCommander.prototype.runInstall = function () {
        var _this = this;
        var mode = 'install';
        var cmd = this.PREF + 'npm install';
        var f = function (err, stdout, stdin) {
            return _this.onData(err, stdout, stdin);
        };
        if (this.isProd)
            f = null;
        else
            console.log(' Running: ' + cmd);

        this.pc = this.doCommand(cmd, f, function (code) {
            return _this.onCommandDone(code, mode);
        });
    };

    GitCommander.prototype.runPull = function () {
        var _this = this;
        var mode = 'pull';
        var f = function (err, stdout, stdin) {
            return _this.onData(err, stdout, stdin);
        };
        if (this.isProd)
            f = null;
        var cmd = this.PREF + 'git pull';
        this.pc = this.doCommand(cmd, f, function (code) {
            return _this.onCommandDone(code, mode);
        });
    };

    GitCommander.prototype.onCommandDone = function (code, mode) {
        console.log('Mode ' + mode + ' finished with code: ' + code);

        this.onComplete(mode, code);
    };

    GitCommander.prototype.runClone = function () {
        var _this = this;
        var mode = 'clone';
        var cmd = 'git clone ' + this.GITURL + ' ' + this.INSTALL_FOLDER + ' --depth 1';
        var f = function (err, stdout, stdin) {
            return _this.onData(err, stdout, stdin);
        };
        if (this.isProd)
            f = null;
        else
            console.log(' Running: ' + cmd);
        this.pc = this.doCommand(cmd, f, function (code) {
            return _this.onCommandDone(code, mode);
        });
    };
    return GitCommander;
})();

var AppCommander = (function () {
    function AppCommander(child, settings) {
        this.child = child;
        this.settings = settings;
        this.path = require('path');
        // this.exec = child.exec;
        // this.exec = child.spawn;
        this.PREF = settings.PREF;
        this.INSTALL_FOLDER = settings.INSTALL_FOLDER;
        this.PREF = 'cd ' + this.INSTALL_FOLDER + ' && ';
        this.FOLDER = this.path.join(process.cwd(), settings.INSTALL_FOLDER);

        //console.log(this.FOLDER);
        this.APP_NAME = settings.APP_NAME;
    }
    AppCommander.prototype.processData = function (data) {
        data = data.trim();
        switch (data) {
            case 'FROM_APP_STOPPED':
                this.onAppTaskComplete('stoped', 0);
                break;
            case 'FROM_APPLICATION_HELLO':
                this.onAppTaskComplete('started', 0);
                this.isHello = true;
                break;
        }
    };

    AppCommander.prototype.onDataFromServer = function (data) {
        console.log('onDataFromServer: ' + data);
        ///if (data && data.indexOf('FROM') == 0) this.processData(data);
    };

    AppCommander.prototype.onDataClose = function (data) {
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!       onDataClose: ' + data);
        this.pc = null;
    };
    AppCommander.prototype.onDataError = function (data) {
        console.log('onDataError: ' + data);
    };

    AppCommander.prototype.sendTest = function () {
        this.sendToApplication('hello');
    };

    AppCommander.prototype.onAppTaskComplete = function (mode, code) {
    };

    AppCommander.prototype.startApplication = function () {
        if (!this.APP_NAME)
            this.startApplicationSpawn();
        else
            this.startApplicationExec();
    };

    /*
    private onData(data) {
    console.log('on Data from application ', data);
    }
    */
    AppCommander.prototype.onDataFromApp = function (data) {
        console.log('##### onDataFromApp: ' + data);
    };

    AppCommander.prototype.onErrorFromApp = function (data) {
        console.log('##### onErrorFromApp: ' + data);
    };
    AppCommander.prototype.startApplicationSpawn = function () {
        var _this = this;
        this.pc = this.child.spawn('node', [this.APP_NAME], { cwd: this.FOLDER });
        this.pc.on('close', function (code) {
            return _this.onDataClose(code);
        });

        //this.pc.on('data', (data) => this.onData(data));
        this.pc.stdout.on('data', function (data) {
            return _this.onDataFromApp(data);
        });
        this.pc.stderr.on('data', function (data) {
            return _this.onErrorFromApp(data);
        });
        setTimeout(function () {
            return _this.sendTest();
        }, 1000);
    };

    AppCommander.prototype.startApplicationExec = function () {
        var _this = this;
        console.log('startApplicationExec ' + this.FOLDER);

        this.pc = this.child.exec('npm start', { cwd: this.FOLDER }, function (error, stdout, stderr) {
            console.log('on process end stdout: ' + stdout);
            console.log('on process end stderr: ' + stderr);
            console.log('on process end error: ' + error);
        }); //, null, (err, stdout, stdin) => this.onData(err, stdout, stdin));

        this.pc.on('close', function (code) {
            return _this.onDataClose(code);
        });
        this.pc.stdout.on('data', function (data) {
            return _this.onDataFromApp(data);
        });
        this.pc.stderr.on('data', function (data) {
            return _this.onErrorFromApp(data);
        });
        setTimeout(function () {
            return _this.sendTest();
        }, 1000);
    };

    AppCommander.prototype.onStopTimer = function () {
    };
    AppCommander.prototype.sendToApplication = function (msg) {
        if (this.pc && this.pc.stdin)
            this.pc.stdin.write(msg + "\n");
        else
            console.log(this.pc);
    };
    AppCommander.prototype.killApplication = function () {
        if (this.pc)
            this.pc.kill();
    };
    AppCommander.prototype.stopApplication = function () {
        console.log('sending stop app ');
        this.pc.stdin.write("stopapplication\n");
    };
    return AppCommander;
})();

initMe(child);
//# sourceMappingURL=GManager2.js.map
