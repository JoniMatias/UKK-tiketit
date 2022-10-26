/* singleton services and modules shared throughout the application. This module should
 * only be imported by app.module. */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MaterialModule } from '../shared/material.module';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';

import { MatDialogModule } from '@angular/material/dialog';

import { AuthService } from './auth.service';

import { HeaderComponent } from '../core/header/header.component';
import { FooterComponent } from './footer/footer.component';
import { PrivacyModalComponent } from './footer/privacy-modal/privacy-modal.component';

@NgModule({
  declarations: [
    HeaderComponent,
    FooterComponent,
    PrivacyModalComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    MaterialModule,
    MatMenuModule,
    RouterModule,
    MatDialogModule
  ],
  providers: [
    AuthService
  ],
  exports: [
    HeaderComponent,
    FooterComponent
  ]
})
export class CoreModule { }
