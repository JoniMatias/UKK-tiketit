import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { TicketService } from '../../ticket.service';

interface FileInfo {
  filename: string;
  error?: string;
  errorToolTip?: string;

}

@Component({
  selector: 'app-edit-attachments',
  template: `
    <input type="file" class="file-input" multiple (change)="onFileChanged($event)" #fileUpload>

    <!-- <input type="file" class="file-input" id="file-input-{{url}}" multiple name="file-input-{{url}}"
      (change)="onFileChanged($event)" #fileUpload> -->

    <div class="file-list-wrapper" *ngIf="fileList !== null">
      <div class="file-list-row" *ngFor="let file of fileInfoList; let index = index">
        <div class="list-item">
          <span class="filename" matTooltip="{{file.filename}}" [matTooltipShowDelay]="600">{{file.filename}}</span>
          <div class="file-error-message" matError *ngIf="file.error" matTooltip="{{file?.errorToolTip}}" [matTooltipShowDelay]="600">
          <mat-icon>warning</mat-icon>{{file.error}}</div>
          <button mat-icon-button class="remove-file-button" (click)="removeSelectedFile(index)"><mat-icon>close</mat-icon></button>
        </div>
        <!-- <mat-error>Virheilmoitukset tähän.</mat-error> -->
      </div>
    </div>`,
  styleUrls: ['./edit-attachments.component.scss']
})

export class EditAttachmentsComponent implements OnInit {

  @Output() fileListOutput = new EventEmitter<File[]>();
  @Input() uploadClicks: Observable<string> = new Observable();
  // @Input() fileListInput

  @Output() attachmentsHasErrors = new EventEmitter<boolean>;
  public fileList: File[] = [];
  public fileInfoList: FileInfo[] = [];
  public progress: number = 0;
  public readonly MAX_FILE_SIZE_MB=100;
  // public url: string = '';
  // public fileNameList: string[] = [];
  public noAttachmentsMessage = $localize `:@@Ei liitetiedostoa:Ei liitetiedostoa` + '.';

  constructor(private ticketService: TicketService) {
  }

  ngOnInit() {
    const element: HTMLElement = document.querySelector('.file-input') as HTMLElement;
    this.uploadClicks.subscribe(action => {
        element.click()
    });
    this.trackMessages();
  }

  private trackMessages() {
    this.ticketService.trackMessages().subscribe(message => {

    })
  }

  public clear() {
    this.fileInfoList = [];
    this.fileList = [];
  }

  public onFileChanged(event: any) {
    console.log('edit-attachments: event saatu.');
    const MEGABYTE = 1000000;
    for (let file of event.target.files) {
      if (this.fileInfoList.some(item => item.filename === file.name)) continue
      let fileinfo: FileInfo = { filename: file.name };
      if (file.size > this.MAX_FILE_SIZE_MB * MEGABYTE) {
        fileinfo.error = $localize `:@@Liian iso:Liian iso`;
        fileinfo.errorToolTip = $localize `:@@Tiedoston koko ylittää:Tiedoston koko ylittää ${this.MAX_FILE_SIZE_MB} megatavun rajoituksen` + '.';
        this.attachmentsHasErrors.emit(true);
      } else {
        this.fileList.push(file);
      }
      this.fileInfoList.push(fileinfo);
      this.fileListOutput.emit(this.fileList);
      console.log('fileinfolist ' + JSON.stringify(this.fileInfoList));
      console.log('filelist:');
      console.dir(this.fileList);
    }
  }

  public sendFiles(ticketID: string, commentID: string) {
    console.log('edit-attachments: ticketID: ' + ticketID + ' commentID: ' + commentID);
    for (let file of this.fileList) {
      try {
        this.ticketService.uploadFile(ticketID, commentID, file).subscribe((event: HttpEvent<any>) => {
          
          switch (event.type) {
            case HttpEventType.Sent:
              console.log('Request has been made!');
              break;
            case HttpEventType.ResponseHeader:
              console.log('Response header has been received!');
              break;
            case HttpEventType.UploadProgress:
              if (event.total !== undefined) {
                this.progress = Math.round(event.loaded / event.total * 100);
              }
              console.log(`Uploaded! ${this.progress}%`);
              break;
            case HttpEventType.Response:
              console.log('User successfully created!', event.body);
              setTimeout(() => {
                this.progress = 0;
              }, 1500);
            break;
            default:
          }
        })
      } catch (error: any) {
        this.attachmentsHasErrors.emit(true);
      }
    }

  }

  public removeSelectedFile(index: number) {
    this.fileList.splice(index, 1);
    this.fileInfoList.splice(index, 1);
    this.attachmentsHasErrors.emit(this.fileInfoList.some(item => item.error));
    this.fileListOutput.emit(this.fileList);
  }

}
