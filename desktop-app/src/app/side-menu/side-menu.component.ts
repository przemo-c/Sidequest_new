import { Component, OnInit } from '@angular/core';
import { RepoService } from '../repo.service';
import { Router } from '@angular/router';
import { WebviewService } from '../webview.service';
import { AdbClientService } from '../adb-client.service';
import { AppService } from '../app.service';
import { ProcessBucketService } from '../process-bucket.service';

@Component({
    selector: 'app-side-menu',
    templateUrl: './side-menu.component.html',
    styleUrls: ['./side-menu.component.css'],
})
export class SideMenuComponent implements OnInit {
    hideNSFW: boolean;
    constructor(
        public router: Router,
        public repoService: RepoService,
        private webService: WebviewService,
        private adbService: AdbClientService,
        public appService: AppService,
        public processService: ProcessBucketService
    ) {
        this.appService.hideNSFW = !!localStorage.getItem('hideNSFW');
    }

    ngOnInit() {}
    openRepo(index) {
        this.router.navigateByUrl('/apps/' + index);
    }
    openBeatSaber() {
        this.webService.isWebviewOpen = true;
    }

    openCategory(category) {
        this.router.navigateByUrl('/webview').then(() => this.webService.loadUrl('https://sidequestvr.com/#/apps/' + category));
        //  this.appService.resetTop();
        // this.webService.loadUrl('https://sidequestvr.com/#/apps/' + category);
        //  this.webService.isWebviewOpen = true;
        //  this.appService.showBrowserBar = true;
        //  this.appService.setTitle('SideQuest');
    }
}
