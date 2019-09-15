import { Component, OnInit, ViewChild } from '@angular/core';
import { AdbClientService, ConnectionStatus } from '../adb-client.service';
import { AppService, FolderType } from '../app.service';
import { WebviewService } from '../webview.service';
import { LoadingSpinnerService } from '../loading-spinner.service';
import { StatusBarService } from '../status-bar.service';
import { RepoService } from '../repo.service';
import { BsaberService, QuestSaberPatchResponseJson } from '../bsaber.service';
import { BeatOnService } from '../beat-on.service';
import { DragAndDropService } from '../drag-and-drop.service';
import { Router } from '@angular/router';
import { ProcessBucketService } from '../process-bucket.service';
interface ReplaceText {
    key: string;
    value: string;
}
@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
    @ViewChild('header', { static: false }) header;
    @ViewChild('syncSongsModal', { static: false }) syncSongsModal;
    @ViewChild('installAPKModal', { static: false }) installAPKModal;
    @ViewChild('autoFixModal', { static: false }) autoFixModal;
    @ViewChild('beatOnModal', { static: false }) beatOnModal;
    @ViewChild('mainLogo', { static: false }) mainLogo;
    folder = FolderType;
    isMaximized: boolean = true;
    addrepoUrl: string = '';
    colorA: string;
    colorB: string;
    beatOnLoading: boolean;
    isAlive: boolean = true;
    isAliveChecking: boolean = false;
    replaceText: ReplaceText[] = [];
    addkey: string;
    addvalue: string;
    qspResponse: QuestSaberPatchResponseJson;
    adbCommandToRun: string;
    adbResponse: string;
    constructor(
        public adbService: AdbClientService,
        public appService: AppService,
        public bsaberService: BsaberService,
        public webService: WebviewService,
        public spinnerService: LoadingSpinnerService,
        public statusService: StatusBarService,
        public repoService: RepoService,
        public beatonService: BeatOnService,
        public dragAndDropService: DragAndDropService,
        public router: Router,
        public processService: ProcessBucketService
    ) {}
    ngOnInit() {}

    runAdbCommand() {
        this.adbResponse = 'Loading...';
        let command = this.adbCommandToRun.trim();
        if (command.substr(0, 3).toLowerCase() === 'adb') {
            command = command.substr(3);
        }
        new Promise((resolve, reject) => {
            this.appService.exec(
                '"' + this.appService.path.join(this.adbService.adbPath, this.adbService.getAdbBinary()) + '" ' + command,
                function(err, stdout, stderr) {
                    if (err) {
                        return reject(err);
                    }
                    if (stderr) return reject(stderr);
                    return resolve(stdout);
                }
            );
        })
            .then((resp: string) => {
                this.adbResponse = resp.trim();
            })
            .catch(e => {
                this.statusService.showStatus(e, true);
            });
    }
    isConnected() {
        return this.adbService.deviceStatus === ConnectionStatus.CONNECTED;
    }
    ngAfterViewInit() {
        this.appService.setTitleEle(this.header.nativeElement);
        this.dragAndDropService.setupDragAndDrop(this.mainLogo.nativeElement);
    }
    getConnectionCssClass() {
        return {
            'connection-status-connected': this.adbService.deviceStatus === ConnectionStatus.CONNECTED,
            'connection-status-unauthorized': this.adbService.deviceStatus === ConnectionStatus.UNAUTHORIZED,
            'connection-status-disconnected': this.adbService.deviceStatus === ConnectionStatus.DISCONNECTED,
            'connection-status-too-many': this.adbService.deviceStatus === ConnectionStatus.TOOMANY,
        };
    }
    closeApp() {
        this.appService.remote.getCurrentWindow().close();
    }
    pingHeadset() {
        this.isAlive = true;
        // this.isAliveChecking = true;
        // this.appService.ping.sys.probe(this.adbService.deviceIp, isAlive => {
        //     console.log(isAlive);
        //     this.isAlive = isAlive;
        //     this.isAliveChecking = false;
        // });
    }
    minimizeApp() {
        this.appService.remote.getCurrentWindow().minimize();
    }
    maximizeApp() {
        this.isMaximized = !this.isMaximized;
        this.appService.remote.getCurrentWindow()[this.isMaximized ? 'unmaximize' : 'maximize']();
    }
    openDebugger() {
        this.appService.remote.getCurrentWindow().toggleDevTools();
    }
    selectAppToInstall() {
        this.appService.electron.remote.dialog.showOpenDialog(
            {
                properties: ['openFile', 'multiSelections'],
                defaultPath: this.adbService.savePath,
            },
            files => {
                files.forEach(f => {
                    let filepath = f;
                    this.spinnerService.setMessage(`Installing ${filepath}, Please wait...`);
                    let install = this.adbService.installMultiFile(filepath);
                    if (install) {
                        install
                            .then(() => {
                                this.statusService.showStatus('Installed APK File: ' + filepath, false);
                            })
                            .catch(e => {
                                this.statusService.showStatus(e.toString(), true);
                            });
                    }
                });
            }
        );
    }
    addRepo() {
        this.spinnerService.showLoader();
        this.repoService
            .addRepo(this.addrepoUrl)
            .then(() => (this.addrepoUrl = ''))
            .then(() => this.spinnerService.hideLoader())
            .then(() => this.statusService.showStatus('Repo added OK!!'))
            .then(() => this.repoService.saveRepos())
            .catch(e => {
                this.spinnerService.hideLoader();
                this.statusService.showStatus(e.toString(), true);
            });
    }

    confirmRestore() {
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Restoring BeatOn<br>Please Wait...');
        this.beatonService.confirmRestore(this.adbService).then(r => {
            this.spinnerService.hideLoader();
            this.statusService.showStatus('BeatOn Restored Successfully!!');
            this.beatOnModal.openModal();
            this.beatonService.checkHasRestore(this.adbService);
        });
    }

    async patchBeatSaber() {
        if (this.adbService.deviceStatus !== ConnectionStatus.CONNECTED) {
            return this.statusService.showStatus('No device connected!', true);
        }

        // this.bsaberService.beatSaberVersion = (
        //     (await this.adbService.getPackageInfo(this.bsaberService.beatSaberPackage)) || ('' as any)
        // ).trim();
        if (!this.bsaberService.beatSaberVersion) {
            return this.statusService.showStatus('Beat Saber version not found!! ', true);
        }
        if (!~this.bsaberService.supportedBeatSaberVersions.indexOf(this.bsaberService.beatSaberVersion)) {
            return this.statusService.showStatus(
                'Beat Saber version not supported yet!! ' + this.bsaberService.beatSaberVersion,
                true
            );
        }
        this.syncSongsModal.closeModal();
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Patching Beat Saber...<br>This might take some time.');
        this.replaceText.forEach(text => {
            this.bsaberService.jSon.replaceText[text.key] = text.value;
        });
        if (this.colorA) {
            let color = this.colorA
                .replace('rgba(', '')
                .replace('rgb(', '')
                .replace(')', '');
            let parts: any[] = color.trim().split(',');
            if (!this.bsaberService.jSon.colors.colorA) {
                this.bsaberService.jSon.colors.colorA = { r: 1, g: 0, b: 0, a: 1 };
            }
            this.bsaberService.jSon.colors.colorA.r = Number(parts[0].trim()) / 255;
            this.bsaberService.jSon.colors.colorA.g = Number(parts[1].trim()) / 255;
            this.bsaberService.jSon.colors.colorA.b = Number(parts[2].trim()) / 255;
            this.bsaberService.jSon.colors.colorA.a = 1;
        }
        if (this.colorB) {
            let color = this.colorB
                .replace('rgba(', '')
                .replace('rgb(', '')
                .replace(')', '');
            let parts: any[] = color.trim().split(',');
            if (!this.bsaberService.jSon.colors.colorB) {
                this.bsaberService.jSon.colors.colorB = { r: 0, g: 0, b: 1, a: 1 };
            }
            this.bsaberService.jSon.colors.colorB.r = Number(parts[0].trim()) / 255;
            this.bsaberService.jSon.colors.colorB.g = Number(parts[1].trim()) / 255;
            this.bsaberService.jSon.colors.colorB.b = Number(parts[2].trim()) / 255;
            this.bsaberService.jSon.colors.colorB.a = 1;
        }
        this.bsaberService.saveJson(this.bsaberService.jSon);
        this.bsaberService.jSon = this.bsaberService.getAppJson();
        this.bsaberService
            .questSaberPatch()

            .then((json: QuestSaberPatchResponseJson) => {
                if (json.error) {
                    this.spinnerService.hideLoader();
                    this.autoFixModal.openModal();
                    this.statusService.showStatus(json.error, true);
                }
                this.qspResponse = json;
                this.spinnerService.hideLoader();
                this.installAPKModal.openModal();
            })
            .catch(e => {
                this.autoFixModal.openModal();
                this.spinnerService.hideLoader();
                this.statusService.showStatus(e.toString(), true);
            });
    }
    installSkippedLength() {
        return Object.keys(this.qspResponse.installSkipped || {}).length;
    }
    getInstallSkipped() {
        return Object.keys(this.qspResponse.installSkipped || {})
            .map(k => k + ':' + this.qspResponse.installSkipped[k])
            .join(', ');
    }
    installAPK(name: string) {
        return this.adbService.installAPK(this.appService.path.join(this.appService.appData, name), true, true);
    }
    installPatchedAPK() {
        this.installAPK('bsaber-base_patched.apk');
    }
    installBaseAPK() {
        this.installAPK('bsaber-base.apk');
    }
    removeText(text) {
        this.replaceText = this.replaceText.filter(d => d !== text);
    }
    getReplaceAndColors() {
        this.replaceText = Object.keys(this.bsaberService.jSon.replaceText).map(k => ({
            key: k,
            value: this.bsaberService.jSon.replaceText[k],
        }));
        if (this.bsaberService.jSon.colors.colorA) {
            this.colorA =
                'rgba(' +
                this.bsaberService.jSon.colors.colorA.r * 255 +
                ',' +
                this.bsaberService.jSon.colors.colorA.g * 255 +
                ',' +
                this.bsaberService.jSon.colors.colorA.b * 255 +
                ',1)';
        } else {
            this.resetColor(true);
        }
        if (this.bsaberService.jSon.colors.colorB) {
            this.colorB =
                'rgba(' +
                this.bsaberService.jSon.colors.colorB.r * 255 +
                ',' +
                this.bsaberService.jSon.colors.colorB.g * 255 +
                ',' +
                this.bsaberService.jSon.colors.colorB.b * 255 +
                ',1)';
        } else {
            this.resetColor(false);
        }
    }
    resetColor(isColorA: boolean) {
        if (isColorA) {
            this.colorA = 'rgba(240,48,48,1)';
        }

        if (!isColorA) {
            this.colorB = 'rgba(48,158,255,1)';
        }
    }
    openSyncSongs() {
        // this.bsaberService.hasBackup = this.bsaberService.backupExists();
        // this.getReplaceAndColors();
        this.syncSongsModal.openModal();
    }
    launchBeatOn() {
        return (
            this.adbService
                .adbCommand('shell', {
                    serial: this.adbService.deviceSerial,
                    command: 'am startservice com.emulamer.beaton/com.emulamer.BeatOnService',
                })
                // .then(() =>
                //   this.adbService.adbCommand('shell', {
                //     serial: this.adbService.deviceSerial,
                //     command:
                //       'am start -S -W -a android.intent.action.VIEW -c android.intent.category.LEANBACK_LAUNCHER -n com.oculus.vrshell/com.oculus.vrshell.MainActivity -d com.oculus.tv --es "uri" "com.emulamer.beaton/com.emulamer.beaton.MainActivity"',
                //   })
                // )
                .then(r => {
                    this.beatonService.setupBeatOnSocket(this.adbService);
                })
        );
    }
    setBeatOnPermission() {
        return this.beatonService.setBeatOnPermission(this.adbService);
    }
    async toggleBeatOn() {
        if (!this.beatonService.beatOnEnabled) {
            this.beatOnModal.closeModal();
            this.spinnerService.showLoader();
            this.spinnerService.setMessage('Closing app...');
            this.adbService
                .adbCommand('shell', {
                    serial: this.adbService.deviceSerial,
                    command: 'am force-stop com.oculus.tv',
                })
                .then(() =>
                    this.adbService.adbCommand('shell', {
                        serial: this.adbService.deviceSerial,
                        command: 'am force-stop com.emulamer.beaton',
                    })
                )
                .then(r => {})
                .catch(e => {
                    this.statusService.showStatus(e.toString(), true);
                    this.spinnerService.hideLoader();
                    return this.beatonService.checkIsBeatOnRunning(this.adbService);
                });
            setTimeout(() => {
                this.statusService.showStatus('Beat On Disabled');
                this.spinnerService.hideLoader();
                return this.beatonService.checkIsBeatOnRunning(this.adbService);
            }, 5000);
        } else {
            if (~this.adbService.devicePackages.indexOf('com.emulamer.beaton')) {
                await this.launchBeatOn();
                this.beatonService.checkHasRestore(this.adbService);
            } else {
                this.beatOnModal.closeModal();
                const beatOnApps = await fetch('https://api.github.com/repos/emulamer/BeatOn/releases/latest')
                    .then(r => r.json())
                    .then(r => {
                        return r.assets
                            .filter(a => {
                                return a.name.split('.').pop() === 'apk';
                            })
                            .map(a => a.browser_download_url);
                    });
                for (let i = 0; i < beatOnApps.length; i++) {
                    await this.adbService.installAPK(
                        beatOnApps[i] //'https://cdn.glitch.com/6f805e7a-5d34-4158-a46c-ed6e48e31393%2Fcom.emulamer.beaton.apk'
                    );
                }
                this.beatOnModal.openModal();
                this.beatOnLoading = true;
                setTimeout(() => {
                    this.adbService.getPackages().then(async () => {
                        if (~this.adbService.devicePackages.indexOf('com.emulamer.beaton')) {
                            await this.setBeatOnPermission();
                            await this.launchBeatOn();
                            setTimeout(() => {
                                this.beatOnLoading = false;
                                this.beatonService.checkHasRestore(this.adbService);
                            }, 3000);
                        } else {
                            this.statusService.showStatus('Could not launch Beat On. Please try again...', true);
                        }
                    });
                }, 2000);
            }
        }
    }

    openBeatOn() {
        if (
            this.adbService.deviceIp &&
            this.beatonService.beatOnEnabled &&
            this.beatonService.beatOnPID &&
            this.beatonService.beatOnStatus.CurrentStatus === 'ModInstalled'
        ) {
            this.beatonService.checkHasRestore(this.adbService);
        }
        this.bsaberService.hasBackup = this.bsaberService.backupExists();
        this.beatonService.setupBeatOnSocket(this.adbService);
        this.beatOnModal.openModal();
    }
}
