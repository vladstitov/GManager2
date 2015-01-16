﻿/// <reference path="Scripts/typings/node/node.d.ts" />
var child = require('child_process');

var error: number = 0;
var INSTALL_FOLDER: string = 'myapp';

var GITURL: string = 'https://github.com/vladvaldtitov/node_CPanel.git';
//var APP_FOLDER: string = INSTALL_FOLDER + '/node_CPanel';
var APP_FOLDER: string = INSTALL_FOLDER + '';

var settings = {
    INSTALL_FOLDER: INSTALL_FOLDER,
    GITURL: GITURL,
    APP_FOLDER: APP_FOLDER,
    CHECK_TIMER: 20000,
    isProd: 0
    // server: 'app.js',
    // PREF: 'cd ' + INSTALL_FOLDER + ' && ',
    // clone: { cmd: 'cd .. & git clone ' + GITURL + ' ' + INSTALL_FOLDER },
    //pull: { cmd: 'git pull' },
    //install: { cmd: 'npm install' },
    //fetch: { cmd: 'git fetch' }
}

var gitCtr: GitCommander
var myapp: AppCommander;

var onGitReady = function () {
    console.log('onGitReady');   
    
    gitCtr.startTimer();
    myapp.startApplication();

}
var onAppStoped = function () {
    console.log('server stoped ready for update');
    gitCtr.runPull();
}

var onHaveUpdate = function () {
    gitCtr.stopTimer();
    stopServer();
}

var startClone = function () {
     gitCtr.runClone();
    // gitCtr.runInstall();
    //gitCtr.runFetch();
}
var onAppTaskComlete = function (mode: string, code: number) {

}


var onGitTaskComlete = function (mode: string, code: number) {
    console.log('onGitTaskComlete '+mode+'  ' + code);
    switch (mode) {
        case 'clone':
            gitCtr.runInstall();
            break;
        case 'install':
            gitCtr.startTimer();
            break;
        case 'haveupdate':
            console.log('onGitTaskComlete   have updates stopping conntroller ');
            gitCtr.stopTimer();
            console.log('onGitTaskComlete sending command to restart application ');
            break;
        case 'fetch':
            
            break;
        case 'pull':
            myapp.startApplication();
            break

    }


};

function initMe(child) {
    error = 0;
    gitCtr = new GitCommander(child, settings);     
    gitCtr.onComplete = onGitTaskComlete;

    myapp = new AppCommander(child, settings);
    myapp.onAppStoped = onAppStoped;
    setTimeout(startClone, 1000);
    var exec = child.exec;

    process.stdin.setEncoding('utf8');
    process.on('uncaughtException', function (err) {
        error = err.stack;
        console.error('An uncaught error occurred!', err.stack);
    });

    var onData = function (err, stdout, stdin) {
        console.log('err: ', err);
        console.log('out :', stdout);
        console.log('stdin: ', stdin);
    }


    process.stdin.on('readable', function () {
        var chunk = process.stdin.read();
        if (!chunk) return;
        if (chunk.trim() == 'stop') {
            stopServer();
            return;
        }

        // console.log(chunk);  
    });


}

class GitCommander {
    private PREF;
    private INSTALL_FOLDER: string;
    private APP_FOLDER: string;
    private GITURL: string;
    private CHECK_TIMER: number = 200000;
    // private settings;
    private inProcess = 0;
    private pc: any = 0;
    private exec;
    private fetchTimer;
    private fs = require('fs');
    private isProd: boolean;

    private doCommand(cmd: string, callBack: Function, onClose: Function): void {
        var pc = this.exec(cmd, null, callBack);
        pc.on('close', (code) => onClose(code));
        return pc;
    }

    private sendError(err) {
        err = '\n ' + new Date() + "\n " + err;
        this.fs.appendFile('err.txt', err, 'utf8', function (err) {
            if (err) throw err;
        });
        // console.log('ERROR : ' + new Date() + "\n" + err);

    }
    private sendLog(log) {
        log = '\n ' + new Date() + "\n " + log;
        this.fs.appendFile('log.txt', log, 'utf8', function (err) {
            if (err) throw err;
        });
        // console.log('ERROR : ' + new Date() + "\n" + err);

    }


    ///////////////////////////////////////////////////////////
    private haveNewData(): void {
        if (this.onNewData) this.onNewData();
    }


    constructor(private child, settings: any) {
        this.exec = child.exec;
        for (var str in settings) this[str] = settings[str];
        this.PREF = 'cd ' + this.INSTALL_FOLDER + ' && ';
    }

    private onData = function (err, stdout, stdin) {
        console.log('err: ', err);
        console.log('out :', stdout);
        console.log('stdin: ', stdin);
    }

    startTimer(): void {
        console.log('Starting timer ' + this.CHECK_TIMER)
        this.fetchTimer = setInterval(() => this.runFetch(), this.CHECK_TIMER);
    }

    stopTimer(): void {
        clearInterval(this.fetchTimer);
    }


    onReady: Function;
    onNewData: Function;
    onComplete(mode: string, code: number): void {

    }

    reset() {
        this.pc = 0;
        this.inProcess = 0;
        return 0;
    }

    private fetchData: string;

    private onFetching(err, stdout, stdin): void {
        if (err) return;
        this.fetchData += stdin;
    }

    private onFetchDone(code): void {
        if (code == 0 && this.fetchData.indexOf('origin/master') != -1) this.onCommandDone(0, 'haveupdate');
        else this.onCommandDone(code, 'fetch');

    }
    runFetch(): void {
        this.fetchData = '';
        var mode: string = 'fetch';
        var cmd: string = this.PREF+'git fetch ';
        console.log(' Running fetch ' + cmd);
        this.pc = this.doCommand(cmd, (err, stdout, stdin)=>this.onFetching(err, stdout, stdin), (code) => this.onFetchDone(code));
    }

    runInstall(): void {
        var mode: string = 'install';
        var cmd: string = this.PREF+'npm install';
        var f = (err, stdout, stdin) => this.onData(err, stdout, stdin);
        if (this.isProd) f = null
         else console.log(' Running: ' + cmd);

        this.pc = this.doCommand(cmd, f, (code) => this.onCommandDone(code, mode));
    }

    runPull(): void {
        var mode: string ='pull';
        var f = (err, stdout, stdin) => this.onData(err, stdout, stdin);
        if (this.isProd) f = null
        var cmd: string = this.PREF+ 'git pull';
        this.pc = this.doCommand(cmd, f, (code) => this.onCommandDone(code, mode));
    }




    private onCommandDone(code: number, mode: string): void {
        console.log('Mode ' + mode + ' finished with code: ' + code);


        this.onComplete(mode, code);

    }

    runClone(): void {
        var mode: string = 'clone';
        var cmd: string = 'git clone ' + this.GITURL + ' ' + this.INSTALL_FOLDER + ' --depth 1';
        var f = (err, stdout, stdin) => this.onData(err, stdout, stdin);
        if (this.isProd) f = null
        else console.log(' Running: ' + cmd);
        this.pc = this.doCommand(cmd, f, (code) => this.onCommandDone(code, mode));

    }


}

class AppCommander {
    private exec
    private pc: any;
    private PREF: string;
    private INSTALL_FOLDER: string;  

    private isHello: boolean
    private processData(data: string): void {
        data = data.trim();
        switch (data) {
            case 'FROM_APP_STOPPED':
                this.pc.stdin.write("exitprocess\n");
                this.pc.kill();
                this.pc = null;
                if (this.onAppStoped) this.onAppStoped();
                break;
            case 'FROM_APPLICATION_HELLO':
                this.isHello = true;
                break;

        }
    }


    private onDataFromServer(data: string): void {
        console.log('onDataFromServer: ' + data);
        if (data && data.indexOf('FROM') == 0) this.processData(data);
    }

    private onDataClose(data: string): void {
        console.log('onDataClose: ' + data);
    }
    private onDataError(data: string): void {
        console.log('onDataError: ' + data);
    }

    private sendTest(): void {
        this.pc.stdin.write("hello\n");
    }
    constructor(child, private settings: any) {
        this.exec = child.exec;
        this.PREF = settings.PREF;
        this.INSTALL_FOLDER = settings.INSTALL_FOLDER;
        this.PREF = 'cd ' + this.INSTALL_FOLDER + ' && ';
    }

   
    onAppStoped: Function;

    startApplication() {
        this.pc = this.exec(this.PREF + 'npm start', function (error, stdout, stderr) {
            console.log('on process end stdout: ' + stdout);
            console.log('on process end stderr: ' + stderr);
            console.log('on process end error: ' + error);
        });//, null, (err, stdout, stdin) => this.onData(err, stdout, stdin));

        this.pc.on('close', (code) => this.onDataClose(code));
        this.pc.stdout.on('data', (data) => this.onDataFromServer(data));
        this.pc.stderr.on('data', (data) => this.onDataError(data));
        setTimeout(() => this.sendTest(), 1000);
    }

    stopApplication() {
        console.log('sending stop server ');
        this.pc.stdin.write("stopapplication\n");
        this.pc.kill();
        setTimeout(() => {
            if (this.onAppStoped) this.onAppStoped();
        }, 1000);
    }

}


initMe(child);

