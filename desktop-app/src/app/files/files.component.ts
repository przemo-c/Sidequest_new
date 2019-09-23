import { Component, OnInit, ViewChild } from '@angular/core';
import { AdbClientService, ConnectionStatus } from '../adb-client.service';
import { AppService } from '../app.service';
import { LoadingSpinnerService } from '../loading-spinner.service';
import { StatusBarService } from '../status-bar.service';
interface FileFolderListing {
    name: string;
    icon: string;
    size: number;
    time: Date;
    filePath: String;
}
interface BreadcrumbListing {
    name: string;
    path: string;
}
declare let M;
@Component({
    selector: 'app-files',
    templateUrl: './files.component.html',
    styleUrls: ['./files.component.css'],
})
export class FilesComponent implements OnInit {
    @ViewChild('filesModal', { static: false }) filesModal;
    @ViewChild('fixedAction', { static: false }) fixedAction;
    @ViewChild('downloadMediaModal', { static: false }) downloadMediaModal;
    files: FileFolderListing[] = [];
    selectedFiles: FileFolderListing[] = [];
    currentFileDelete: FileFolderListing;
    breadcrumbs: BreadcrumbListing[] = [];
    isOpen: boolean = false;
    currentPath: string;
    folderName: string;
    confirmMessage: string;
    currentFile: FileFolderListing;
    constructor(
        public spinnerService: LoadingSpinnerService,
        public adbService: AdbClientService,
        public appService: AppService,
        public statusService: StatusBarService
    ) {
        this.appService.resetTop();
        appService.filesComponent = this;
        appService.isFilesOpen = true;
        appService.webService.isWebviewOpen = false;
    }
    ngOnAfterViewInit() {
        M.FloatingActionButton.init(this.fixedAction.nativeElement, {});
    }
    ngOnInit() {
        this.appService.setTitle('Headset Files');
    }
    makeFolder() {
        if (
            this.files
                .filter(f => f.icon === 'folder')
                .map(f => f.name)
                .indexOf(this.folderName)
        ) {
            return this.statusService.showStatus('A folder already exists with that name!!', true);
        } else {
            this.adbService.makeDirectory(this.appService.path.posix.join(this.currentPath, this.folderName)).then(r => {
                this.folderName = '';
                this.open(this.currentPath);
            });
        }
    }
    selectFile(event: Event, file: FileFolderListing) {
        let fileElement = event.target as Element;

        if (file.icon === 'folder') {
            this.selectedFiles.length = 0;
            this.open(this.appService.path.posix.join(this.currentPath, file.name));
        } else if (!fileElement.classList.contains('delete')) {
            while (!fileElement.classList.contains('file')) {
                fileElement = fileElement.parentElement;
            }

            if (this.selectedFiles.includes(file)) {
                this.selectedFiles.splice(this.selectedFiles.indexOf(file));
                fileElement.classList.remove('selected');
            } else {
                this.selectedFiles.push(file);
                fileElement.classList.add('selected');
            }
        }
    }
    uploadFile(files): Promise<any> {
        if (!files.length) return Promise.resolve();
        let f = files.shift();
        let savePath = this.appService.path.posix.join(this.currentPath, this.appService.path.basename(f));
        return this.adbService
            .adbCommand('push', { serial: this.adbService.deviceSerial, path: f, savePath }, stats => {
                this.spinnerService.setMessage(
                    'File uploading: ' +
                        this.appService.path.basename(f) +
                        ' ' +
                        Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                        'MB'
                );
            })
            .then(() => setTimeout(() => this.uploadFile(files), 500));
    }
    uploadFilesFromList(files: string[]) {
        if (files !== undefined && files.length) {
            this.spinnerService.showLoader();
            this.uploadFile(files)
                .then(() => {
                    this.spinnerService.setMessage('Files Uploaded!!');
                    setTimeout(() => {
                        this.open(this.currentPath);
                        this.spinnerService.hideLoader();
                        this.statusService.showStatus('Files Uploaded!!');
                    }, 500);
                })
                .catch(e => this.statusService.showStatus(e.toString(), true));
        }
    }
    uploadFiles() {
        this.appService.electron.remote.dialog.showOpenDialog(
            {
                properties: ['openFile', 'multiSelections'],
                defaultPath: this.adbService.savePath,
            },
            files => this.uploadFilesFromList(files)
        );
    }
    async downloadMedia() {
        const paths = ['/sdcard/Oculus/Screenshots', '/sdcard/Oculus/VideoShots'];
        let media: FileFolderListing[] = [];

        for (const path of paths) {
            await this.readdir(path).then(dirContents => {
                media = media.concat(dirContents.filter(file => file.icon !== 'folder'));
            });
        }

        this.saveFiles(media);
    }
    confirmDeleteFile(file: FileFolderListing) {
        let path = this.appService.path.posix.join(this.currentPath, file.name);
        this.confirmMessage = 'Are you sure you want to delete this item? - ' + path;
    }
    deleteFile(file: FileFolderListing) {
        let path = this.appService.path.posix.join(this.currentPath, file.name);
        this.adbService.adbCommand('shell', { serial: this.adbService.deviceSerial, command: 'rm "' + path + '" -r' }).then(r => {
            this.open(this.currentPath);
            this.statusService.showStatus('Item Deleted!! ' + path);
        });
    }
    async saveFiles(files?: FileFolderListing[]) {
        this.filesModal.closeModal();
        this.spinnerService.showLoader();

        for (const file of !files ? this.selectedFiles : files) {
            await this.saveFile(file);
        }

        this.spinnerService.hideLoader();
        this.statusService.showStatus(
            (!files ? this.selectedFiles.length : files.length) + ' files saved to ' + this.adbService.savePath + '!!'
        );

        if (!files) {
            Array.from(document.getElementsByClassName('selected')).forEach(element => element.classList.remove('selected'));
            this.selectedFiles.length = 0;
        }
    }
    saveFile(file: FileFolderListing) {
        let savePath = this.appService.path.join(this.adbService.savePath, file.name);
        let path = file.filePath;
        this.spinnerService.showLoader();
        return this.adbService
            .adbCommand('pull', { serial: this.adbService.deviceSerial, path, savePath }, stats => {
                this.spinnerService.setMessage(
                    'File downloading: ' +
                        this.appService.path.basename(savePath) +
                        '<br>' +
                        Math.round(stats.bytesTransferred / 1024 / 1024) +
                        'MB'
                );
            })
            .catch(e => this.statusService.showStatus(e.toString(), true));
    }
    pickLocation() {
        this.appService.electron.remote.dialog.showOpenDialog(
            {
                properties: ['openDirectory'],
                defaultPath: this.adbService.savePath,
            },
            files => {
                if (files !== undefined && files.length === 1) {
                    this.adbService.savePath = files[0];
                    this.adbService.setSavePath();
                }
            }
        );
    }
    isConnected() {
        let isConnected = this.adbService.deviceStatus === ConnectionStatus.CONNECTED;
        if (isConnected && !this.isOpen) {
            this.isOpen = true;
            this.open('/sdcard/');
        }
        return isConnected;
    }
    getCrumb(path: string) {
        let parts = path.split('/');
        let name = parts.pop();
        let parentPath = parts.join('/');
        if (parts.length > 0) {
            this.getCrumb(parentPath);
        }
        this.breadcrumbs.push({ path, name });
    }
    open(path: string) {
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Loading files...');
        this.currentPath = path;
        this.breadcrumbs = [];
        this.getCrumb(
            this.currentPath
                .split('/')
                .filter(d => d)
                .join('/')
        );
        if (!this.isConnected()) {
            return Promise.resolve();
        }
        this.readdir(path).then(dirContents => {
            this.files = dirContents;
            this.files.sort(function(a, b) {
                let textA = a.name.toUpperCase();
                let textB = b.name.toUpperCase();
                return textA < textB ? -1 : textA > textB ? 1 : 0;
            });
            this.files = this.files.filter(d => d.icon === 'folder').concat(this.files.filter(d => d.icon !== 'folder'));
            this.spinnerService.hideLoader();
        });
    }
    openSaveLocation() {
        this.appService.electron.remote.shell.openItem(this.adbService.savePath);
    }
    async readdir(path: String) {
        let dirContents: FileFolderListing[];
        await this.adbService.adbCommand('readdir', { serial: this.adbService.deviceSerial, path }).then(files => {
            dirContents = files.map(file => {
                let name = file.name;
                let size = Math.round((file.size / 1024 / 1024) * 100) / 100;
                let time = file.mtime;
                let filePath = this.appService.path.posix.join(path, file.name);
                let icon = 'folder';
                if (file.__isFile) {
                    let fileParts = file.name.split('.');
                    let extension = (fileParts[fileParts.length - 1] || '').toLowerCase();
                    switch (extension) {
                        case 'gif':
                        case 'png':
                        case 'jpeg':
                        case 'jpg':
                            icon = 'photo';
                            break;
                        case 'wav':
                        case 'ogg':
                        case 'mp3':
                            icon = 'music_note';
                            break;
                        case 'avi':
                        case 'mp4':
                            icon = 'ondemand_video';
                            break;
                        case 'txt':
                        case 'docx':
                        case 'doc':
                            icon = 'receipt';
                            break;
                        case 'pptx':
                        case 'ppt':
                            icon = 'picture_in_picture';
                            break;
                        case 'xlsx':
                        case 'xls':
                            icon = 'grid_on';
                            break;
                        default:
                            icon = 'receipt';
                            break;
                    }
                }
                return { name, icon, size, time, filePath };
            });
        });
        return dirContents;
    }
}
