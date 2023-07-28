import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';

import { AuthService } from './core/services/auth.service';
import { environment } from 'src/environments/environment';
import { StoreService } from './core/services/store.service';
import { User } from './core/core.models';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
// import { TicketService } from './ticket/ticket.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy  {
  public courseName: string = '';
  public courseID: string = '';
  public disableLangSelect: boolean = false;
  public isPhonePortrait = false;
  public isInIframe: boolean = false;
  public isLogged: boolean = false;
  public isLoggedIn$: Observable<Boolean | null>;
  public isLoading: Observable<boolean> | null = null;
  public isParticipant$: Observable<Boolean | null>;
  // public isUserLoggedIn$: Observable<boolean>;
  public logButtonString: string = '';
  public user$: Observable<User | null>;
  private _language!: string;
  private unsubscribe$ = new Subject<void>();

  constructor (
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private store : StoreService,
  ) {
    this.isLoading = this.store.trackLoading();
    this.isLoggedIn$ = this.store.trackLoggedIn();
    this.isParticipant$ = this.store.trackIfParticipant();
    this.user$ = this.store.trackUserInfo();
  }

  ngOnInit(): void {
    if (environment.production === true) {
      console.log('Production build');
    }
    this.authService.initialize();
    // Upotuksen testaamisen uncomment alla oleva ja
    // kommentoi sen alla oleva rivi.
    // this.isInIframe = true;
    this.isInIframe = this.getIsInIframe();
    window.sessionStorage.setItem('IN-IFRAME', this.isInIframe.toString());
    console.log('Iframe upotuksen tila: ' + this.isInIframe.toString());
    this.trackCourseID();
    this.trackLoginStatus();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  get language(): string {
    return this._language;
  }

  set language(value: string) {
    if (value !== this._language) {
      localStorage.setItem('language', value);
      window.location.reload();
    }
  }

  private getIsInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  public goTo(view: 'profile' | 'settings') {
    const route = '/course/' + this.courseID + '/' + view;
    console.log('route: ' + route);
    this.router.navigateByUrl(route);
  }

  public logoClicked() {
    this.store.sendMessage('go begin');
  }

  public openInNewTab(): void {
    window.open(window.location.href, '_blank');
  }

  public toggleLanguage() {
    this.language = this._language === 'fi-FI' ? 'en-US' : 'fi-FI';
  }

  // Seurataan kurssi ID:ä URL:sta.
  private trackCourseID(): void {
    this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const courseID = paramMap.get('courseid');
      if (courseID != null) this.courseID = courseID;
      // Älä ota pois. Tällä sivulla toistaiseksi tarvitsee.
    })
  }

  private trackLoginStatus() {
    this.store.onIsUserLoggedIn()
      .pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe(response => {
      if (response) {
        this.isLogged = true;
        this.logButtonString = $localize`:@@Kirjaudu ulos:Kirjaudu ulos`;
      } else if (!response) {
        this.isLogged = false;
        this.logButtonString = $localize`:@@Kirjaudu sisään:Kirjaudu sisään`;
      }
    });
  }

}
