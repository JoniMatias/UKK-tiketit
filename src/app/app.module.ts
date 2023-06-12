import { APP_INITIALIZER, NgModule } from '@angular/core';
// import { initializeSupportedLocales } from './app.initializers';
import { LOCALE_ID } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { BrowserModule } from '@angular/platform-browser';

import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { TicketModule } from './ticket/ticket.module';
import { UserModule } from './user/user.module';
import { CourseModule } from './course/course.module';

import { AppComponent } from './app.component';
import { ListingComponent } from './ticket/listing/listing.component';
import { initializeLanguage  } from "./app.initializers";

// AppRoutingModule pitää tulla viimeisimpänä ennen muita routingeja sisältäviä
// moduuleja. Oletuksena käytetään aina fi-FI -localea.
@NgModule({
  declarations: [
    AppComponent,
    ListingComponent
  ],
  imports: [
    BrowserModule,
    CoreModule,
    SharedModule,
    TicketModule,
    UserModule,
    CourseModule,
    AppRoutingModule,
  ],
  providers: [
    { provide: APP_INITIALIZER, useFactory: () => initializeLanguage, multi: true },
    { provide: LOCALE_ID, useValue: 'fi' }
  ],
  bootstrap: [AppComponent],
  exports: []
})


export class AppModule { }

// useFactory: initializeSupportedLocales
// { provide: LOCALE_ID, useValue: 'fi' }

// { provide: LOCALE_ID, useFactory: () => initializeLocale, multi: true },
//  { provide: LOCALE_ID, useFactory: initializeSupportedLocales }
