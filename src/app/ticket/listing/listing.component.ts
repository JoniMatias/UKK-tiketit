import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
// import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatTableDataSource } from '@angular/material/table';
// import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { Observable, Subscription, interval, startWith, switchMap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { TicketService, MyCourse, FAQ, Question } from '../ticket.service';
import { AuthService } from 'src/app/core/auth.service';

export interface Sortable {
  tila: string;
  id: number;
  otsikko: string;
  aikaleima: string;
  aloittajanNimi: string
}
export interface ColumnDefinition {
  def: string;
  showMobile: boolean;
}

@Component({
  selector: 'app-listing',
  templateUrl: './listing.component.html',
  styleUrls: ['./listing.component.scss'],
})
export class ListingComponent implements OnInit, OnDestroy {
  private courseID: string | null = '';
  // dataSource:any = [];
  dataSource = new MatTableDataSource<Sortable>();
  dataSourceFAQ = new MatTableDataSource<FAQ>();
  // dataSourceFAQ = {} as MatTableDataSource<FAQ>;
  // dataSource = new MatTableDataSource<Sortable>();
  // displayedColumns: string[] = [ 'otsikko', 'aikaleima', 'aloittajanNimi' ];
  public columnDefinitions: ColumnDefinition[];
  public columnDefinitionsFAQ: ColumnDefinition[];
  public courseName: string = '';
  public username: string | null;;
  ticketViewLink: string = environment.apiBaseUrl + '/ticket-view/';
  public isCourseIDvalid: boolean = false;
  public isPhonePortrait: boolean = false;
  public showNoQuestions: boolean = true;
  public showNoFAQ: boolean = true;
  public FAQisLoaded: boolean = false;
  public isLoaded: boolean = false;
  public header: string = '';
  // Ei ole vakio.
  public maxItemTitleLength = 100;
  public me: string =  $localize`:@@Minä:Minä`;
  private routeSubscription: Subscription | null = null;
  public numberOfFAQ: number = 0;
  public numberOfQuestions: number = 0;
  public ticketMessageSub: Subscription;
  public errorMessage: string = '';
  public isInIframe: boolean = true;
  private timeInterval: Subscription = new Subscription();
  // public isLoggedIn$: Observable<boolean>;

  @ViewChild('sortQuestions', {static: false}) sortQuestions = new MatSort();
  @ViewChild('sortFaq', {static: false}) sortFaq = new MatSort();

  // @ViewChild('paginatorQuestions') paginator: MatPaginator | null = null;
  // @ViewChild('paginatorFaq') paginatorFaq: MatPaginator | null = null;

  //displayedColumns: string[] = ['id', 'nimi', 'ulkotunnus']
  //data = new MatTableDataSource(kurssit);

  // private _liveAnnouncer: LiveAnnouncer,

  constructor(
    private responsive: BreakpointObserver,
    private router: Router,
    private route: ActivatedRoute,
    private ticket: TicketService,
    private authService: AuthService
  ) {
    this.ticketMessageSub = this.ticket.onMessages().subscribe(message => {
      if (message) {
        this.errorMessage = message;
      } else {
        // Poista viestit, jos saadaan tyhjä viesti.
        this.errorMessage = '';
      }
    });

    // this.isLoggedIn$ = this.authService.onIsUserLoggedIn();

    this.username = this.authService.getUserName();

    this.columnDefinitions = [
      { def: 'tila', showMobile: true },
      { def: 'otsikko', showMobile: true },
      { def: 'aloittajanNimi', showMobile: false },
      { def: 'aikaleima', showMobile: true }
    ];

    this.columnDefinitionsFAQ = [
      { def: 'otsikko', showMobile: true },
      { def: 'aikaleima', showMobile: false },
      { def: 'tyyppi', showMobile: true }
    ];

  }

  ngOnInit() {
    this.getIfInIframe();
    // if (this.route.snapshot.paramMap.get('courseID') !== null) {};
    this.trackScreenSize();
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      if (params['courseID'] === undefined) {
        // TODO: Jokin parempi virheilmoitus tähän.
        this.errorMessage = "Kurssi ID:ä ei löytynyt. Oikea URL-linkin muoto esim kurssille 1: localhost:4200/list-tickets?courseID=1. Tämä ilmoitus kehitysversioon tarkoitettu.";
        this.isLoaded = true;
        throw new Error('Kurssia ei löytynyt.');
      }
      var courseIDcandinate: string = params['courseID'];
      this.showFAQ(courseIDcandinate);
      this.setTicketListHeader();
      this.ticket.setActiveCourse(courseIDcandinate);
      // Voi olla 1. näkymä, jolloin on kurssi ID tiedossa.
      // this.authService.saveUserInfo(courseIDcandinate);
      this.trackLoginState(courseIDcandinate);
    });
  }

  public submitTicket () {
    if (this.authService.getIsUserLoggedIn() == false) {
      window.localStorage.setItem('REDIRECT_URL', 'submit');
      console.log('--- Tallennettiin redirect URL: /submit/ ----');
    }
    this.router.navigateByUrl('submit');
  }

  private trackLoginState(courseIDcandinate: string) {
    this.authService.onIsUserLoggedIn().subscribe(response => {
      console.log('lista : saatiin kirjautumistieto: ' + response);
      this.isLoaded = true;
      if (response == true) {
        this.updateLoggedInView(courseIDcandinate);
      }
    });
  }

  private updateLoggedInView(courseIDcandinate: string) {
    this.ticket.getMyCourses().then(response => {
      if (response[0].kurssi !== undefined) {
        const myCourses: MyCourse[] = response;
        // console.log('kurssit: ' + JSON.stringify(myCourses) + ' urli numero: ' + courseIDcandinate);
        // Onko käyttäjä URL parametrilla saadulla kurssilla.
        if (!myCourses.some(course => course.kurssi == Number(courseIDcandinate))) {
          this.errorMessage = $localize`:@@Et ole kurssilla:Et ole osallistujana tällä kurssilla` + '.';
        } else {
          this.courseID = courseIDcandinate;
          // Jotta header ja submit-view tietää tämän, kun käyttäjä klikkaa otsikkoa, koska on tikettilistan URL:ssa.
          this.isCourseIDvalid = true;
          this.ticket.setActiveCourse(this.courseID);
          if (this.courseID !== null) {
            this.showCourseName(this.courseID);
            // this.courseName = 'Ohjelmointikurssi';
          }

        }
      }
    }).then(() => {
      this.pollQuestions();
    }).catch(error => {
      console.log('listing.component: saatiin error: ');
      console.dir(error);
      this.handleError(error);
    }).finally(() => {
      // this.isLoaded = true;
    })
  }

  private getIfInIframe() {
    const isInIframe = window.sessionStorage.getItem('IN-IFRAME');
    if (isInIframe == 'false') {
      this.isInIframe = false;
    } else {
      this.isInIframe = true;
    }
  }

  private testIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
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

  private pollQuestions() {
    // FIXME: 15min välein ATM ettei koodatessa turhaa pollata.
    this.timeInterval = interval(900000)
      .pipe(
        startWith(0),
        switchMap(() => this.ticket.getOnQuestions(Number(this.courseID)))
      ).subscribe(
        response => {
          console.log('question polled');
          if (response.length > 0) {
            let tableData: Sortable[] = response.map(({ tila, id, otsikko, aikaleima, aloittaja }) => ({
              tilaID: tila,
              tila: this.ticket.getTicketState(tila),
              id: id,
              otsikko: otsikko,
              aikaleima: aikaleima,
              aloittajanNimi: aloittaja.nimi
            }));
            // console.log('Tabledata alla:');
            // console.log(JSON.stringify(tableData));
            if (tableData !== null) {
              this.dataSource = new MatTableDataSource(tableData);
            }
            // console.log('MatTableDataSource alla:');
            // console.dir(this.dataSource);
            this.numberOfQuestions = tableData.length;
            // console.log('Saatiin vastaus (alla):');
            // console.dir(SortableData);
            this.dataSource.sort = this.sortQuestions;
            // this.dataSource.paginator = this.paginator;
            if (this.numberOfQuestions === 0) {
              this.showNoQuestions = true;
            } else {
              this.showNoQuestions = false;
            }
          }
          // console.dir(this.dataSource);
        }
      )
  }

  private showCourseName(courseID: string) {
    this.ticket.getCourseName(courseID).then( courseName => {
      if (courseName.length > 0 ) {
        this.courseName = courseName;
      }
    }).catch( () => {
      this.courseName = '';
    })
  }

  public setTicketListHeader() {
    let userRole = this.authService.getUserRole();
    switch (userRole) {
      case 'opettaja':
        this.header = $localize`:@@Kurssilla esitetyt kysymykset:Kurssilla esitetyt kysymykset`; break;
      case 'admin':
        this.header = $localize`:@@Kurssilla esitetyt kysymykset:Kurssilla esitetyt kysymykset`; break;
      case 'opiskelija':
        this.header = $localize`:@@Omat kysymykset:Omat kysymykset`; break;
      default:
        // Jos ei olla kirjautuneina.
        this.header = $localize`:@@Esitetyt kysymykset:Esitetyt kysymykset`
    }
  }

  public getDisplayedColumnFAQ(): string[] {
    return this.columnDefinitionsFAQ
      .filter((cd) => !this.isPhonePortrait || cd.showMobile)
      .map((cd) => cd.def);
  }

  public getDisplayedColumn(): string[] {
    return this.columnDefinitions
      .filter((cd) => !this.isPhonePortrait || cd.showMobile)
      .map((cd) => cd.def);
  }

  private showFAQ(courseID: string) {
    this.ticket
      .getFAQ(Number(courseID))
      .then(response => {
        if (response.length > 0) {
          this.numberOfFAQ = response.length;
          if (this.numberOfFAQ === 0) {
            this.showNoFAQ = true;
          } else {
            this.showNoFAQ = false;
          }
          this.dataSourceFAQ = new MatTableDataSource(
            response.map(({ id, otsikko, aikaleima, tyyppi }) => ({
              id: id,
              otsikko: otsikko,
              aikaleima: aikaleima,
              tyyppi: tyyppi
            }))
          );
          // console.log('Saatiin vastaus (alla):');
          // console.dir(SortableData);
          this.dataSourceFAQ.sort = this.sortFaq;
          // this.dataSourceFAQ.paginator = this.paginatorFaq;
        }
      })
      .catch(error => {
        this.handleError(error);
      })
      .finally(() => {
        this.FAQisLoaded = true;
      });
  }

  // TODO: lisää virheilmoitusten käsittelyjä.
  private handleError(error: any) {
    if (error.tunnus !== undefined ) {
      if (error.tunnus == 1000 ) {
        this.errorMessage = $localize`:@@Et ole kirjautunut:Et ole kirjautunut` + '.'
      } 
    }
  }

  // announceSortChange(sortState: Sort) {
    // This example uses English messages. If your application supports
    // multiple language, you would internationalize these strings.
    // Furthermore, you can customize the message to add additional
    // details about the values being sorted.
  //   if (sortState.direction) {
  //     this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
  //   } else {
  //     this._liveAnnouncer.announce('Sorting cleared');
  //   }
  // }

  ngOnDestroy(): void {
    this.timeInterval.unsubscribe();
    this.ticketMessageSub.unsubscribe();
  }

  //haku toiminto, jossa paginointi kommentoitu pois
  applyFilter(event: Event){
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceFAQ.filter = filterValue.trim().toLowerCase();
      /*if (this.dataSourceFAQ.paginator) {
        this.dataSourceFAQ.paginator.firstPage();
      }*/
  }
}
