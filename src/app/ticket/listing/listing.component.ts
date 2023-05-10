import { ActivatedRoute, ParamMap, Router} from '@angular/router';
import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild }
    from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
// import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { Subject, Subscription, takeUntil, timer }
    from 'rxjs';
import { Title } from '@angular/platform-browser';

import { AuthService } from 'src/app/core/auth.service';
import { Constants, getIsInIframe } from '../../shared/utils';
import { CourseService } from 'src/app/course/course.service';
import { environment } from 'src/environments/environment';
import { RefreshDialogComponent } from '../../core/refresh-dialog/refresh-dialog.component';
import { StoreService } from 'src/app/core/store.service';
import { TicketListComponent } from './ticket-list/ticket-list.component';
import { Kurssini } from 'src/app/course/course.models';
import { User } from 'src/app/core/core.models';
import { UKK } from '../ticket.models';
import { TicketService } from '../ticket.service';

export interface ColumnDefinition {
  def: string;
  showMobile: boolean;
}

export interface ErrorNotification {
  title: string,
  message: string,
  buttonText?: string
}

@Component({
  selector: 'app-listing',
  templateUrl: './listing.component.html',
  styleUrls: ['./listing.component.scss'],
})

export class ListingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(TicketListComponent) ticketList!: TicketListComponent;
  public columnDefinitions: ColumnDefinition[];
  public courseID: string = '';
  public courseName: string = '';
  public dataSource = new MatTableDataSource<UKK>();
  public error: ErrorNotification | null = null;
  public isInIframe: boolean;
  public isLoaded: boolean = false;
  public isParticipant: boolean | null = null;
  public isPhonePortrait: boolean = false;
  public maxItemTitleLength = 100;  // Älä aseta tätä vakioksi.
  public noDataConsent: boolean = false;
  public numberOfFAQ: number = 0;

  private fetchFAQsSub$: Subscription | null = null;
  private isParticipant$: Subscription | null = null;
  private isPolling: boolean = false;
  private isTicketsLoaded: boolean = false;
  private loggedIn$ = new Subscription;
  private scrollPosition: number = 0;
  private readonly POLLING_RATE_MIN = (environment.production == true ) ? 5 : 15;
  private unsubscribe$ = new Subject<void>();
  private url: string = '';

  // Merkkijonot
  public errorMessage: string | null = null;
  public ticketViewLink = '';
  public user: User = {} as User;

  @ViewChild('sortFaq', { static: false }) sort = new MatSort();
  // @ViewChild('paginatorQuestions') paginator: MatPaginator | null = null;
  // @ViewChild('paginatorFaq') paginatorFaq: MatPaginator | null = null;

  constructor(
    private authService: AuthService,
    private courses: CourseService,
    private dialog: MatDialog,
    private responsive: BreakpointObserver,
    private route : ActivatedRoute,
    private store : StoreService,
    private ticket:TicketService,
    private title : Title
  ) {
    this.title.setTitle(Constants.baseTitle + $localize `:@@Otsikko-Kysymykset:
        Kysymykset`);
    this.isInIframe = getIsInIframe();

    this.columnDefinitions = [
      { def: 'otsikko', showMobile: true },
      { def: 'aikaleima', showMobile: false }
    ];

  }

  ngOnInit() {
    this.noDataConsent = this.getDataConsent();
    this.url = window.location.pathname;
    this.trackCourseID();
    this.trackUserInfo();
    this.trackIfParticipant();
    this.trackLoggedStatus();
    this.trackScreenSize();
  }

  ngAfterViewInit(): void {
    this.trackMessages();
  }

  ngOnDestroy(): void {
    console.warn('listaus: ngOnDestroy ajettu.');
    window.removeEventListener('scroll', this.onScroll);
    this.loggedIn$.unsubscribe();
    this.isParticipant$?.unsubscribe();
    this.stopPolling();
  }

  //hakutoiminto, jossa paginointi kommentoitu pois
  public applyFilter(event: Event) {
    let filterValue = (event.target as HTMLInputElement).value;
    filterValue = filterValue.trim().toLowerCase();
      this.dataSource.filter = filterValue;
      /*if (this.dataSourceFAQ.paginator) {
        this.dataSourceFAQ.paginator.firstPage();
      }*/
  }


  private trackIfParticipant() {
    this.isParticipant$ = this.store.trackIfParticipant().subscribe(response => {
      if (response === true) {
        this.isParticipant = true;
      } else if (response === false) {
        this.isParticipant = false;
        this.setError('notParticipant');
      }
    })
  }

  public errorClickEvent(button: string) {
    if (this.noDataConsent === true && this.isInIframe === true) {
      this.giveConsent();
    } else if (this.noDataConsent !== true && this.isInIframe === false) {
      this.authService.navigateToLogin(this.courseID);
    }
}

  // refresh = Jos on saatu refresh-pyyntö muualta.
  private fetchFAQ(courseID: string, refresh?: boolean) {
    this.ticket.getFAQ(courseID).then(response => {
      if (this.isLoaded === false) this.isLoaded = true;
        if (response.length > 0) {
          this.numberOfFAQ = response.length;
          this.dataSource = new MatTableDataSource(response);
          this.dataSource.sort = this.sort;
          // this.dataSourceFAQ.paginator = this.paginatorFaq;
        }
        return
      })
      .catch(error => {
        this.handleError(error)
      })
      .finally(() => {
        if (this.isPolling === false) {
          this.isPolling = true;
          if (this.isTicketsLoaded === true || this.isParticipant === false) {
            this.restorePosition();
          }
        }
        // if (refresh !== true) this.stopLoading();
      });
  }

  private getDataConsent(): boolean {
    return (localStorage.getItem('NO_DATA_CONSENT') === "true") ? true : false
  }

  public getDisplayedColumnFAQ(): string[] {
    return this.columnDefinitions
      .filter(cd => !this.isPhonePortrait || cd.showMobile)
      .map(cd => cd.def);
  }

  public giveConsent() {
    localStorage.removeItem('NO_DATA_CONSENT');
    const dialogConfig = new MatDialogConfig();
    dialogConfig.maxWidth = '30rem';
    const refreshDialog = this.dialog.open(RefreshDialogComponent, dialogConfig);
    refreshDialog.afterClosed().subscribe(res => {
      if (res === 'cancel') {
        localStorage.setItem('NO_DATA_CONSENT', 'true');
      }
    })
  }

  // TODO: lisää virheilmoitusten käsittelyjä.
  private handleError(error: any) {
    if (error?.tunnus == 1000 ) {
    }
    this.isLoaded = true;
  }

  public newTicketMessage(event: any) {
    if (event === 'loaded') {
      this.isTicketsLoaded = true;
      if (this.isPolling === true) {
        // this.isLoaded = true;
        this.restorePosition();
      }
    }
  }

  private onScroll = () => {
    this.scrollPosition = window.scrollY;
    this.store.setPosition(this.url, this.scrollPosition);
  }

  private restorePosition(): void {
    this.scrollPosition = this.store.getPosition(this.url);
    if (this.scrollPosition && this.scrollPosition !== 0) {
      console.log('siirrytään aiempaan scroll-positioon');
      setTimeout(() => window.scrollTo(0, this.scrollPosition), 100);
    }
    window.addEventListener('scroll', this.onScroll);
  }

  public stopPolling(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    if (this.fetchFAQsSub$) this.fetchFAQsSub$.unsubscribe();
  }

  // Kun esim. headerin logoa klikataan ja saadaan refresh-pyyntö.
  private trackMessages(): void {
    this.store.trackMessages()
    .pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(response => {
      if (response === 'go begin') {
        console.log('trackMessages: saatiin refresh pyyntö.');
        this.isLoaded = false;
        setTimeout(() => this.isLoaded = true, 800);
        // this.fetchTickets(this.courseID);
        this.fetchFAQ(this.courseID, true);
      }
    });
  }

  private trackScreenSize(): void {
    this.responsive.observe(Breakpoints.HandsetPortrait).subscribe(result => {
      if (result.matches) {
        this.maxItemTitleLength = 35;
        this.isPhonePortrait = true;
      } else {
        this.isPhonePortrait = false;
        this.maxItemTitleLength = 100;
      }
    });
  }

  private trackUserInfo(): void {
    this.store.trackUserInfo()
    .pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(response => {
      if (response?.id) this.user = response;
    });
  }


  // Tallentaa URL:n kirjautumisen jälkeen tapahtuvaa uudelleenohjausta varten.
  public saveRedirectUrl(linkEnding?: string): void {
    this.stopPolling();
    const link = '/course/' + this.courseID + '/submit' + (linkEnding ?? '');
    if (this.store.getIsLoggedIn() === false) {
      console.log('tallennettu URL: ' + link);
      window.localStorage.setItem('REDIRECT_URL', link);
    }
  }

  // Seurataan kurssi ID:ä URL:sta.
  private trackCourseID(): void {
    this.route.paramMap.subscribe((paramMap: ParamMap) => {
      var courseID: string | null = paramMap.get('courseid');
      if (courseID === null) {
        this.errorMessage = $localize `:@@puuttuu kurssiID:
            Kurssin tunnistetietoa  ei löytynyt. Tarkista URL-osoitteen oikeinkirjoitus.`;
        this.isLoaded = true;
        throw new Error('Virhe: ei kurssi ID:ä.');
      }
      this.courseID = courseID;
      // Älä ota pois. Tällä sivulla toistaiseksi tarvitsee.
      this.showCourseName(courseID);
      this.startPollingFAQ();
    })
  }

  private trackLoggedStatus(): void {
    this.loggedIn$ = this.store.onIsUserLoggedIn().subscribe(response => {
      if (response === false) {
        console.log('Listing: saatiin tieto, ettei olla kirjautuneina.');
        this.isLoaded = true;
        this.setError('notLoggedIn');
      } else if (response === true) {
        this.error === null;
      }
    });
  }

    // Aseta virheviestejä.
    private setError(type: string): void {
      if (type === 'notParticipant') {
        this.error = {
          title: $localize`:@@Ei osallistujana-otsikko:Et osallistu tälle kurssille.`,
          message: $localize`:@@Ei osallistujana-viesti:Et voi kysyä kysymyksiä tällä kurssilla, etkä tarkastella muiden kysymiä kysymyksiä.`,
          buttonText: ''
        }
      } else if  (type === 'notLoggedIn') {
        this.error = {
          title: $localize`:@@Et ole kirjautunut:Et ole kirjautunut` + '.',
          message: $localize`:@@Ei osallistujana-viesti:Et voi lisätä tai nähdä kurssilla esitettyjä henkilökohtaisia kysymyksiä.`,
          buttonText: ''
        }
        if (this.noDataConsent === true) {
          this.error.buttonText = $localize `:@@Luo tili:Luo tili`;
        } else if (!this.isInIframe) {
          this.error.buttonText = $localize `:@@Kirjaudu:Kirjaudu`;
        }

      } else {
        console.error('Ei virheviestiä tyypille: ' + type);
      }
    }

  // Älä ota pois. Tällä sivulla toistaiseksi tarvitsee.
  private showCourseName(courseID: string) {
    this.courses.getCourseName(courseID).then(response => {
      this.courseName = response ?? '';
    }).catch( () => this.courseName = '');
  }

  private startPollingFAQ(): void {
    this.fetchFAQsSub$?.unsubscribe();
    console.warn('Aloitetaan UKK pollaus.');
    const pollRate = this.POLLING_RATE_MIN * Constants.MILLISECONDS_IN_MIN;
    this.fetchFAQsSub$ = timer(0, pollRate)
        .pipe(
          takeUntil(this.unsubscribe$)
        ).subscribe(() => this.fetchFAQ(this.courseID));
  }

}
