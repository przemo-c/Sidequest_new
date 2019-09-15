import { Injectable } from '@angular/core';
import { AppService } from './app.service';
import { LoadingSpinnerService } from './loading-spinner.service';
import { StatusBarService } from './status-bar.service';
import { BeatOnService } from './beat-on.service';
import { WebviewService } from './webview.service';
import { ProcessBucketService } from './process-bucket.service';
declare const process;
export enum ConnectionStatus {
    CONNECTED,
    OFFLINE,
    UNAUTHORIZED,
    DISCONNECTED,
    TOOMANY, //TODO: HAndle multiple devices
}
@Injectable({
    providedIn: 'root',
})
export class AdbClientService {
    ADB: any;
    adbPath: string;
    devicePackages: string[] = [];
    deviceSerial: string;
    lastConnectionCheck: number;
    deviceStatus: ConnectionStatus = ConnectionStatus.UNAUTHORIZED;
    deviceStatusMessage: string = 'Connecting...';
    pollInterval: number = 1000 * 5;
    savePath: string;
    isTransferring: boolean;
    adbResolves: any;
    files: any;
    localFiles: any;
    deviceIp: string;
    wifiEnabled: boolean;
    wifiHost: string;
    isBatteryCharging: boolean;
    batteryLevel: number;
    constructor(
        public appService: AppService,
        private spinnerService: LoadingSpinnerService,
        private statusService: StatusBarService,
        private beatonService: BeatOnService,
        private webService: WebviewService,
        public processService: ProcessBucketService
    ) {
        this.lastConnectionCheck = performance.now() - 2500;
        this.adbPath = appService.path.join(appService.appData, 'platform-tools');

        this.adbResolves = {};
        this.savePath = localStorage.getItem('save-path') || this.appService.path.join(this.appService.appData, 'tmp');
        this.setSavePath();
        this.webService.isLoaded = this.sendPackages.bind(this);

        this.deviceIp = localStorage.getItem('deviceIp');
    }

    installMultiFile(filepath) {
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Installing...');
        let extention = this.appService.path.extname(filepath);
        switch (extention) {
            case '.apk':
                return this.installAPK(filepath, true);
            case '.obb':
                if (this.appService.path.basename(filepath).match(/main.[0-9]{1,}.[a-z]{1,}.[A-z]{1,}.[A-z]{1,}.obb/)) {
                    return this.installLocalObb(filepath).then(() => this.spinnerService.hideLoader());
                } else {
                    this.spinnerService.hideLoader();
                    return Promise.reject('Invalid OBB');
                }
            case '.zip':
                return this.installLocalZip(filepath, false, () => this.spinnerService.hideLoader());
        }
    }
    toggleWifiMode() {
        if (this.wifiEnabled) {
            return this.adbCommand('usb', { serial: this.deviceSerial }).then(() =>
                this.statusService.showStatus('Please reconnect your USB cable!')
            );
        } else {
            return this.adbCommand('tcpip', { serial: this.deviceSerial }).then(() =>
                this.statusService.showStatus('You can now disconnect your usb cable.')
            );
        }
    }
    connect() {
        this.adbCommand('connect', { deviceIp: this.deviceIp }).then(r => {
            this.wifiHost = r.toString();
        });
    }
    sendPackages() {
        if (this.webService.webView && this.devicePackages && this.deviceStatus === ConnectionStatus.CONNECTED) {
            this.webService.webView.executeJavaScript(
                `
                  window.sideQuest = {
                    installed: ` +
                    JSON.stringify(this.devicePackages) +
                    `
                  }`
            );
        }
    }
    getIpAddress() {
        return this.adbCommand('shell', { serial: this.deviceSerial, command: 'ip route' })
            .then(res => {
                let output_parts = res.trim().split(' ');
                this.deviceIp = output_parts[output_parts.length - 1];
                localStorage.setItem('deviceIp', this.deviceIp);
            })
            .catch(e => {});
    }
    setSavePath() {
        localStorage.setItem('save-path', this.savePath);
    }
    getPackages(show_all?: boolean) {
        if (this.deviceStatus !== ConnectionStatus.CONNECTED) {
            return Promise.resolve();
        }
        return this.adbCommand('getPackages', { serial: this.deviceSerial }).then(packages => {
            this.devicePackages = packages
                .sort((a, b) => {
                    let textA = a.toUpperCase();
                    let textB = b.toUpperCase();
                    return textA < textB ? -1 : textA > textB ? 1 : 0;
                })
                .filter((p: string) => {
                    return (
                        show_all ||
                        ((p.substr(0, 10) !== 'com.oculus' &&
                            p.substr(0, 11) !== 'com.android' &&
                            p.substr(0, 11) !== 'android.ext' &&
                            p !== 'android' &&
                            p.substr(0, 12) !== 'com.qualcomm' &&
                            p !== 'com.facebook.system' &&
                            p !== 'oculus.platform' &&
                            p !== 'com.svox.pico' &&
                            p !== 'org.codeaurora.bluetooth') ||
                            p === 'com.oculus.DogCorp')
                    );
                });
            this.sendPackages();
        });
    }
    getPackageInfo(packageName) {
        return this.adbCommand('shell', {
            serial: this.deviceSerial,
            command: 'dumpsys package ' + packageName + ' | grep versionName',
        })
            .then(res => {
                let versionParts = res.split('=');
                return versionParts.length ? versionParts[1] : '0.0.0.0';
            })
            .catch(e => {
                this.statusService.showStatus(e.message ? e.message : e.toString(), true);
            });
    }
    makeDirectory(dir) {
        return this.adbCommand('shell', { serial: this.deviceSerial, command: 'mkdir "' + dir + '"' });
    }
    async updateConnectedStatus(status: ConnectionStatus) {
        this.deviceStatus = status;
        document.getElementById('connection-status').className = 'connection-status-' + status;
        switch (status) {
            case ConnectionStatus.TOOMANY:
                this.deviceStatusMessage = 'Warning: Please connect only one android device to your PC';
                break;
            case ConnectionStatus.CONNECTED:
                this.getPackages();
                await this.getBatteryLevel();
                await this.getIpAddress();
                this.deviceStatusMessage =
                    'Connected -  Wifi IP: ' + (this.deviceIp || 'Not found...') + ', Battery: ' + this.batteryLevel + '% ';
                this.beatonService.checkIsBeatOnRunning(this);
                break;
            case ConnectionStatus.DISCONNECTED:
                this.deviceStatusMessage =
                    'Disconnected: Connect/Reconnect your headset via USB. ' +
                    (this.deviceIp ? 'Last Wifi IP: ' + this.deviceIp : '');
                break;
            case ConnectionStatus.UNAUTHORIZED:
                this.deviceStatusMessage =
                    'Unauthorized: Put your headset on and click always allow and then OK. ' +
                    (this.deviceIp ? 'Last Wifi IP: ' + this.deviceIp : '');
                break;
        }
    }
    async connectedStatus() {
        let now = performance.now();
        if (now - this.lastConnectionCheck < this.pollInterval || this.isTransferring)
            return requestAnimationFrame(this.connectedStatus.bind(this));
        this.lastConnectionCheck = now;
        return this.adbCommand('listDevices')
            .then((devices: any) => devices.filter(device => device.type !== 'offline'))
            .then(devices => {
                if (devices.length === 1) {
                    this.deviceSerial = devices[0].id;
                    if (devices[0].type === 'device') {
                        return ConnectionStatus.CONNECTED;
                    } else {
                        return ConnectionStatus.UNAUTHORIZED;
                    }
                } else {
                    if (devices.length > 1) {
                        return ConnectionStatus.TOOMANY;
                    } else {
                        return ConnectionStatus.DISCONNECTED;
                    }
                }
            })
            .then(status => {
                this.updateConnectedStatus(status);
                requestAnimationFrame(this.connectedStatus.bind(this));
            })
            .catch(err => {
                requestAnimationFrame(this.connectedStatus.bind(this));
            });
    }
    adbCommand(command: string, settings?, callback?) {
        const uuid = this.appService.uuidv4();
        return new Promise<any>((resolve, reject) => {
            this.adbResolves[uuid] = { resolve, reject, callback };
            this.appService.electron.ipcRenderer.send('adb-command', { command, settings, uuid });
        });
    }
    async setupAdb() {
        if (!this.isAdbDownloaded()) {
            await this.downloadTools();
        }
        this.appService.electron.ipcRenderer.on('adb-command', (event, arg: any) => {
            if (this.adbResolves[arg.uuid]) {
                if (arg.status && this.adbResolves[arg.uuid].callback) {
                    this.adbResolves[arg.uuid].callback(arg.status);
                } else if (arg.error) {
                    this.adbResolves[arg.uuid].reject(arg.error);
                } else {
                    this.adbResolves[arg.uuid].resolve(arg.resp);
                }
            }
        });
        this.adbCommand('setupAdb', {
            adbPath: this.appService.path.join(this.adbPath, this.getAdbBinary()),
        });
    }
    isAdbDownloaded() {
        // let command = 'which adb';
        // if (process.platform == 'win32') {
        //     command = 'where adb';
        // }
        // try{
        //
        //   let stdout = this.appService.execSync(command);
        //   if (this.doesFileExist(stdout)) {
        //     this.adbPath = this.appService.path.dirname(stdout);
        //     return true;
        //   }
        // }catch(e){}
        return this.doesFileExist(this.adbPath);
    }
    setPermission(packageName: string, permission: string) {
        return this.adbCommand('shell', {
            serial: this.deviceSerial,
            command: 'pm grant ' + packageName + ' ' + permission,
        }).then(r => {
            console.log(r);
            this.statusService.showStatus('Permission set OK!!');
        });
    }
    doesFileExist(path) {
        try {
            return this.appService.fs.existsSync(path);
        } catch (err) {
            return false;
        }
    }
    getAdbBinary() {
        switch (this.appService.os.platform()) {
            case 'win32':
                return 'adb.exe';
            default:
                return 'adb';
        }
    }
    async downloadTools() {
        let url = 'https://dl.google.com/android/repository/platform-tools-latest-';
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Downloading/Extracting ADB...');
        return new Promise((resolve, reject) => {
            this.appService
                .downloadFile(url + 'windows.zip', url + 'linux.zip', url + 'darwin.zip', url => this.adbPath + '.zip')
                .then(path =>
                    this.appService.extract(path, { dir: this.appService.appData }, error => {
                        this.spinnerService.hideLoader();
                        if (error) {
                            reject(error);
                        } else {
                            this.appService.fs.unlink(path, err => {
                                if (err) return reject(err);
                                resolve();
                            });
                        }
                    })
                );
        });
    }
    getFilenameDate() {
        return JSON.stringify(new Date())
            .split('"')
            .join('')
            .split(':')
            .join('-')
            .trim();
    }
    getPackageLocation(packageName) {
        return this.adbCommand('shell', { serial: this.deviceSerial, command: 'pm list packages -f ' + packageName }).then(res => {
            let parts = res.split(':');
            if (parts.length > 1) {
                return parts[1].split('=')[0];
            } else {
                return false;
            }
        });
    }
    async makeBackupFolders(packageName: string) {
        let mainBackupPath = this.appService.path.join(this.appService.appData, 'backups', packageName);
        return this.appService
            .mkdir(mainBackupPath)
            .then(() => this.appService.mkdir(this.appService.path.join(mainBackupPath, 'apks')))
            .then(() => this.appService.mkdir(this.appService.path.join(mainBackupPath, 'data')));
    }
    async getBackups(packageName: string) {
        await this.makeBackupFolders(packageName);
        let backupPath = this.appService.path.join(this.appService.appData, 'backups', packageName, 'apks');
        return this.appService.fs
            .readdirSync(backupPath)
            .map(file => this.appService.path.join(backupPath, file))
            .filter(file => !this.appService.fs.lstatSync(file).isDirectory() && this.appService.path.extname(file) === '.apk');
    }
    async getDataBackups(packageName: string) {
        await this.makeBackupFolders(packageName);
        let backupPath = this.appService.path.join(this.appService.appData, 'backups', packageName, 'data');
        return this.appService.fs
            .readdirSync(backupPath)
            .map(folder => this.appService.path.join(backupPath, folder))
            .filter(folder => this.appService.fs.lstatSync(folder).isDirectory());
    }
    async backupPackage(apkPath, packageName) {
        return this.processService.addItem('backup_package', async task => {
            task.status = packageName + ' backing up... 0MB';
            this.isTransferring = true;
            let version = await this.getPackageInfo(packageName);
            if (!version) {
                return Promise.reject('APK not found, is the app installed? ' + packageName);
            }
            let savePath = this.appService.path.join(
                this.appService.appData,
                'backups',
                packageName,
                'apks',
                this.getFilenameDate() + '_' + version.trim() + '.apk'
            );
            return this.makeBackupFolders(packageName)
                .then(() =>
                    this.adbCommand('pull', { serial: this.deviceSerial, path: apkPath, savePath: savePath }, stats => {
                        task.status = packageName + ' backing up... ' + Math.round(stats.bytesTransferred / 1024 / 1024) + 'MB';
                    })
                )
                .then(() => {
                    this.isTransferring = false;
                    task.status = packageName + ' backed up to ' + this.appService.path.basename(savePath) + ' successfully!!';
                    return savePath;
                })
                .catch(e => {
                    this.isTransferring = false;
                    return Promise.reject(packageName + ' backup failed: ' + e.message ? e.message : e.toString());
                });
        });
    }
    installAPK(filePath: string, isLocal?: boolean, shouldUninstall?: boolean, number?: number, total?: number) {
        return this.processService.addItem('apk_install', task => {
            if (this.deviceStatus !== ConnectionStatus.CONNECTED) {
                return Promise.reject('Apk install failed: No device connected! ' + filePath);
            }
            const showTotal = number && total ? '(' + number + '/' + total + ') ' : '';
            task.status = showTotal + 'Installing Apk...<br>' + filePath;
            return this.adbCommand('install', { serial: this.deviceSerial, path: filePath, isLocal: !!isLocal }, status => {
                task.status =
                    (status.percent === 1
                        ? showTotal + 'Installing Apk... : '
                        : showTotal + 'Downloading APK... ' + Math.round(status.percent * 100) + '%') +
                    '<span style="font-style:italic">' +
                    filePath +
                    '</span>';
            })
                .then(r => {
                    task.status = 'APK file installed ok!! ' + filePath;
                    if (filePath.indexOf('com.emulamer.beaton') > -1) {
                        return this.beatonService.setBeatOnPermission(this);
                    }
                    if (filePath.indexOf('Pavlov-Android-Shipping') > -1) {
                        return this.setPermission('com.davevillz.pavlov', 'android.permission.RECORD_AUDIO');
                    }
                })
                .catch(e => {
                    if (e.code && shouldUninstall) {
                        this.uninstallAPK('com.beatgames.beatsaber');
                        this.installAPK(filePath, isLocal);
                    }
                    return Promise.reject(e.message ? e.message : e.code ? e.code : e.toString() + ' ' + filePath);
                });
        });
    }
    uninstallAPK(pkg) {
        return this.processService.addItem('apk_uninstall', task => {
            task.status = 'Uninstalling ' + pkg + '...';
            return this.adbCommand('uninstall', { serial: this.deviceSerial, packageName: pkg })
                .then(() => {
                    task.status = 'APP uninstalled ' + pkg + '...';
                    if (this.webService.webView) {
                        this.webService.webView.executeJavaScript(
                            `
                  if(window.sideQuestRemove) {
                    window.sideQuestRemove('` +
                                pkg +
                                `');
                  }
                  `
                        );
                    }
                })
                .catch(e => Promise.reject(e.message ? e.message : e.code ? e.code : e.toString() + pkg));
        });
    }
    makeFolder(files) {
        if (!files.length) return null;
        let f: any = files.shift();
        this.spinnerService.setMessage('Making folder: <br>' + f.saveName);
        return this.appService.mkdir(f.saveName).then(() => this.makeFolder(files));
    }
    downloadFile(files, task) {
        if (!files.length) return;
        let f: any = files.shift();
        return this.adbCommand('pull', { serial: this.deviceSerial, path: f.name, savePath: f.saveName }, stats => {
            task.status =
                'File downloading: ' +
                this.appService.path.basename(f.name) +
                ' <br>' +
                Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                'MB';
        }).then(r => this.downloadFile(files, task));
    }
    async getFoldersRecursive(root: string) {
        return this.getFolders(root).then(entries => {
            entries.forEach(f => {
                f.name = this.appService.path.posix.join(root, f.name);
            });
            this.files = this.files.concat(entries);
            let folders = entries.filter(f => !f.__isFile);
            let recurse = () => {
                if (!folders.length) return null;
                let folder = folders.shift();
                return this.getFoldersRecursive(folder.name).then(() => recurse());
            };
            return recurse();
        });
    }
    async getLocalFoldersRecursive(root: string) {
        return new Promise(resolve => {
            this.appService.fs.readdir(root, async (err, entries) => {
                entries = entries.map(f => {
                    let name = this.appService.path.join(root, f);
                    return { name: name, __isFile: !this.appService.fs.statSync(name).isDirectory() };
                });
                this.localFiles = this.localFiles.concat(entries);
                let folders = entries.filter(f => !f.__isFile);
                let recurse = () => {
                    if (!folders.length) return Promise.resolve();
                    let folder = folders.shift();
                    return this.getLocalFoldersRecursive(folder.name).then(() => recurse());
                };
                return recurse().then(() => resolve());
            });
        });
    }
    async uploadFile(files, task) {
        if (!files.length) return;
        let f: any = files.shift();
        return this.adbCommand('push', { serial: this.deviceSerial, path: f.name, savePath: f.savePath }, stats => {
            task.status = 'File uploading: ' + f.name + ' ' + Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 + 'MB';
        }).then(r => this.uploadFile(files, task));
    }
    async restoreDataBackup(packageName: string, folderName: string) {
        return this.processService.addItem('restore_files', async task => {
            task.status = 'Restoring Files...';
            let packageBackupPath = this.appService.path.join(
                this.appService.appData,
                'backups',
                packageName,
                'data',
                folderName,
                'files'
            );
            if (this.appService.fs.existsSync(packageBackupPath)) {
                this.localFiles = [];
                await this.getLocalFoldersRecursive(packageBackupPath)
                    .then(() => {
                        this.localFiles.forEach(file => {
                            file.savePath = this.appService.path.posix.join(
                                '/sdcard/Android/data/' + packageName + '/files',
                                file.name
                                    .replace(packageBackupPath, '')
                                    .split('\\')
                                    .join('/')
                            );
                        });
                        return this.uploadFile(this.localFiles.filter(f => f.__isFile), task);
                    })
                    .then(() => this.spinnerService.hideLoader());
            }
            let obbBackupPath = this.appService.path.join(
                this.appService.appData,
                'backups',
                packageName,
                'data',
                folderName,
                'obb'
            );
            if (this.appService.fs.existsSync(obbBackupPath)) {
                this.appService.fs.readdir(obbBackupPath, async (err, entries) => {
                    for (let i = 0; i < entries.length; i++) {
                        await this.adbCommand(
                            'push',
                            {
                                serial: this.deviceSerial,
                                path: this.appService.path.join(obbBackupPath, entries[i]),
                                savePath: '/sdcard/Android/obb/' + packageName + '/' + entries[i],
                            },
                            stats => {
                                task.status =
                                    'File uploading: ' +
                                    entries[i] +
                                    ' ' +
                                    Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                                    'MB';
                            }
                        );
                    }
                });
            }
            return Promise.resolve();
        });
    }
    async makeDataBackup(packageName: string) {
        return this.processService.addItem('save_files', async task => {
            task.status = 'Starting Backup...';
            let folderName = this.getFilenameDate();
            let packageBackupPath = this.appService.path.join(this.appService.appData, 'backups', packageName, 'data', folderName);
            this.files = [];
            await this.makeBackupFolders(packageName);
            await this.adbCommand('stat', { serial: this.deviceSerial, path: '/sdcard/Android/data/' + packageName })
                .then(() =>
                    this.adbCommand('stat', {
                        serial: this.deviceSerial,
                        path: '/sdcard/Android/data/' + packageName + '/files/',
                    })
                )
                .then(() => {
                    return this.getFoldersRecursive('/sdcard/Android/data/' + packageName + '/files/')
                        .then(() => this.appService.mkdir(packageBackupPath))
                        .then(() => this.appService.mkdir(this.appService.path.join(packageBackupPath, 'files')))
                        .then(
                            () =>
                                (this.files = this.files.map(f => {
                                    f.saveName = this.appService.path.join(
                                        packageBackupPath,
                                        f.name.replace('/sdcard/Android/data/' + packageName, '')
                                    );
                                    return f;
                                }))
                        )
                        .then(() => this.makeFolder(this.files.filter(f => !f.__isFile)))
                        .then(() => this.downloadFile(this.files.filter(f => f.__isFile), task));
                });
            return this.adbCommand('stat', { serial: this.deviceSerial, path: '/sdcard/Android/obb/' + packageName })
                .then(() => this.appService.mkdir(this.appService.path.join(packageBackupPath, 'obb')))
                .then(() => this.getFolders('/sdcard/Android/obb/' + packageName))
                .then(files =>
                    files
                        .map(f => {
                            f.name = this.appService.path.posix.join('/sdcard/Android/obb/' + packageName, f.name);
                            f.saveName = this.appService.path.join(
                                packageBackupPath,
                                'obb',
                                f.name.replace('/sdcard/Android/obb/' + packageName, '')
                            );
                            return f;
                        })
                        .filter(f => f.__isFile)
                )
                .then(files => this.downloadFile(files, task))
                .then(() => {
                    task.status = 'Data for app ' + packageName + ' backed up to ' + packageBackupPath;
                });
        });
    }
    async hasSDFolder(name: string, packageName: string) {
        let folders = await this.getFolders('/sdcard/Android/' + name + '/');
        return !!~folders.map(d => d.name).indexOf(packageName);
    }
    async getFolders(root) {
        return this.adbCommand('readdir', { serial: this.deviceSerial, path: root }).catch(e =>
            this.statusService.showStatus(e.toString(), true)
        );
    }
    installFile(url, destinationFolder: string, number?: number, total?: number) {
        return this.processService.addItem('file_install', async task => {
            return this.appService
                .downloadFile(
                    url,
                    url,
                    url,
                    downloadUrl => {
                        return this.appService.path.join(this.appService.appData, downloadUrl.split('/').pop());
                    },
                    task
                )
                .then((_path: string) => this.installLocalFile(_path, destinationFolder, false, null, number, total, task));
        });
    }
    installLocalFile(
        filepath: string,
        destinationFolder: string,
        dontCatchError = false,
        cb = null,
        number?: number,
        total?: number,
        task?
    ) {
        let filename = this.appService.path.basename(filepath);
        const showTotal = number && total ? '(' + number + '/' + total + ') ' : '';
        let p = this.adbCommand(
            'push',
            {
                serial: this.deviceSerial,
                path: filepath,
                savePath: `${destinationFolder}${filename}`,
            },
            stats => {
                if (task) {
                    task.status =
                        showTotal +
                        'File uploading: ' +
                        filename +
                        ' ' +
                        Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                        'MB';
                } else {
                    this.spinnerService.setMessage(
                        showTotal +
                            'File uploading: ' +
                            filename +
                            ' <br>' +
                            Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                            'MB'
                    );
                }
            }
        );
        p = p.then(() => {
            if (task) {
                task.status = 'File transferred successfully! ' + filepath;
            } else {
                this.statusService.showStatus('File transferred successfully!');
            }
        });
        if (cb) {
            cb();
        }
        if (!dontCatchError && !task) {
            p = p.catch(e => {
                this.spinnerService.hideLoader();
                this.statusService.showStatus(e.toString(), true);
            });
        }
        return p;
    }
    installObb(url, number?: number, total?: number) {
        return this.processService.addItem('file_install', async task => {
            return this.appService
                .downloadFile(
                    url,
                    url,
                    url,
                    downloadUrl => {
                        return this.appService.path.join(this.appService.appData, downloadUrl.split('/').pop());
                    },
                    task
                )
                .then((_path: string) => this.installLocalObb(_path, false, null, number, total, task));
        });
    }
    installLocalObb(filepath: string, dontCatchError = false, cb = null, number?: number, total?: number, task?) {
        let filename = this.appService.path.basename(filepath);
        let packageId = filename.match(/main.[0-9]{1,}.([a-z]{1,}.[A-z]{1,}.[A-z]{1,}).obb/)[1];
        const showTotal = number && total ? '(' + number + '/' + total + ') ' : '';
        if (!task) this.spinnerService.showLoader();
        let p = this.adbCommand(
            'push',
            {
                serial: this.deviceSerial,
                path: filepath,
                savePath: `/sdcard/Android/obb/${packageId}/${filename}`,
            },
            stats => {
                if (task) {
                    task.status =
                        showTotal +
                        'File uploading: ' +
                        filename +
                        ' ' +
                        Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                        'MB';
                } else {
                    this.spinnerService.setMessage(
                        showTotal +
                            'File uploading: ' +
                            filename +
                            ' <br>' +
                            Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                            'MB'
                    );
                }
            }
        );
        if (cb) {
            cb();
        }
        p = p.then(() => {
            if (task) {
                task.status = 'File transferred successfully! ' + filepath;
            } else {
                this.statusService.showStatus('File transferred successfully!');
            }
        });
        if (!dontCatchError && !task) {
            p = p.catch(e => {
                console.log('here');
                this.spinnerService.hideLoader();
                this.statusService.showStatus(e.toString(), true);
            });
        }
        return p;
    }
    installLocalZip(filepath, dontCatchError, cb) {
        const typeBasedActions = {
            '.apk': function(filepath, bind) {
                this.installAPK(filepath, true);
            },
            '.obb': function(filepath, bind) {
                if (this.appService.path.basename(filepath).match(/main.[0-9]{1,}.[a-z]{1,}.[A-z]{1,}.[A-z]{1,}.obb/)) {
                    this.installLocalObb(filepath);
                } else {
                    console.log('Invalid OBB');
                }
            },
        };

        this.cleanUpFolder();
        this.appService.extract(filepath, { dir: this.appService.path.join(this.appService.appData, 'tmp') }, extractErr => {
            if (!extractErr) {
                console.log('Extracted Zip');
                this.appService.fs.readdir(this.appService.path.join(this.appService.appData, 'tmp'), (readErr, files) => {
                    let installableFiles = Object.keys(files).filter((val, index) => {
                        return Object.keys(typeBasedActions).includes(this.appService.path.extname(files[index]));
                    });
                    installableFiles.forEach(file => {
                        typeBasedActions[this.appService.path.extname(filepath)](filepath, this);
                    });
                });
            } else {
                console.warn(extractErr);
            }
        });
        cb();
    }
    cleanUpFolder(folderPath = this.appService.path.join(this.appService.appData, 'tmp')) {
        this.appService.fs.readdir(folderPath, (readErr, files) => {
            files.forEach((val, index) => {
                this.appService.fs.unlink(folderPath + val, delErr => {
                    if (delErr) {
                        console.warn(delErr);
                    }
                });
            });
        });
    }
    async getBatteryLevel() {
        return this.adbCommand('shell', { serial: this.deviceSerial, command: 'dumpsys battery' }).then(data => {
            let batteryObject = {};
            const batteyInfo = data.substring(data.indexOf('\n') + 1);
            batteyInfo.split('\n ').forEach(element => {
                let attribute = element.replace(/\s/g, '').split(':');
                const matcher = /true|false|[0-9].{0,}/g;
                if (attribute[1].match(matcher)) {
                    try {
                        attribute[1] = JSON.parse(attribute[1]);
                        Object.assign(batteryObject, { [attribute[0]]: attribute[1] });
                    } catch (e) {}
                }
            });
            this.isBatteryCharging = batteryObject['USBpowered'] || batteryObject['ACpowered'];
            this.batteryLevel = batteryObject['level'];
        });
    }
}
