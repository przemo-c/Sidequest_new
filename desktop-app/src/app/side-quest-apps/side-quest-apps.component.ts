import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { RepoService } from '../repo.service';
import { Observable } from 'rxjs/internal/Observable';
import { Subscription } from 'rxjs/internal/Subscription';
import { JSONApp, RepoBody } from '../repo-item/repo-item.component';
import { AppService } from '../app.service';
import { AdbClientService } from '../adb-client.service';

@Component({
    selector: 'app-side-quest-apps',
    templateUrl: './side-quest-apps.component.html',
    styleUrls: ['./side-quest-apps.component.css'],
})
export class SideQuestAppsComponent implements OnInit {
    sub: Subscription;
    apps: JSONApp[] = [];
    currentRepo: number = 0;
    isLoaded: boolean;
    constructor(
        private route: ActivatedRoute,
        private repoService: RepoService,
        private appService: AppService,
        router: Router,
        private adbService: AdbClientService,
        private changes: ChangeDetectorRef
    ) {
        this.appService.resetTop();
        this.appService.showSearch = true;
        this.sub = router.events.subscribe(val => {
            if (val instanceof NavigationEnd) {
                appService.webService.isWebviewOpen = false;
                this.apps = null;
                this.currentRepo = parseInt(this.route.snapshot.paramMap.get('index')) || 0;
                if (this.isLoaded) {
                    this.getApps();
                }
            }
        });
    }

    ngOnInit() {}

    ngAfterViewInit() {
        this.getApps();
    }
    getApps() {
        let apps = this.repoService.setCurrent(this.currentRepo);
        if (apps) {
            this.isLoaded = false;
            this.appService.setTitle(apps.name);
            this.apps = apps.body.apps;
            this.changes.detectChanges();
            this.adbService.getPackages().then(() => {
                this.apps.forEach(app => {
                    app.__is_installed = !!~this.adbService.devicePackages.indexOf(app.packageName);
                });
                this.isLoaded = true;
            });
        } else {
            setTimeout(() => this.getApps(), 1000);
        }
    }
    ngOnDestroy() {
        if (this.sub) this.sub.unsubscribe();
    }
    back() {
        (window as any).history.back();
    }
}
