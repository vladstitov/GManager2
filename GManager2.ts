/// <reference path="Scripts/typings/node/node.d.ts" />
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
    APP_NAME:'server.js',
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

var mytimer;

var startClone = function () {
     gitCtr.runClone();
    // gitCtr.runInstall();
    //gitCtr.runFetch();
}

var onAppTaskComlete = function (mode: string, code: number) {
    switch (mode) {
        case 'stoped':
            console.log('application  stoped update start in 10 second otherwise type =>no ');
            mytimer = setTimeout(() => {
                gitCtr.runPull();

            }, 15000);
            break;
    }
}


var onGitTaskComlete = function (mode: string, code: number) {
    console.log('onGitTaskComlete '+mode+'  ' + code);
    switch (mode) {
        
        case 'clone': 
            console.log('will pull in 10 second otherwise type =>no ');
            mytimer = setTimeout(() => {
                gitCtr.runPull();
            }, 15000);           
           
            break;
        case 'install':
            console.log('will start application in 10 second otherwise type =>no ');
            mytimer = setTimeout(() => {
                myapp.startApplication();
                gitCtr.startTimer();
            }, 15000);     
           
            break;
        case 'haveupdate':
            console.log('have updates stopping git conntroller ');
            gitCtr.stopTimer();
            console.log('will stop application in 10 second otherwise type =>no ');
            mytimer = setTimeout(() => {
                myapp.stopApplication();
            }, 15000);            
            break;
        case 'fetch':
            
            break;
        case 'pull':           
            console.log('will install in 10 second otherwise type =>no ');
            mytimer = setTimeout(() => {
                gitCtr.runInstall();
            }, 15000);
           
            break

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
    }


    process.stdin.on('readable', function () {
        var chunk = process.stdin.read();
        if (!chunk) return;
       switch(chunk.trim()){
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
   // private exec    
    private pc: any;
    private PREF: string;
    private INSTALL_FOLDER: string;  
    private path = require('path');
    private FOLDER: string;
    private APP_NAME: string;

    private isHello: boolean
    private processData(data: string): void {
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
    }


    private onDataFromServer(data: string): void {
        console.log('onDataFromServer: ' + data);
        ///if (data && data.indexOf('FROM') == 0) this.processData(data);
    }

    private onDataClose(data: string): void {
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!       onDataClose: ' + data);
        this.pc = null;
    }
    private onDataError(data: string): void {
        console.log('onDataError: ' + data);
    }

    private sendTest(): void {
        this.sendToApplication('hello');
    }
    constructor(private child, private settings: any) {
        // this.exec = child.exec;
       // this.exec = child.spawn;
       
        this.PREF = settings.PREF;
        this.INSTALL_FOLDER = settings.INSTALL_FOLDER;
        this.PREF = 'cd ' + this.INSTALL_FOLDER + ' && ';  
        this.FOLDER = this.path.join(process.cwd(), settings.INSTALL_FOLDER);
        //console.log(this.FOLDER);
        this.APP_NAME = settings.APP_NAME;

    }

    onAppTaskComplete(mode:string,code: number): void {

    }

    startApplication() {
        if (!this.APP_NAME) this.startApplicationSpawn();
        else this.startApplicationExec();
    }

       
    /*
    private onData(data) {
        console.log('on Data from application ', data);
    }
    */
    private onDataFromApp(data):void {
        console.log('##### onDataFromApp: ' + data);
    }

    private onErrorFromApp(data): void {
        console.log('##### onErrorFromApp: ' + data);

    }
    private startApplicationSpawn() {
        this.pc = this.child.spawn('node', [this.APP_NAME], { cwd:this.FOLDER });        
        this.pc.on('close', (code) => this.onDataClose(code));
        //this.pc.on('data', (data) => this.onData(data));
        this.pc.stdout.on('data', (data) => this.onDataFromApp(data));
        this.pc.stderr.on('data', (data) => this.onErrorFromApp(data));       
        setTimeout(() => this.sendTest(), 1000);
    }

    private startApplicationExec() {
        console.log('startApplicationExec ' + this.FOLDER);

        this.pc = this.child.exec('npm start', {cwd:this.FOLDER}, function (error, stdout, stderr) {
            console.log('on process end stdout: ' + stdout);
            console.log('on process end stderr: ' + stderr);
            console.log('on process end error: ' + error);
        });//, null, (err, stdout, stdin) => this.onData(err, stdout, stdin));

        this.pc.on('close', (code) => this.onDataClose(code));
        this.pc.stdout.on('data', (data) => this.onDataFromApp(data));
        this.pc.stderr.on('data', (data) => this.onErrorFromApp(data));
        setTimeout(() => this.sendTest(), 1000);
    }
    private stoptimer: number

    private onStopTimer(): void {
       
    }
    sendToApplication(msg): void {
        if (this.pc && this.pc.stdin) this.pc.stdin.write(msg + "\n");
        else console.log(this.pc);

    }
    killApplication(): void {        
        if(this.pc)this.pc.kill();       
    }
    stopApplication() {
        console.log('sending stop app ');
        this.pc.stdin.write("stopapplication\n");      
    }

}


initMe(child);

