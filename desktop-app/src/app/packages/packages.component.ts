import { Component, OnInit, ViewChild } from '@angular/core';
import { AdbClientService, ConnectionStatus } from '../adb-client.service';
import { AppService, FolderType } from '../app.service';
import { LoadingSpinnerService } from '../loading-spinner.service';
import { StatusBarService } from '../status-bar.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';
import { RepoService } from '../repo.service';
import { BsaberService } from '../bsaber.service';

@Component({
    selector: 'app-packages',
    templateUrl: './packages.component.html',
    styleUrls: ['./packages.component.css'],
})
export class PackagesComponent implements OnInit {
    @ViewChild('appSettingsModal', { static: false }) appSettingsModal;

    folder = FolderType;
    currentPackage: any = { package: { packageName: '', name: '', icon: '' } };
    routerPackage: string;
    backups: string[];
    dataBackups: string[];
    myApps: any[];
    isBackingUp: boolean;
    isOpen: boolean;
    sub: Subscription;
    show_all: boolean;
    search: string;
    constructor(
        public adbService: AdbClientService,
        public appService: AppService,
        public spinnerService: LoadingSpinnerService,
        public statusService: StatusBarService,
        private repoService: RepoService,
        private bsaberService: BsaberService,
        router: Router,
        route: ActivatedRoute
    ) {
        appService.webService.isWebviewOpen = false;
        appService.resetTop();
        this.appService.setTitle('Installed Apps');
        this.sub = router.events.subscribe(val => {
            if (val instanceof NavigationEnd) {
                this.routerPackage = route.snapshot.paramMap.get('packageName');
            }
        });
        this.show_all = !!localStorage.getItem('packages_show_all');
    }

    setShowAll() {
        if (this.show_all) {
            localStorage.setItem('packages_show_all', 'true');
        } else {
            localStorage.removeItem('packages_show_all');
        }
        this.isOpen = false;
    }

    ngOnInit() {}
    isConnected() {
        let isConnected = this.adbService.deviceStatus === ConnectionStatus.CONNECTED;
        if (isConnected && !this.isOpen) {
            this.isOpen = true;
            this.adbService.getPackages(this.show_all).then(() => {
                this.myApps = this.adbService.devicePackages
                    .map(p => {
                        if (this.repoService.allApps[p]) {
                            return {
                                name: this.repoService.allApps[p].name,
                                icon: this.repoService.allApps[p].icon,
                                packageName: p,
                            };
                        }
                        return {
                            packageName: p,
                        };
                    })
                    .sort((a, b) => {
                        let textA = (a.name || a.packageName).toUpperCase();
                        let textB = (b.name || b.packageName).toUpperCase();
                        return textA < textB ? -1 : textA > textB ? 1 : 0;
                    });
                this.myApps.forEach(p => {
                    if (this.routerPackage && p.packageName === this.routerPackage) {
                        this.currentPackage.package = p;
                    }
                });

                if (
                    this.currentPackage.package.packageName &&
                    ~this.adbService.devicePackages.indexOf(this.currentPackage.package.packageName)
                ) {
                    this.appSettingsModal.openModal();
                } else if (this.currentPackage.package.packageName) {
                    this.statusService.showStatus(
                        'App not installed...' + (this.currentPackage.package ? this.currentPackage.package.packageName : ''),
                        true
                    );
                }
            });
        }
        return isConnected;
    }
    ngAfterViewInit() {}
    getCurrentInstalledInfo() {
        this.adbService
            .getPackageInfo(this.currentPackage.package.packageName)
            .then(() => this.adbService.getBackups(this.currentPackage.package.packageName))
            .then(backups => (this.backups = backups))
            .then(() => this.adbService.getDataBackups(this.currentPackage.package.packageName))
            .then(dataBackups => (this.dataBackups = dataBackups));
    }
    async backupApk() {
        this.appSettingsModal.closeModal();
        let location = await this.adbService.getPackageLocation(this.currentPackage.package.packageName);
        this.adbService.backupPackage(location, this.currentPackage.package.packageName).then(savePath => {
            if (
                this.currentPackage.package.packageName === this.bsaberService.beatSaberPackage &&
                !this.bsaberService.backupExists()
            ) {
                this.appService.fs.copyFileSync(savePath, this.appService.path.join(this.appService.appData, 'bsaber-base.apk'));
                this.appService.fs.copyFileSync(
                    savePath,
                    this.appService.path.join(this.appService.appData, 'bsaber-base_patched.apk')
                );
            }
        });
    }
    backupData() {
        this.appSettingsModal.closeModal();
        this.adbService.makeDataBackup(this.currentPackage.package.packageName);
    }
    showBackupFileName(file) {
        return this.appService.path.basename(file);
    }
    restoreBackup(backup: string) {
        this.appSettingsModal.closeModal();
        this.adbService
            .restoreDataBackup(this.currentPackage.package.packageName, backup)
            .then(() => this.statusService.showStatus('Backup restored ok!!'));
    }
    installBackupApk(filePath) {
        this.appSettingsModal.closeModal();
        this.adbService.installAPK(filePath, true);
    }
    uninstallApk() {
        this.appSettingsModal.closeModal();
        this.adbService.uninstallAPK(this.currentPackage.package.packageName);
    }
    forceClose() {
        this.adbService
            .adbCommand('shell', {
                serial: this.adbService.deviceSerial,
                command: 'am force-stop ' + this.currentPackage.package.packageName,
            })
            .then(r => {
                this.statusService.showStatus('Force Close Sent!!');
            });
    }
    clearData() {
        this.adbService
            .adbCommand('clear', {
                serial: this.adbService.deviceSerial,
                packageName: this.currentPackage.package.packageName,
            })
            .then(r => {
                console.log(r);
                this.statusService.showStatus('Clear Data Sent!!');
            });
    }
}
