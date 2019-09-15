import { Injectable } from '@angular/core';
import { AppService } from './app.service';
import { RepoService } from './repo.service';
import { BsaberService } from './bsaber.service';
import { StatusBarService } from './status-bar.service';
import { LoadingSpinnerService } from './loading-spinner.service';
import { AdbClientService } from './adb-client.service';
import { WebviewService } from './webview.service';
import { Router } from '@angular/router';
import { BeatOnService } from './beat-on.service';

@Injectable({
    providedIn: 'root',
})
export class ElectronService {
    isInstalledLauncher: boolean;
    isInstallingLauncher: boolean;
    constructor(
        private appService: AppService,
        private repoService: RepoService,
        private bsaberService: BsaberService,
        private statusService: StatusBarService,
        private spinnerService: LoadingSpinnerService,
        private adbService: AdbClientService,
        private webviewService: WebviewService,
        private beatonService: BeatOnService,
        private router: Router
    ) {
        this.setupIPC();
    }
    async installFirefoxMultiple(urls) {
        for (let i = 0; i < urls.length; i++) {
            await this.adbService.installFile(
                urls[i],
                '/sdcard/Android/data/org.mozilla.vrbrowser/files/skybox/',
                i + 1,
                urls.length
            );
        }
    }
    async installMultiple(urls) {
        for (let i = 0; i < urls.length; i++) {
            const etx = urls[i]
                .split('?')[0]
                .split('.')
                .pop()
                .toLowerCase();
            switch (etx) {
                case 'obb':
                    await this.adbService.installObb(urls[i], i + 1, urls.length);
                    break;
                default:
                    await this.adbService.installAPK(urls[i], false, false, i + 1, urls.length);
                    break;
            }
        }
    }

    setupIPC() {
        this.appService.electron.ipcRenderer.on('pre-open-url', (event, data) => {
            this.spinnerService.showLoader();
            this.spinnerService.setMessage('Do you want to install this file?<br><br>' + data);
            this.spinnerService.setupConfirm().then(() => {
                this.spinnerService.hideLoader();
                this.adbService.installAPK(data);
            });
        });
        this.appService.electron.ipcRenderer.on('update-status', (event, data) => {
            if (data.status === 'checking-for-update') {
                this.statusService.showStatus('Checking for an update...');
            } else if (data.status === 'update-available') {
                this.statusService.showStatus(
                    this.appService.os.platform() === 'win32'
                        ? 'Update Available to version ' + data.info.version + '. Restarting to install the new version...'
                        : 'Update Available to version ' +
                              data.info.version +
                              '. Click Update Available at the top to get the latest version.'
                );
                this.appService.updateAvailable = true;
            } else if (data.status === 'no-update') {
                this.statusService.showStatus('You are on the most recent version of SideQuest.');
                this.appService.updateAvailable = false;
            } else if (data.status === 'error') {
                this.statusService.showStatus('Error checking for update.', true);
            } else if (data.status === 'downloading') {
                console.log(data.status);
            } else if (data.status === 'update-downloaded') {
                console.log(data.status);
            }
        });
        this.appService.electron.ipcRenderer.on('open-url', (event, data) => {
            if (data) {
                let url = data.split('#');
                switch (url[0]) {
                    case 'sidequest://repo/':
                        this.repoService.addRepo(url[1]);
                        break;
                    case 'sidequest://unload/':
                        this.adbService.uninstallAPK(url[1]);
                        break;
                    case 'sidequest://sideload-multi/':
                        try {
                            let urls = JSON.parse(
                                data
                                    .replace('sidequest://sideload-multi/#', '')
                                    .split('%22,%22')
                                    .join('","')
                                    .split('[%22')
                                    .join('["')
                                    .split('%22]')
                                    .join('"]')
                            );
                            this.installMultiple(urls);
                            this.statusService.showStatus('Installing app... See the tasks screen for more info.');
                        } catch (e) {
                            this.statusService.showStatus('Could not parse install url: ' + data, true);
                        }
                        this.webviewService.isWebviewLoading = false;
                        break;
                    case 'sidequest://sideload/':
                        this.adbService.installAPK(url[1]);
                        break;
                    case 'sidequest://launcher/':
                        if (!this.isLauncherInstalled()) {
                            this.installLauncher();
                        } else {
                            this.statusService.showStatus('Launcher already installed!');
                        }
                        break;
                    case 'sidequest://navigate/':
                        this.router.navigateByUrl(url[1]);
                        this.appService.showBack = true;
                        this.webviewService.isWebviewLoading = false;
                        break;
                    case 'sidequest://api/':
                        // grab and parse a url like this - sidequest://api/#adbService:installAPK:<url_of_apk>:true
                        // let parts = url[1].split(':');
                        // let service = parts.unshift();
                        // let method = parts.unshift();
                        // if (
                        //   service &&
                        //   this[service] &&
                        //   method &&
                        //   this[service][method] &&
                        //   typeof this[service][method] === 'function'
                        // ) {
                        //   parts = parts.map(p => {
                        //     switch (p) {
                        //       case 'null':
                        //         return null;
                        //       case 'true':
                        //         return true;
                        //       case 'false':
                        //         return false;
                        //       default:
                        //         return p.trim();
                        //     }
                        //   });
                        //   console.log(parts, service, method);
                        //   this[service][method].call.apply(parts);
                        // }
                        break;
                    case 'sidequest://bsaber/':
                        this.statusService.showStatus('Song download started... See the tasks screen for more info.');
                        this.beatonService.downloadSong(url[1], this.adbService);
                        break;
                    case 'sidequest://firefox-skybox/':
                        this.statusService.showStatus(
                            'Firefox Reality Skybox download started... See the tasks screen for more info.'
                        );
                        try {
                            let urls = JSON.parse(
                                data
                                    .replace('sidequest://firefox-skybox/#', '')
                                    .split('%22,%22')
                                    .join('","')
                                    .split('[%22')
                                    .join('["')
                                    .split('%22]')
                                    .join('"]')
                            );
                            this.installFirefoxMultiple(urls);
                        } catch (e) {
                            this.statusService.showStatus('Could not parse install url: ' + data, true);
                        }
                        this.webviewService.isWebviewLoading = false;
                        break;
                    case 'sidequest://bsaber-multi/':
                        try {
                            let urls = JSON.parse(
                                data
                                    .replace('sidequest://bsaber-multi/#', '')
                                    .split('%22,%22')
                                    .join('","')
                                    .split('[%22')
                                    .join('["')
                                    .split('%22]')
                                    .join('"]')
                            );
                            (async () => {
                                this.spinnerService.showLoader();
                                this.spinnerService.setMessage('Saving to BeatOn...');
                                for (let i = 0; i < urls.length; i++) {
                                    await this.beatonService.downloadSong(urls[i], this.adbService);
                                }
                                this.statusService.showStatus('Item Downloaded Ok!!');
                                this.spinnerService.hideLoader();
                            })();
                        } catch (e) {
                            this.statusService.showStatus('Could not parse install url: ' + data, true);
                        }
                        this.webviewService.isWebviewLoading = false;
                        break;
                    default:
                        this.statusService.showStatus('Custom protocol not recognised: ' + (data || ''), true);
                        break;
                }
            }
        });
        this.appService.electron.ipcRenderer.on('info', (event, data) => {
            try {
                data = JSON.parse(data);
                if (data.beatsaber) {
                    this.spinnerService.setMessage('Saving to My Custom Levels...');
                    this.spinnerService.showLoader();
                    this.bsaberService
                        .downloadSong(data.beatsaber)
                        .then(id => {
                            return this.bsaberService
                                .getMySongs()
                                .then(() => this.spinnerService.hideLoader())
                                .then(() => this.statusService.showStatus('Level Downloaded Ok!!'))
                                .then(() => {
                                    this.bsaberService.jSon.packs.forEach(p => {
                                        if (p.id === '__default_pack') {
                                            (this.bsaberService.songs || []).forEach((song: any) => {
                                                if (song.id === id) {
                                                    p.levelIDs.push(song);
                                                }
                                            });
                                        }
                                    });
                                    this.bsaberService.saveJson(this.bsaberService.jSon);
                                });
                        })
                        .catch(e => {
                            this.statusService.showStatus(e.toString(), true);
                            this.spinnerService.hideLoader();
                        });
                }
                if (data.beatsaberRemove) {
                    this.spinnerService.setMessage('Removing Beatsaber Song...');
                    this.spinnerService.hideLoader();
                    this.bsaberService
                        .removeSong(data.beatsaberRemove)
                        // .then(()=>new Promise(r=>setTimeout(r,500)))
                        .then(() => this.bsaberService.getMySongs())
                        .then(() => this.spinnerService.hideLoader())
                        .catch(e => {
                            this.statusService.showStatus(e.toString(), true);
                            this.spinnerService.hideLoader();
                        });
                }
            } catch (e) {}
        });
    }

    isLauncherInstalled() {
        this.isInstalledLauncher =
            !!~this.adbService.devicePackages.indexOf('com.sidequest.wrapper2') &&
            !!~this.adbService.devicePackages.indexOf('com.sidequest.wrapper') &&
            !!~this.adbService.devicePackages.indexOf('com.sidequest.launcher');
        return this.isInstalledLauncher;
    }
    installLauncher() {
        this.isInstallingLauncher = true;
        this.adbService.installAPK('https://cdn.theexpanse.app/SideQuestWrapper.apk');
        this.adbService.installAPK('https://cdn.theexpanse.app/SideQuestWrapper2.apk');
        this.adbService.installAPK('https://cdn.theexpanse.app/SideQuestLauncher.apk');
        this.isInstallingLauncher = false;
        this.isInstalledLauncher = true;
    }
}
